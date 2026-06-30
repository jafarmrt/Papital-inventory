import { sql, eq, and, desc, inArray } from 'drizzle-orm';
import { orm } from '../db/drizzle.js';
import { documents, documentItems, items, transactions, warehouses, appSettings } from '../db/schema.js';

export class DocumentService {
  /**
   * Updates the notes of a specific document.
   */
  static async updateDocumentNotes(id: number, notes: string): Promise<void> {
    await orm.update(documents).set({ notes }).where(eq(documents.id, id));
  }

  /**
   * Calculates the next reference number for a given document type.
   */
  static async getNextRef(type: string): Promise<string> {
    return await orm.transaction(async (tx) => {
      let startNumber = 1;

      if (type === 'invoice') {
        const startSetting = await tx.select().from(appSettings).where(eq(appSettings.key, 'invoice_start_number'));
        if (startSetting.length > 0 && !isNaN(parseInt(startSetting[0].value, 10))) {
          startNumber = parseInt(startSetting[0].value, 10);
        }
      }

      const docResult = await tx.execute(sql`
        SELECT ref_number 
        FROM ${documents} 
        WHERE type = ${type} AND is_deleted = 0 
        ORDER BY CAST(ref_number AS INTEGER) DESC 
        LIMIT 1 
        FOR UPDATE
      `);
      const maxNum = docResult.rows[0]?.ref_number ? parseInt(String(docResult.rows[0].ref_number), 10) : 0;
      
      const nextNum = maxNum && maxNum >= startNumber ? maxNum + 1 : startNumber;
      return nextNum.toString();
    });
  }

  /**
   * Creates a new document and applies associated inventory changes.
   */
  static async createDocument(body: any): Promise<number> {
    const { 
      docType, refNumber, date, items: docLines, user, inOut,
      buyer_name, buyer_city, buyer_phone, buyer_address,
      status, notes, location
    } = body;

    const docStatus = status || 'final';
    const docLocation = location || 'safe';

    const newDocId = await orm.transaction(async (tx) => {
      const [insertedDoc] = await tx.insert(documents).values({
        type: docType,
        refNumber: String(refNumber),
        date,
        user,
        notes: notes || '',
        buyerName: buyer_name || '',
        buyerCity: buyer_city || '',
        buyerPhone: buyer_phone || '',
        buyerAddress: buyer_address || '',
        status: docStatus,
        isDeleted: 0
      }).returning({ id: documents.id });
      const docId = insertedDoc.id;

      if (docType === 'audit') {
        await tx.select({ code: warehouses.code }).from(warehouses);
        for (const item of docLines) {
          const { itemId, system_stock, physical_stock, location: itemLoc } = item;
          const targetLoc = itemLoc || docLocation;
          const variance = Number(physical_stock) - Number(system_stock);

          await tx.insert(documentItems).values({
            documentId: docId,
            itemId,
            quantity: physical_stock,
            unitPrice: 0,
            discount: 0,
            location: targetLoc
          });

          if (variance !== 0) {
            const txType = variance > 0 ? 'in' : 'out';
            const absVariance = Math.abs(variance);
            const txNotes = variance > 0 ? 'اضافی انبارگردانی دوره‌ای' : 'کسری انبارگردانی دوره‌ای';

            await tx.insert(transactions).values({
              itemId,
              documentId: docId,
              type: txType,
              quantity: absVariance,
              date,
              documentType: 'audit',
              documentRef: String(refNumber),
              createdBy: user,
              notes: txNotes,
              location: targetLoc,
              isDeleted: 0
            });

            const [itemData] = await tx.select({ stocks: items.stocks, currentStock: items.currentStock }).from(items).where(eq(items.id, itemId));
            const currentStocks = (itemData?.stocks as Record<string, number>) || {};
            const oldLocStock = Number(currentStocks[targetLoc] || 0);
            currentStocks[targetLoc] = Number(physical_stock);
            
            const diff = Number(physical_stock) - oldLocStock;
            const newTotalStock = Number(itemData?.currentStock || 0) + diff;

            await tx.update(items).set({
              stocks: currentStocks,
              currentStock: newTotalStock
            }).where(eq(items.id, itemId));
          }
        }
      } else {
        for (const item of docLines) {
          const { itemId, quantity, unit_price, discount, location: itemLoc } = item;
          const price = unit_price || 0;
          const disc = discount || 0;
          const qty = Number(quantity);
          const targetLoc = itemLoc || docLocation;

          if (docStatus === 'final') {
            if (inOut === 'out') {
              const [stockCheck] = await tx.select({ stocks: items.stocks, name: items.name, unit: items.unit }).from(items).where(eq(items.id, itemId)).for('update');
              const stocksMap = stockCheck?.stocks as Record<string, number> || {};
              const locStock = Number(stocksMap[targetLoc] || 0);
              if (locStock < qty) {
                throw new Error(`عدم موجودی کافی در انبار انتخابی! موجودی کالای ${stockCheck?.name}: ${locStock} ${stockCheck?.unit}`);
              }
            } else {
              await tx.select({ id: items.id }).from(items).where(eq(items.id, itemId)).for('update');
            }

            await tx.insert(transactions).values({
              itemId,
              documentId: docId,
              type: inOut,
              quantity: qty,
              date,
              documentType: docType,
              documentRef: String(refNumber),
              createdBy: user,
              notes: '',
              location: targetLoc,
              isDeleted: 0
            });

            const [itemData] = await tx.select({ stocks: items.stocks, currentStock: items.currentStock, weightedAverageCost: items.weightedAverageCost }).from(items).where(eq(items.id, itemId));
            const currentStocks = (itemData?.stocks as Record<string, number>) || {};
            const currentLocStock = Number(currentStocks[targetLoc] || 0);
            
            currentStocks[targetLoc] = inOut === 'in' ? currentLocStock + qty : currentLocStock - qty;
            
            const oldTotalStock = Number(itemData?.currentStock || 0);
            const newTotalStock = inOut === 'in' ? oldTotalStock + qty : oldTotalStock - qty;
            
            let newWAC = Number(itemData?.weightedAverageCost || 0);
            if (inOut === 'in') {
              if (oldTotalStock <= 0 || newTotalStock <= 0) {
                newWAC = price;
              } else {
                newWAC = ((oldTotalStock * newWAC) + (qty * price)) / newTotalStock;
              }
            }

            await tx.update(items).set({
              stocks: currentStocks,
              currentStock: newTotalStock,
              weightedAverageCost: newWAC
            }).where(eq(items.id, itemId));
          }

          await tx.insert(documentItems).values({
            documentId: docId,
            itemId,
            quantity: qty,
            unitPrice: price,
            discount: disc,
            location: targetLoc
          });
        }
      }
      return docId;
    });

    return newDocId;
  }

  /**
   * Retrieves a list of documents, optionally filtered by type.
   */
  static async getDocuments(type?: string): Promise<any[]> {
    let docs;
    if (type) {
      docs = await orm.select().from(documents).where(and(eq(documents.type, type), eq(documents.isDeleted, 0))).orderBy(desc(documents.id));
    } else {
      docs = await orm.select().from(documents).where(eq(documents.isDeleted, 0)).orderBy(desc(documents.id));
    }

    // Fetch items for all these docs to calculate totals
    const docIds = docs.map(d => d.id);
    let allItems: any[] = [];
    if (docIds.length > 0) {
      allItems = await orm.select({
        document_id: documentItems.documentId,
        quantity: documentItems.quantity,
        unit_price: documentItems.unitPrice,
        discount: documentItems.discount
      }).from(documentItems).where(inArray(documentItems.documentId, docIds));
    }

    return docs.map(d => {
      const dItems = allItems.filter(i => i.document_id === d.id);
      return {
        ...d,
        buyer_name: d.buyerName,
        buyer_city: d.buyerCity,
        buyer_phone: d.buyerPhone,
        buyer_address: d.buyerAddress,
        ref_number: d.refNumber,
        items: dItems
      };
    });
  }

  /**
   * Retrieves a document by its ID, with its associated items.
   */
  static async getDocumentById(id: number): Promise<any> {
    const [doc] = await orm.select().from(documents).where(eq(documents.id, id));
    if (!doc) return null;

    const itemsResult = await orm.execute(sql`
      SELECT di.*, i.name, i.code, i.unit, i.category
      FROM ${documentItems} di
      JOIN ${items} i ON di.item_id = i.id
      WHERE di.document_id = ${doc.id}
    `);

    const txs = doc.type === 'audit'
      ? await orm.select().from(transactions).where(eq(transactions.documentId, doc.id))
      : [];

    return {
      ...doc,
      buyer_name: doc.buyerName,
      buyer_city: doc.buyerCity,
      buyer_phone: doc.buyerPhone,
      buyer_address: doc.buyerAddress,
      ref_number: doc.refNumber,
      items: itemsResult.rows.map(row => {
        const matchingTx = txs.find(t => t.itemId === row.item_id);
        const variance = matchingTx 
          ? (matchingTx.type === 'in' ? matchingTx.quantity : -matchingTx.quantity)
          : 0;
        return {
          ...row,
          item_id: row.item_id,
          unit_price: row.unit_price,
          document_id: row.document_id,
          variance,
          system_stock: Number(row.quantity) - variance
        };
      })
    };
  }

  /**
   * Finalizes a draft document, performing stock checks and updating inventory.
   */
  static async finalizeDocument(id: number, user?: string): Promise<void> {
    await orm.transaction(async (tx) => {
      const [doc] = await tx.select().from(documents).where(and(eq(documents.id, id), eq(documents.isDeleted, 0)));
      if (!doc || doc.status === 'final') return;

      await tx.update(documents).set({ status: 'final' }).where(eq(documents.id, id));

      const docLines = await tx.select().from(documentItems).where(eq(documentItems.documentId, id));
      const inOut = (doc.type === 'receipt' || doc.type === 'return') ? 'in' : 'out';

      for (const item of docLines) {
        const targetLoc = item.location || 'safe';
        const qty = item.quantity;
        const price = item.unitPrice || 0;

        if (inOut === 'out') {
          const [stockCheck] = await tx.select({ stocks: items.stocks, name: items.name, unit: items.unit }).from(items).where(eq(items.id, item.itemId)).for('update');
          const stocksMap = stockCheck?.stocks as Record<string, number> || {};
          const locStock = Number(stocksMap[targetLoc] || 0);
          if (locStock < qty) {
            throw new Error(`عدم موجودی کافی در انبار انتخابی! موجودی کالای ${stockCheck?.name}: ${locStock} ${stockCheck?.unit}`);
          }
        } else {
          await tx.select({ id: items.id }).from(items).where(eq(items.id, item.itemId)).for('update');
        }

        await tx.insert(transactions).values({
          itemId: item.itemId,
          documentId: id,
          type: inOut,
          quantity: qty,
          date: doc.date,
          documentType: doc.type,
          documentRef: doc.refNumber,
          createdBy: user || doc.user,
          notes: '',
          location: targetLoc,
          isDeleted: 0
        });

        const [itemData] = await tx.select({ stocks: items.stocks, currentStock: items.currentStock, weightedAverageCost: items.weightedAverageCost }).from(items).where(eq(items.id, item.itemId));
        const currentStocks = (itemData.stocks as Record<string, number>) || {};
        const currentLocStock = Number(currentStocks[targetLoc] || 0);
        
        currentStocks[targetLoc] = inOut === 'in' ? currentLocStock + qty : currentLocStock - qty;
        
        const oldTotalStock = Number(itemData.currentStock || 0);
        const newTotalStock = inOut === 'in' ? oldTotalStock + qty : oldTotalStock - qty;
        
        let newWAC = Number(itemData.weightedAverageCost || 0);
        if (inOut === 'in') {
          if (oldTotalStock <= 0 || newTotalStock <= 0) {
            newWAC = price;
          } else {
            newWAC = ((oldTotalStock * newWAC) + (qty * price)) / newTotalStock;
          }
        }

        await tx.update(items).set({
          stocks: currentStocks,
          currentStock: newTotalStock,
          weightedAverageCost: newWAC
        }).where(eq(items.id, item.itemId));
      }
    });
  }

  /**
   * Soft deletes a document and reverts any finalized inventory changes.
   */
  static async deleteDocument(id: number): Promise<void> {
    await orm.transaction(async (tx) => {
      const [doc] = await tx.select().from(documents).where(and(eq(documents.id, id), eq(documents.isDeleted, 0)));
      if (!doc) return;

      await tx.update(documents).set({ isDeleted: 1 }).where(eq(documents.id, id));
      await tx.update(transactions).set({ isDeleted: 1 }).where(eq(transactions.documentId, doc.id));

      const docLines = await tx.select().from(documentItems).where(eq(documentItems.documentId, id));
      const inOut = (doc.type === 'receipt' || doc.type === 'return') ? 'in' : 'out';

      if (doc.status === 'final') {
        for (const item of docLines) {
          const qty = item.quantity;
          const targetLoc = item.location || 'safe';

          const [itemData] = await tx.select({ stocks: items.stocks, currentStock: items.currentStock, weightedAverageCost: items.weightedAverageCost }).from(items).where(eq(items.id, item.itemId)).for('update');
          const currentStocks = (itemData.stocks as Record<string, number>) || {};
          const currentLocStock = Number(currentStocks[targetLoc] || 0);
          
          currentStocks[targetLoc] = inOut === 'in' ? currentLocStock - qty : currentLocStock + qty;
          
          const oldTotalStock = Number(itemData.currentStock || 0);
          const newTotalStock = inOut === 'in' ? oldTotalStock - qty : oldTotalStock + qty;
          
          let newWAC = Number(itemData.weightedAverageCost || 0);
          if (inOut === 'in') {
            if (newTotalStock <= 0) {
              newWAC = newWAC; // keep old
            } else {
              newWAC = ((oldTotalStock * newWAC) - (qty * Number(item.unitPrice || 0))) / newTotalStock;
            }
          }

          await tx.update(items).set({
            stocks: currentStocks,
            currentStock: newTotalStock,
            weightedAverageCost: newWAC
          }).where(eq(items.id, item.itemId));
        }
      }
    });
  }
}
