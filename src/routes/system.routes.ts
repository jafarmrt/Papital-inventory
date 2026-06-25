import { Router } from 'express';
import { desc } from 'drizzle-orm';
import { orm } from '../db/drizzle.js';
import { appSettings, changelogs, transactions, documentItems, documents, items, warehouses } from '../db/schema.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
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

router.post('/settings', async (req, res) => {
  try {
    const { settings } = req.body;
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
router.post('/admin/clear-data', async (req, res) => {
  try {
    const { mode } = req.body;
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
        await tx.delete(items);
        await tx.delete(warehouses);
        await tx.insert(warehouses).values({ name: 'انبار اصلی', code: 'safe', isActive: 1 });
      }
    });
    res.json({ success: true });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
