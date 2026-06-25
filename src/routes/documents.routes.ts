import { Router } from 'express';
import { sql, eq, and, desc } from 'drizzle-orm';
import { orm } from '../db/drizzle.js';
import { documents, documentItems, items, transactions, warehouses, appSettings } from '../db/schema.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/documents/next-ref', async (req, res) => {
  try {
    const type = req.query.type as string;
    let nextNum = 1;
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
    if (maxNum && maxNum >= startNumber) {
      nextNum = maxNum + 1;
    } else {
      nextNum = startNumber;
    }

    res.json({ nextRef: nextNum.toString() });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/documents', async (req, res) => {
  try {
    const { 
      docType, refNumber, date, items: docLines, user, inOut,
      buyer_name, buyer_city, buyer_phone, buyer_address,
      status, notes, location
    } = req.body;

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
        const whs = await tx.select({ code: warehouses.code }).from(warehouses);
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
            await tx.insert(transactions).values({
              itemId,
              type: inOut,
              quantity: qty,
              date,
              documentType: docType,
              documentRef: String(refNumber),
              user,
              location: targetLoc,
              isDeleted: 0
            });

            const dbItemResult = await tx.execute(sql`SELECT current_stock, weighted_average_cost FROM ${items} WHERE id = ${itemId}`);
            const dbItem = dbItemResult.rows[0];

            if (inOut === 'in') {
              let newAvg = dbItem.weighted_average_cost;
              const prevStock = dbItem.current_stock;
              if (prevStock <= 0) {
                newAvg = price;
              } else {
                newAvg = ((prevStock * Number(dbItem.weighted_average_cost)) + (qty * price)) / (prevStock + qty);
              }

              await tx.execute(sql`
                UPDATE ${items}
                SET stocks = jsonb_set(COALESCE(stocks, '{}'::jsonb), array[${targetLoc}], to_jsonb((COALESCE((stocks->>${targetLoc})::numeric, 0) + ${qty})::numeric)),
                    current_stock = current_stock + ${qty},
                    weighted_average_cost = ${newAvg}
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

    res.json({ success: true, docId: newDocId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/documents', async (req, res) => {
  try {
    const type = req.query.type as string;
    let docs;
    if (type) {
      docs = await orm.select().from(documents).where(and(eq(documents.type, type), eq(documents.isDeleted, 0))).orderBy(desc(documents.id));
    } else {
      docs = await orm.select().from(documents).where(eq(documents.isDeleted, 0)).orderBy(desc(documents.id));
    }
    const formattedDocs = docs.map(d => ({
        ...d,
        buyer_name: d.buyerName,
        buyer_city: d.buyerCity,
        buyer_phone: d.buyerPhone,
        buyer_address: d.buyerAddress,
        ref_number: d.refNumber
    }));
    res.json(formattedDocs);
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/documents/:id', async (req, res) => {
  try {
    const [doc] = await orm.select().from(documents).where(eq(documents.id, Number(req.params.id)));
    if (!doc) return res.status(404).json({ error: 'یافت نشد' });

    const itemsResult = await orm.execute(sql`
      SELECT di.*, i.name, i.code, i.unit, i.category
      FROM ${documentItems} di
      JOIN ${items} i ON di.item_id = i.id
      WHERE di.document_id = ${doc.id}
    `);

    const formattedDoc = {
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
    
    res.json(formattedDoc);
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/documents/:id/finalize', async (req, res) => {
  try {
    const docId = Number(req.params.id);
    const { user } = req.body;
    await orm.transaction(async (tx) => {
      const [doc] = await tx.select().from(documents).where(and(eq(documents.id, docId), eq(documents.isDeleted, 0)));
      if (!doc || doc.status === 'final') return;

      await tx.update(documents).set({ status: 'final' }).where(eq(documents.id, docId));

      const docLines = await tx.select().from(documentItems).where(eq(documentItems.documentId, docId));
      const inOut = 'out';

      for (const item of docLines) {
        const targetLoc = item.location || 'safe';
        const qty = item.quantity;

        await tx.insert(transactions).values({
          itemId: item.itemId,
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
    res.json({ success: true });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/documents/:id', async (req, res) => {
  try {
    const docId = Number(req.params.id);
    await orm.transaction(async (tx) => {
      const [doc] = await tx.select().from(documents).where(and(eq(documents.id, docId), eq(documents.isDeleted, 0)));
      if (!doc) return;

      await tx.update(documents).set({ isDeleted: 1 }).where(eq(documents.id, docId));
      await tx.execute(sql`UPDATE ${transactions} SET is_deleted = 1 WHERE document_ref = ${doc.refNumber} AND document_type = ${doc.type}`);

      const docLines = await tx.select().from(documentItems).where(eq(documentItems.documentId, docId));
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
    res.json({ success: true });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
