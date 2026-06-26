import express from 'express';
import { orm } from '../db/drizzle.js';
import { items, transactions } from '../db/schema.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { desc, eq, and, sql } from 'drizzle-orm';

const router = express.Router();

router.get('/analytics/trends', authenticateToken, async (req, res) => {
  try {
    // Get last 30 days of IN/OUT transactions
    const result = await orm.execute(sql`
      SELECT 
        date,
        SUM(CASE WHEN type = 'in' THEN quantity ELSE 0 END) as total_in,
        SUM(CASE WHEN type = 'out' THEN quantity ELSE 0 END) as total_out
      FROM transactions
      WHERE date >= to_char(current_date - interval '30 days', 'YYYY-MM-DD')
        AND is_deleted = 0
      GROUP BY date
      ORDER BY date ASC
    `);
    res.json(result);
  } catch (error) {
    console.error('Error fetching trends analytics:', error);
    res.status(500).json({ error: 'خطا در دریافت اطلاعات نمودار' });
  }
});

router.get('/analytics/top-items', authenticateToken, async (req, res) => {
  try {
    const result = await orm.execute(sql`
      SELECT 
        i.name,
        SUM(t.quantity) as total_moved
      FROM transactions t
      JOIN items i ON t.item_id = i.id
      WHERE t.is_deleted = 0
      GROUP BY i.id, i.name
      ORDER BY total_moved DESC
      LIMIT 5
    `);
    res.json(result);
  } catch (error) {
    console.error('Error fetching top items analytics:', error);
    res.status(500).json({ error: 'خطا در دریافت اطلاعات پرمصرف ترین ها' });
  }
});

router.get('/analytics/low-stock', authenticateToken, async (req, res) => {
  try {
    // Items where current_stock is less than or equal to reorder_point
    const result = await orm.execute(sql`
      SELECT id, name, code, current_stock, reorder_point, unit
      FROM items
      WHERE is_deleted = 0 AND current_stock <= reorder_point AND reorder_point > 0
    `);
    res.json(result);
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({ error: 'خطا در دریافت کالاهای نیازمند سفارش' });
  }
});

export default router;
