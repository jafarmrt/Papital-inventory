import { Router } from 'express';
import { sql, eq, and, desc, like } from 'drizzle-orm';
import { orm } from '../db/drizzle.js';
import { items, itemPrices, warehouses } from '../db/schema.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// ======== Items Endpoints ========
router.get('/items', async (req, res) => {
  try {
    const type = req.query.type as string;
    let query = orm.select().from(items).where(eq(items.isDeleted, 0)).orderBy(desc(items.id));
    
    if (type === 'product' || type === 'raw_material') {
      query = orm.select().from(items).where(and(eq(items.isDeleted, 0), eq(items.type, type))).orderBy(desc(items.id));
    }
    
    const fetchedItems = await query;
    
    // Format for frontend
    const mapped = fetchedItems.map(it => {
        const obj: any = { ...it, current_stock: it.currentStock, reorder_point: it.reorderPoint, weighted_average_cost: it.weightedAverageCost };
        const st = it.stocks as Record<string, any>;
        if (st) {
            for (const k of Object.keys(st)) {
                obj[`stock_${k}`] = Number(st[k]);
            }
        }
        return obj;
    });
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/items', async (req, res) => {
  try {
    const { type, name, code, unit, category, image, thumbnail, reorder_point, weighted_average_cost } = req.body;
    
    const [existing] = await orm.select({ id: items.id }).from(items).where(and(eq(items.code, code), eq(items.isDeleted, 0)));
    if (existing) {
      return res.status(400).json({ error: 'کد کالا تکراری است و مجاز به استفاده مجدد نیستید.' });
    }

    const whs = await orm.select({ code: warehouses.code }).from(warehouses);
    let computedStock = 0;
    const stockValues: Record<string, number> = {};
    
    for (const wh of whs) {
      const bodyKey = `stock_${wh.code}`;
      const val = req.body[bodyKey] !== undefined ? Number(req.body[bodyKey]) : 0;
      stockValues[wh.code] = val;
      computedStock += val;
    }

    const [inserted] = await orm.insert(items).values({
        type, name, code, unit, category: category || '', image: image || '', thumbnail: thumbnail || '',
        reorderPoint: Number(reorder_point || 0), weightedAverageCost: Number(weighted_average_cost || 0),
        currentStock: computedStock,
        stocks: stockValues,
        isDeleted: 0
    }).returning({ id: items.id });
    
    const responseStock: any = {};
    for (const k of Object.keys(stockValues)) responseStock[`stock_${k}`] = stockValues[k];

    res.json({ id: inserted.id, type, name, code, current_stock: computedStock, unit, category, image, thumbnail, ...responseStock, reorder_point, weighted_average_cost });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/items/:id', async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    const { name, code, unit, category, image, thumbnail, reorder_point, weighted_average_cost } = req.body;

    const [existing] = await orm.select({ id: items.id }).from(items).where(and(eq(items.code, code), eq(items.isDeleted, 0)));
    if (existing && existing.id !== itemId) {
      return res.status(400).json({ error: 'کد کالا تکراری است و متعلق به محصول دیگری می باشد.' });
    }

    const whs = await orm.select({ code: warehouses.code }).from(warehouses);
    let computedStock = 0;
    const stockValues: Record<string, number> = {};

    for (const wh of whs) {
      const bodyKey = `stock_${wh.code}`;
      const val = req.body[bodyKey] !== undefined ? Number(req.body[bodyKey]) : 0;
      computedStock += val;
      stockValues[wh.code] = val;
    }

    await orm.update(items).set({
        name, code, unit, category: category || '', image: image || '', thumbnail: thumbnail || '',
        reorderPoint: Number(reorder_point || 0), weightedAverageCost: Number(weighted_average_cost || 0),
        currentStock: computedStock,
        stocks: stockValues
    }).where(eq(items.id, itemId));
    
    res.json({ success: true });
  } catch(err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/items/:id', async (req, res) => {
  try {
    await orm.update(items).set({ isDeleted: 1 }).where(eq(items.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/items/next-product-code', async (req, res) => {
  try {
    const { year, prefix, transfer } = req.query;
    const baseCode = `${year}-${prefix}-${transfer}-`;
    const likeQuery = `${baseCode}%`;
    const fetchedItems = await orm.select({ code: items.code }).from(items).where(like(items.code, likeQuery));
    
    let maxNum = 0;
    for (const it of fetchedItems) {
      const numPart = it.code.substring(baseCode.length);
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
    
    const nextNum = maxNum + 1;
    const nextCode = `${baseCode}${nextNum.toString().padStart(2, '0')}`;
    res.json({ nextCode });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

// ======== Item Prices ========
router.get('/items/:id/prices', async (req, res) => {
  try {
    const prices = await orm.select().from(itemPrices).where(and(eq(itemPrices.itemId, Number(req.params.id)), eq(itemPrices.isDeleted, 0)));
    res.json(prices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/items/:id/prices', async (req, res) => {
  try {
    const { title, price, currency = 'IRR' } = req.body;
    const itemId = Number(req.params.id);
    const [inserted] = await orm.insert(itemPrices).values({
        itemId, title, price: Number(price), currency, isDeleted: 0
    }).returning({ id: itemPrices.id });
    res.json({ id: inserted.id, itemId, title, price, currency });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/items/prices/bulk', async (req, res) => {
  try {
    const { itemIds, percentage } = req.body;
    if (!itemIds || !Array.isArray(itemIds)) return res.status(400).json({ error: 'invalid itemIds' });
    
    const multiplier = 1 + (percentage / 100);
    
    await orm.transaction(async (tx) => {
      for (const id of itemIds) {
        await tx.execute(sql`UPDATE ${itemPrices} SET price = price * ${multiplier} WHERE item_id = ${id} AND is_deleted = 0`);
      }
    });
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/items/:id/prices/:priceId', async (req, res) => {
  try {
    await orm.update(itemPrices).set({ isDeleted: 1 }).where(and(eq(itemPrices.id, Number(req.params.priceId)), eq(itemPrices.itemId, Number(req.params.id))));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
