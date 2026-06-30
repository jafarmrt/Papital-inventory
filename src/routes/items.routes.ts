import { Router } from 'express';
import { sql, eq, and, desc, like, or } from 'drizzle-orm';
import { orm } from '../db/drizzle.js';
import { items, itemPrices, warehouses, transactions } from '../db/schema.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { uploadBase64ToStorage } from '../lib/storage.js';

const router = Router();
router.use(authenticateToken);

const itemCreateUpdateSchema = z.object({
  body: z.preprocess((val: any) => {
    if (val && typeof val === 'object') {
      const copy = { ...val };
      for (const k of Object.keys(copy)) {
        if (k.startsWith('stock_')) {
          delete copy[k];
        }
      }
      return copy;
    }
    return val;
  }, z.object({
    type: z.enum(['product', 'raw_material']).optional(),
    name: z.string().min(2, 'نام کالا باید حداقل ۲ کاراکتر باشد'),
    code: z.string().min(1, 'کد کالا الزامی است'),
    unit: z.string().min(1, 'واحد اندازه گیری الزامی است'),
    category: z.string().optional(),
    image: z.string().optional(),
    thumbnail: z.string().optional(),
    reorder_point: z.union([z.string(), z.number()]).optional(),
    weighted_average_cost: z.union([z.string(), z.number()]).optional(),
    color: z.string().optional(),
    weight: z.union([z.string(), z.number()]).optional(),
    material: z.string().optional(),
    size: z.string().optional()
  }))
});

const itemPriceSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'عنوان قیمت الزامی است'),
    price: z.union([z.string(), z.number()]),
    currency: z.string().optional()
  })
});

// ======== Items Endpoints ========
router.get('/items', async (req, res) => {
  try {
    const type = req.query.type as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const isExport = req.query.export === 'true';

    const conditions = [eq(items.isDeleted, 0)];
    
    if (type === 'product' || type === 'raw_material') {
      conditions.push(eq(items.type, type));
    }

    if (search) {
      conditions.push(or(
        like(items.name, `%${search}%`),
        like(items.code, `%${search}%`)
      ));
    }

    const whereClause = and(...conditions);

    let query = orm.select().from(items).where(whereClause).orderBy(desc(items.id));
    
    if (!isExport && limit > 0) {
      query = query.limit(limit).offset(offset) as any;
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

    if (isExport) {
      return res.json(mapped);
    }

    const totalCountQuery = await orm.select({ count: sql`count(*)`.mapWith(Number) })
      .from(items)
      .where(whereClause);
    
    const total = totalCountQuery[0].count;

    res.json({
      data: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/items', authorize('admin', 'manager'), validate(itemCreateUpdateSchema), async (req, res) => {
  try {
    const { type, name, code, unit, category, image, thumbnail, reorder_point, weighted_average_cost, color, weight, material, size } = req.body;
    
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

    const imageUrl = image ? await uploadBase64ToStorage(image, 'image') : '';
    const thumbnailUrl = thumbnail ? await uploadBase64ToStorage(thumbnail, 'thumbnail') : '';

    const [inserted] = await orm.insert(items).values({
        type, name, code, unit, category: category || '', image: imageUrl, thumbnail: thumbnailUrl,
        reorderPoint: Number(reorder_point || 0), weightedAverageCost: Number(weighted_average_cost || 0),
        color: color || null, weight: weight ? Number(weight) : null, material: material || null, size: size || null,
        currentStock: computedStock,
        stocks: stockValues,
        isDeleted: 0
    }).returning({ id: items.id });
    
    // Create initial stock transactions if any stock was provided
    if (computedStock > 0) {
      for (const whCode of Object.keys(stockValues)) {
        const qty = stockValues[whCode];
        if (qty > 0) {
          await orm.insert(transactions).values({
            itemId: inserted.id,
            type: 'in',
            quantity: qty,
            date: new Date().toISOString().split('T')[0],
            documentType: 'audit',
            documentRef: 'ثبت اولیه کالا',
            location: whCode,
            notes: 'موجودی اولیه هنگام تعریف کالا',
            createdBy: (req as any).user?.username || 'admin',
          });
        }
      }
    }

    
    const responseStock: any = {};
    for (const k of Object.keys(stockValues)) responseStock[`stock_${k}`] = stockValues[k];

    res.json({ id: inserted.id, type, name, code, current_stock: computedStock, unit, category, image: imageUrl, thumbnail: thumbnailUrl, ...responseStock, reorder_point, weighted_average_cost, color, weight, material, size });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'کد کالا تکراری است.' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/items/:id', authorize('admin', 'manager'), validate(itemCreateUpdateSchema), async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    const { name, code, unit, category, image, thumbnail, reorder_point, weighted_average_cost, color, weight, material, size } = req.body;

    const [existing] = await orm.select({ id: items.id }).from(items).where(and(eq(items.code, code), eq(items.isDeleted, 0)));
    if (existing && existing.id !== itemId) {
      return res.status(400).json({ error: 'کد کالا تکراری است و متعلق به محصول دیگری می باشد.' });
    }

    const imageUrl = image ? await uploadBase64ToStorage(image, 'image') : undefined;
    const thumbnailUrl = thumbnail ? await uploadBase64ToStorage(thumbnail, 'thumbnail') : undefined;

    const updateData: any = {
        name, code, unit, category: category || '',
        reorderPoint: Number(reorder_point || 0),
        weightedAverageCost: Number(weighted_average_cost || 0),
        color: color || null, weight: weight ? Number(weight) : null, material: material || null, size: size || null
    };
    
    if (imageUrl !== undefined) updateData.image = imageUrl;
    if (thumbnailUrl !== undefined) updateData.thumbnail = thumbnailUrl;

    await orm.update(items).set(updateData).where(eq(items.id, itemId));
    
    res.json({ success: true });
  } catch(err: any) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'کد کالا تکراری است.' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/items/:id', authorize('admin'), async (req, res) => {
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
router.get('/items/prices/all', async (req, res) => {
  try {
    const prices = await orm.select().from(itemPrices).where(eq(itemPrices.isDeleted, 0));
    const grouped: Record<number, any[]> = {};
    for (const p of prices) {
      if (!grouped[p.itemId]) grouped[p.itemId] = [];
      grouped[p.itemId].push(p);
    }
    res.json(grouped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/items/:id/prices', async (req, res) => {
  try {
    const prices = await orm.select().from(itemPrices).where(and(eq(itemPrices.itemId, Number(req.params.id)), eq(itemPrices.isDeleted, 0)));
    res.json(prices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/items/:id/prices', validate(itemPriceSchema), async (req, res) => {
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

const bulkPriceSchema = z.object({
  itemIds: z.array(z.number().int().positive()).min(1).max(500),
  percentage: z.number().min(-100).max(1000),
});

router.post('/items/prices/bulk', async (req, res) => {
  try {
    const parsed = bulkPriceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'اطلاعات ارسالی نامعتبر است', details: parsed.error.flatten().fieldErrors });
    }
    const { itemIds, percentage } = parsed.data;
    
    const multiplier = 1 + (percentage / 100);
    
    await orm.transaction(async (tx) => {
      for (const id of itemIds) {
        const pricesToUpdate = await tx.select({ id: itemPrices.id, price: itemPrices.price })
          .from(itemPrices)
          .where(and(eq(itemPrices.itemId, id), eq(itemPrices.isDeleted, 0)))
          .for('update');
          
        for (const p of pricesToUpdate) {
          const newPrice = Number(p.price) * multiplier;
          await tx.update(itemPrices)
            .set({ price: newPrice })
            .where(eq(itemPrices.id, p.id));
        }
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
