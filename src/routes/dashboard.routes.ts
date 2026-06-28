import { Router } from 'express';
import { sql, eq, and, gt, desc } from 'drizzle-orm';
import { orm } from '../db/drizzle.js';
import { items, transactions, users, appSettings, warehouses } from '../db/schema.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/stats', async (req, res) => {
  try {
    const [{ count: totalProducts }] = await orm.select({ count: sql<number>`count(*)` }).from(items).where(and(eq(items.type, 'product'), eq(items.isDeleted, 0)));
    const [{ count: totalMaterials }] = await orm.select({ count: sql<number>`count(*)` }).from(items).where(and(eq(items.type, 'raw_material'), eq(items.isDeleted, 0)));
    const [{ count: lowStock }] = await orm.select({ count: sql<number>`count(*)` }).from(items).where(and(eq(items.isDeleted, 0), sql`${items.currentStock} <= COALESCE(${items.reorderPoint}, 5)`));
    const [{ count: recentTx }] = await orm.select({ count: sql<number>`count(*)` }).from(transactions).where(and(eq(transactions.isDeleted, 0), sql`${transactions.date} >= (current_date - interval '7 days')::text`));
    const [{ count: userCount }] = await orm.select({ count: sql<number>`count(*)` }).from(users);

    res.json({
      totalProducts: Number(totalProducts),
      totalMaterials: Number(totalMaterials),
      lowStock: Number(lowStock),
      recentTx: Number(recentTx),
      activeUsers: Number(userCount)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard-bi-stats', async (req, res) => {
  try {
    const [fastSetting] = await orm.select().from(appSettings).where(eq(appSettings.key, 'fast_moving_days'));
    const [slowSetting] = await orm.select().from(appSettings).where(eq(appSettings.key, 'slow_moving_days'));
    const [deadSetting] = await orm.select().from(appSettings).where(eq(appSettings.key, 'dead_stock_days'));
    
    const fastDays = fastSetting ? parseInt(fastSetting.value, 10) : 30;
    const slowDays = slowSetting ? parseInt(slowSetting.value, 10) : 90;
    const deadDays = deadSetting ? parseInt(deadSetting.value, 10) : 180;

    const alarms = await orm.select({
      id: items.id, name: items.name, code: items.code, current_stock: items.currentStock, reorder_point: items.reorderPoint, unit: items.unit, type: items.type
    }).from(items).where(and(eq(items.isDeleted, 0), sql`${items.currentStock} <= ${items.reorderPoint}`, gt(items.reorderPoint, 0))).orderBy(items.currentStock);

    const fastMovingResult = await orm.execute(sql`
      SELECT i.id, i.name, i.code, i.unit, SUM(t.quantity) as total_qty, i.current_stock
      FROM ${transactions} t
      JOIN ${items} i ON t.item_id = i.id
      WHERE t.type = 'out' AND t.is_deleted = 0 AND t.date >= (current_date - (${fastDays} || ' days')::interval)::text
      GROUP BY i.id, i.name, i.code, i.unit, i.current_stock
      ORDER BY total_qty DESC
      LIMIT 5
    `);
    const fastMoving = fastMovingResult.rows;

    const slowMovingResult = await orm.execute(sql`
      SELECT id, name, code, current_stock, unit, weighted_average_cost
      FROM ${items}
      WHERE is_deleted = 0 AND current_stock > 0 
        AND id NOT IN (
          SELECT DISTINCT item_id FROM ${transactions} t
          WHERE t.type = 'out' AND t.is_deleted = 0 AND t.date >= (current_date - (${slowDays} || ' days')::interval)::text
        )
        AND id IN (
          SELECT DISTINCT item_id FROM ${transactions} t
          WHERE t.type = 'out' AND t.is_deleted = 0 AND t.date >= (current_date - (${deadDays} || ' days')::interval)::text
        )
      ORDER BY current_stock DESC
      LIMIT 5
    `);
    const slowMoving = slowMovingResult.rows;

    const deadStockResult = await orm.execute(sql`
      SELECT id, name, code, current_stock, unit, weighted_average_cost
      FROM ${items}
      WHERE is_deleted = 0 AND current_stock > 0 
        AND id NOT IN (
          SELECT DISTINCT item_id FROM ${transactions} t
          WHERE t.type = 'out' AND t.is_deleted = 0 AND t.date >= (current_date - (${deadDays} || ' days')::interval)::text
        )
        AND id IN (
          SELECT item_id FROM ${transactions} t
          WHERE t.type = 'in' AND t.is_deleted = 0
          GROUP BY item_id
          HAVING min(t.date) < (current_date - (${deadDays} || ' days')::interval)::text
        )
      ORDER BY current_stock DESC
      LIMIT 5
    `);
    const deadStock = deadStockResult.rows;

    const valResult = await orm.execute(sql`
      SELECT SUM(current_stock * COALESCE(weighted_average_cost, 0)) as total_value
      FROM ${items}
      WHERE is_deleted = 0
    `);
    const total_value = valResult.rows[0]?.total_value;

    const activeWarehouses = await orm.select({ name: warehouses.name, code: warehouses.code }).from(warehouses).where(eq(warehouses.isActive, 1));
    const distributionObj: Record<string, number> = {};
    
    if (activeWarehouses.length > 0) {
      const allItems = await orm.select({ stocks: items.stocks }).from(items).where(eq(items.isDeleted, 0));
      for (const w of activeWarehouses) {
        let whTotal = 0;
        for (const item of allItems) {
          whTotal += Number((item.stocks as any)?.[w.code] || 0);
        }
        distributionObj[w.code] = whTotal;
      }
    }

    const trendsResult = await orm.execute(sql`
      SELECT substring(date from 1 for 7) as month, type, SUM(quantity) as total
      FROM ${transactions}
      WHERE is_deleted = 0 AND date >= (current_date - interval '6 months')::text
      GROUP BY month, type
      ORDER BY month ASC
    `);
    const trends = trendsResult.rows;

    res.json({
      reorderAlarms: alarms,
      fastMoving: fastMoving,
      slowMoving: slowMoving,
      deadStock: deadStock,
      totalValuation: total_value || 0,
      locations: distributionObj,
      warehouses: activeWarehouses,
      monthlyTrends: trends,
      fastDays,
      slowDays,
      deadDays
    });
  } catch(err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
