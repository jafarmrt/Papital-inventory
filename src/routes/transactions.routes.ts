import { Router } from 'express';
import { orm } from '../db/drizzle.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { transactions, items } from '../db/schema.js';
import { eq, desc, sql, and, gte, lte, or, ilike } from 'drizzle-orm';

const router = Router();
router.use(authenticateToken);

router.get('/transactions', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const search = req.query.search as string;
    const isExport = req.query.export === 'true';

    const conditions = [eq(transactions.isDeleted, 0)];

    if (startDate) {
      conditions.push(gte(transactions.date, startDate));
    }
    if (endDate) {
      conditions.push(lte(transactions.date, endDate + 'T23:59:59.999Z'));
    }
    if (search) {
      conditions.push(or(
        ilike(items.name, `%${search}%`),
        ilike(items.code, `%${search}%`),
        ilike(transactions.documentRef, `%${search}%`)
      ));
    }

    const whereClause = and(...conditions);

    let query = orm.select({
      id: transactions.id,
      itemId: transactions.itemId,
      type: transactions.type,
      quantity: transactions.quantity,
      date: transactions.date,
      documentType: transactions.documentType,
      documentRef: transactions.documentRef,
      user: transactions.createdBy,
      notes: transactions.notes,
      location: transactions.location,
      isDeleted: transactions.isDeleted,
      itemName: items.name,
      itemCode: items.code,
      itemUnit: items.unit,
      itemType: items.type
    })
    .from(transactions)
    .innerJoin(items, eq(transactions.itemId, items.id))
    .where(whereClause)
    .orderBy(desc(transactions.date), desc(transactions.id));

    if (!isExport && limit > 0) {
      query = query.limit(limit).offset(offset) as any;
    }

    const result = await query;

    const mappedResult = result.map(row => ({
      id: row.id,
      item_id: row.itemId,
      type: row.type,
      quantity: row.quantity,
      date: row.date,
      document_type: row.documentType,
      document_ref: row.documentRef,
      user: row.user,
      notes: row.notes,
      location: row.location,
      is_deleted: row.isDeleted,
      item_name: row.itemName,
      item_code: row.itemCode,
      item_unit: row.itemUnit,
      item_type: row.itemType
    }));

    if (isExport) {
      return res.json(mappedResult);
    }

    const totalCountQuery = await orm.select({ count: sql`count(*)`.mapWith(Number) })
      .from(transactions)
      .innerJoin(items, eq(transactions.itemId, items.id))
      .where(whereClause);
    
    const total = totalCountQuery[0].count;

    res.json({
      data: mappedResult,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/transactions/:id', authorize('admin'), async (req, res) => {
  try {
    const txId = parseInt(req.params.id);
    await orm.transaction(async (tx) => {
      const [transaction] = await tx.select().from(transactions).where(eq(transactions.id, txId));
      if (!transaction) return;

      const loc = transaction.location || 'safe';
      const qty = transaction.quantity;
      const itemId = transaction.itemId;

      const [itemData] = await tx.select({ stocks: items.stocks, currentStock: items.currentStock }).from(items).where(eq(items.id, itemId)).for('update');
      if (itemData) {
        const currentStocks = (itemData.stocks as Record<string, number>) || {};
        const currentLocStock = Number(currentStocks[loc] || 0);
        const oldTotalStock = Number(itemData.currentStock || 0);

        if (transaction.type === 'in') {
          currentStocks[loc] = currentLocStock - qty;
          await tx.update(items).set({ stocks: currentStocks, currentStock: oldTotalStock - qty }).where(eq(items.id, itemId));
        } else {
          currentStocks[loc] = currentLocStock + qty;
          await tx.update(items).set({ stocks: currentStocks, currentStock: oldTotalStock + qty }).where(eq(items.id, itemId));
        }
      }

      await tx.delete(transactions).where(eq(transactions.id, txId));
    });
    
    res.json({ success: true });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
