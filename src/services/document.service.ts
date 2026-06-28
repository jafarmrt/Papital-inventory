import { sql, eq, and, desc } from 'drizzle-orm';
import { orm } from '../db/drizzle.js';
import { documents, documentItems, items, transactions, warehouses, appSettings } from '../db/schema.js';

export class DocumentService {
  /**
   * Calculates the next reference number for a given document type.
   */
  static async getNextRef(type: string): Promise<string> {
    let startNumber = 1;

    if (type === 'out') {
      const startSetting = await orm.select().from(appSettings).where(eq(appSettings.key, 'invoice_start_number'));
      if (startSetting.length > 0 && !isNaN(parseInt(startSetting[0].value, 10))) {
        startNumber = parseInt(startSetting[0].value, 10);
      }
    }

    const docResult = await orm.execute(sql`
      SELECT MAX(CAST(ref_number AS INTEGER)) as max_num FROM ${documents} WHERE type = ${type} AND is_deleted = 0
    `);
    const maxNum = docResult.rows[0]?.max_num ? parseInt(String(docResult.rows[0].max_num), 10) : 0;
    
    const nextNum = maxNum && maxNum >= startNumber ? maxNum + 1 : startNumber;
    return nextNum.toString();
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
              user,
              notes: txNotes,
              location: targetLoc,
              isDeleted: 0
            });

            // Update jsonb stock array
            await tx.execute(sql`
              UPDATE ${items}
              SET stocks = jsonb_set(COALESCE(stocks, '{}'::jsonb), array[${targetLoc}], to_jsonb(${physical_stock}::numeric)),
                  current_stock = (
                    SELECT COALESCE(SUM(value::numeric), 0)
                    FROM jsonb_each_text(jsonb_set(COALESCE(stocks, '{}'::jsonb), array[${targetLoc}], to_jsonb(${physical_stock}::numeric)))
                  )
              WHERE id = ${itemId}
            `);
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
              const stockCheck = await tx.execute(sql`SELECT (COALESCE((stocks->>${targetLoc})::numeric, 0)) as loc_stock, name, unit FROM ${items} WHERE id = ${itemId}`);
              const locStock = Number(stockCheck.rows[0]?.loc_stock || 0);
              if (locStock < qty) {
                throw new Error(`عدم موجودی کافی در انبار انتخابی! موجودی کالای ${stockCheck.rows[0]?.name}: ${locStock} ${stockCheck.rows[0]?.unit}`);
              }
            }

            await tx.insert(transactions).values({
              itemId,
              documentId: docId,
              type: inOut,
              quantity: qty,
              date,
              documentType: docType,
              documentRef: String(refNumber),
              user,
              location: targetLoc,
              isDeleted: 0
            });

            if (inOut === 'in') {
              await tx.execute(sql`
                UPDATE ${items}
                SET stocks = jsonb_set(COALESCE(stocks, '{}'::jsonb), array[${targetLoc}], to_jsonb((COALESCE((stocks->>${targetLoc})::numeric, 0) + ${qty})::numeric)),
                    weighted_average_cost = CASE 
                      WHEN current_stock <= 0 THEN ${price}
                      ELSE ((current_stock * weighted_average_cost) + (${qty} * ${price})) / (current_stock + ${qty})
                    END,
                    current_stock = current_stock + ${qty}
                WHERE id = ${itemId}
              `);
            } else {
              await tx.execute(sql`
                UPDATE ${items}
                SET stocks = jsonb_set(COALESCE(stocks, '{}'::jsonb), array[${targetLoc}], to_jsonb((COALESCE((stocks->>${targetLoc})::numeric, 0) - ${qty})::numeric)),
                    current_stock = current_stock - ${qty}
                WHERE id = ${itemId}
              `);
            }
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

    return docs.map(d => ({
      ...d,
      buyer_name: d.buyerName,
      buyer_city: d.buyerCity,
      buyer_phone: d.buyerPhone,
      buyer_address: d.buyerAddress,
      ref_number: d.refNumber
    }));
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

    return {
      ...doc,
      buyer_name: doc.buyerName,
      buyer_city: doc.buyerCity,
      buyer_phone: doc.buyerPhone,
      buyer_address: doc.buyerAddress,
      ref_number: doc.refNumber,
      items: itemsResult.rows.map(row => ({
        ...row,
        item_id: row.item_id,
        unit_price: row.unit_price,
        document_id: row.document_id
      }))
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
      const inOut = 'out';

      for (const item of docLines) {
        const targetLoc = item.location || 'safe';
        const qty = item.quantity;

        const stockCheck = await tx.execute(sql`SELECT (COALESCE((stocks->>${targetLoc})::numeric, 0)) as loc_stock, name, unit FROM ${items} WHERE id = ${item.itemId}`);
        const locStock = Number(stockCheck.rows[0]?.loc_stock || 0);
        if (locStock < qty) {
          throw new Error(`عدم موجودی کافی در انبار انتخابی! موجودی کالای ${stockCheck.rows[0]?.name}: ${locStock} ${stockCheck.rows[0]?.unit}`);
        }

        await tx.insert(transactions).values({
          itemId: item.itemId,
          documentId: id,
          type: inOut,
          quantity: qty,
          date: doc.date,
          documentType: doc.type,
          documentRef: doc.refNumber,
          user: user || doc.user,
          location: targetLoc,
          isDeleted: 0
        });
        
        await tx.execute(sql`
          UPDATE ${items}
          SET stocks = jsonb_set(COALESCE(stocks, '{}'::jsonb), array[${targetLoc}], to_jsonb((COALESCE((stocks->>${targetLoc})::numeric, 0) - ${qty})::numeric)),
              current_stock = current_stock - ${qty}
          WHERE id = ${item.itemId}
        `);
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
      await tx.execute(sql`UPDATE ${transactions} SET is_deleted = 1 WHERE document_id = ${doc.id} OR (document_ref = ${doc.refNumber} AND document_type = ${doc.type})`);

      const docLines = await tx.select().from(documentItems).where(eq(documentItems.documentId, id));
      const inOut = (doc.type === 'receipt' || doc.type === 'return') ? 'in' : 'out';

      if (doc.status === 'final') {
        for (const item of docLines) {
          const qty = item.quantity;
          const targetLoc = item.location || 'safe';

          if (inOut === 'in') {
            await tx.execute(sql`
              UPDATE ${items}
              SET stocks = jsonb_set(COALESCE(stocks, '{}'::jsonb), array[${targetLoc}], to_jsonb((COALESCE((stocks->>${targetLoc})::numeric, 0) - ${qty})::numeric)),
                  current_stock = current_stock - ${qty}
              WHERE id = ${item.itemId}
            `);
          } else {
            await tx.execute(sql`
              UPDATE ${items}
              SET stocks = jsonb_set(COALESCE(stocks, '{}'::jsonb), array[${targetLoc}], to_jsonb((COALESCE((stocks->>${targetLoc})::numeric, 0) + ${qty})::numeric)),
                  current_stock = current_stock + ${qty}
              WHERE id = ${item.itemId}
            `);
          }
        }
      }
    });
  }
}
