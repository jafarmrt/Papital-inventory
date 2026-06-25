import { Router } from 'express';
import { eq, like, desc } from 'drizzle-orm';
import { orm } from '../db/drizzle.js';
import { categories, items } from '../db/schema.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/categories', async (req, res) => {
  try {
    const data = await orm.select().from(categories).orderBy(categories.type, categories.id);
    res.json(data);
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/categories', async (req, res) => {
  try {
    const { name, prefix, type } = req.body;
    const [info] = await orm.insert(categories).values({ name, prefix, type }).returning({ id: categories.id });
    res.json({ id: info.id, name, prefix, type });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const { name, prefix, type } = req.body;
    await orm.update(categories).set({ name, prefix, type }).where(eq(categories.id, Number(req.params.id)));
    res.json({ success: true });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    await orm.delete(categories).where(eq(categories.id, Number(req.params.id)));
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
