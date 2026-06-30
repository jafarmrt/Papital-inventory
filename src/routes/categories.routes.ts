import { Router } from 'express';
import { eq, like, desc, and } from 'drizzle-orm';
import { orm } from '../db/drizzle.js';
import { categories, items } from '../db/schema.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { z } from 'zod';

const router = Router();
router.use(authenticateToken);

const categorySchema = z.object({
  name: z.string().min(1, 'نام الزامی است').max(100),
  prefix: z.string().min(1, 'پیشوند الزامی است').max(10),
  type: z.enum(['product', 'raw_material']),
});

router.get('/categories', async (req, res) => {
  try {
    const data = await orm.select().from(categories).orderBy(categories.type, categories.id);
    res.json(data);
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/categories', authorize('admin', 'manager'), async (req, res) => {
  try {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'اطلاعات ارسالی نامعتبر است', details: parsed.error.flatten().fieldErrors });
    }
    const { name, prefix, type } = parsed.data;
    const [info] = await orm.insert(categories).values({ name, prefix, type }).returning({ id: categories.id });
    res.json({ id: info.id, name, prefix, type });
  } catch(err: any) { 
    console.error('POST /categories ERROR:', err);
    res.status(500).json({ error: err.message }); 
  }
});

router.put('/categories/:id', authorize('admin', 'manager'), async (req, res) => {
  try {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'اطلاعات ارسالی نامعتبر است', details: parsed.error.flatten().fieldErrors });
    }
    const { name, prefix, type } = parsed.data;
    await orm.update(categories).set({ name, prefix, type }).where(eq(categories.id, Number(req.params.id)));
    res.json({ success: true });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/categories/:id', authorize('admin'), async (req, res) => {
  try {
    const catId = Number(req.params.id);
    const [cat] = await orm.select().from(categories).where(eq(categories.id, catId));
    if (!cat) {
      return res.status(404).json({ error: 'دسته بندی مورد نظر یافت نشد.' });
    }

    const [hasItems] = await orm.select({ id: items.id }).from(items).where(
      and(
        eq(items.category, cat.name),
        eq(items.isDeleted, 0)
      )
    );

    if (hasItems) {
      return res.status(400).json({ error: 'امکان حذف این دسته بندی وجود ندارد؛ زیرا کالاهای فعال در سیستم به آن ارجاع داده‌اند.' });
    }

    await orm.delete(categories).where(eq(categories.id, catId));
    res.json({ success: true });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/categories/next-code', async (req, res) => {
  try {
    const { prefix } = req.query;
    if (!prefix) return res.json({ nextCode: '' });
    
    const likeQuery = `${prefix}%`;
    const itms = await orm.select({ code: items.code }).from(items).where(like(items.code, likeQuery));
    
    let maxNum = 0;
    for (const it of itms) {
      const numPart = it.code.substring((prefix as string).length);
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
    
    const nextNum = maxNum + 1;
    const nextCode = `${prefix}${nextNum.toString().padStart(3, '0')}`;
    res.json({ nextCode });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
