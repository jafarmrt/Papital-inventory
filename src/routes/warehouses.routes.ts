import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { orm } from '../db/drizzle.js';
import { warehouses } from '../db/schema.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/warehouses', async (req, res) => {
  try {
    const data = await orm.select().from(warehouses).where(eq(warehouses.isActive, 1));
    res.json(data);
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/warehouses', async (req, res) => {
  try {
    const { name, code } = req.body;
    const cleanCode = code.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!cleanCode) {
      return res.status(400).json({ error: 'کد انبار نامعتبر است' });
    }

    const [info] = await orm.insert(warehouses).values({ name, code: cleanCode, isActive: 1 }).returning({ id: warehouses.id });
    res.json({ id: info.id, name, code: cleanCode, is_active: 1 });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/warehouses/:id', async (req, res) => {
  try {
    const { name } = req.body;
    await orm.update(warehouses).set({ name }).where(eq(warehouses.id, Number(req.params.id)));
    res.json({ success: true });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/warehouses/:id', async (req, res) => {
  try {
    const [wh] = await orm.select({ code: warehouses.code }).from(warehouses).where(eq(warehouses.id, Number(req.params.id))).limit(1);
    if (wh && wh.code === 'safe') {
      return res.status(400).json({ error: 'امکان حذف انبار اصلی سیستم وجود ندارد' });
    }
    await orm.update(warehouses).set({ isActive: 0 }).where(eq(warehouses.id, Number(req.params.id)));
    res.json({ success: true });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
