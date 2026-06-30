import { Router } from 'express';
import { desc, sql } from 'drizzle-orm';
import { orm } from '../db/drizzle.js';
import { appSettings, changelogs, transactions, documentItems, documents, items, warehouses, itemPrices, customers } from '../db/schema.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { z } from 'zod';

const router = Router();

const settingsSchema = z.object({
  settings: z.array(z.object({
    key: z.string().min(1),
    value: z.string(),
  })).min(1),
});

const clearDataSchema = z.object({
  mode: z.enum(['transactions', 'all']),
});

router.get('/system/env', (req, res) => {
  res.json({ db: process.env.DATABASE_URL ? 'set' : 'not set' });
});

router.get('/system/schema-check', async (req, res) => {
  try {
    const result = await orm.execute(sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'transactions'`);
    res.json({ columns: result });
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});

import { runSeed } from '../db/seed.js';
router.get('/system/run-seed', async (req, res) => {
  try {
    await runSeed();
    res.json({ message: 'Seed executed' });
  } catch(e: any) {
    console.error(e);
    res.status(500).json({ error: e.message, cause: e.cause ? e.cause.message : null });
  }
});

router.use(authenticateToken);

// App Settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await orm.select().from(appSettings);
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/settings', authorize('admin', 'manager'), async (req, res) => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'اطلاعات ارسالی نامعتبر است', details: parsed.error.flatten().fieldErrors });
    }
    const { settings } = parsed.data;
    await orm.transaction(async (tx) => {
      for (const item of settings) {
        await tx.insert(appSettings).values({ key: item.key, value: item.value })
          .onConflictDoUpdate({ target: appSettings.key, set: { value: item.value } });
      }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Changelogs
router.get('/changelogs', async (req, res) => {
  try {
    const logs = await orm.select().from(changelogs).orderBy(desc(changelogs.id));
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin clear data
router.post('/admin/clear-data', authorize('admin'), async (req, res) => {
  try {
    const parsed = clearDataSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'اطلاعات ارسالی نامعتبر است', details: parsed.error.flatten().fieldErrors });
    }
    const { mode } = parsed.data;
    await orm.transaction(async (tx) => {
      if (mode === 'transactions') {
        await tx.delete(transactions);
        await tx.delete(documentItems);
        await tx.delete(documents);
        await tx.update(items).set({ currentStock: 0, stocks: {} });
      } else if (mode === 'all') {
        await tx.delete(transactions);
        await tx.delete(documentItems);
        await tx.delete(documents);
        await tx.delete(itemPrices);
        await tx.delete(items);
        await tx.delete(customers);
        await tx.delete(warehouses);
        await tx.insert(warehouses).values({ name: 'انبار اصلی', code: 'safe', isActive: 1 });
      }
    });
    res.json({ success: true });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
