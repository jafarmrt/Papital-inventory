import express from 'express';
import { orm } from '../db/drizzle.js';
import { auditLogs, users } from '../db/schema.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { desc, eq, and, sql } from 'drizzle-orm';

const router = express.Router();

router.get('/audit-logs', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const logs = await orm.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit(200);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'خطا در دریافت تاریخچه فعالیت ها' });
  }
});

export default router;
