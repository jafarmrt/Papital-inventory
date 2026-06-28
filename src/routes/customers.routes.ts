import { Router } from 'express';
import { sql, ilike, or } from 'drizzle-orm';
import { orm } from '../db/drizzle.js';
import { customers } from '../db/schema.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/customers', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const isExport = req.query.export === 'true';

    let conditions = undefined;
    if (search) {
      conditions = or(
        ilike(customers.name, `%${search}%`),
        ilike(customers.phone, `%${search}%`)
      );
    }

    let query = orm.select().from(customers);
    
    if (conditions) {
      query = query.where(conditions) as any;
    }

    query = query.orderBy(customers.name) as any;
    
    if (!isExport && limit > 0) {
      query = query.limit(limit).offset(offset) as any;
    }

    const allCustomers = await query;

    if (isExport) {
      return res.json(allCustomers);
    }

    let countQuery = orm.select({ count: sql`count(*)`.mapWith(Number) }).from(customers);
    if (conditions) {
      countQuery = countQuery.where(conditions) as any;
    }
    
    const totalCountResult = await countQuery;
    const total = totalCountResult[0].count;

    res.json({
      data: allCustomers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/customers', async (req, res) => {
  try {
    const { name, contactName = '', country = 'ایران', province = '', phone = '', city = '', address = '', notes = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'نام مشتری الزامی است.' });
    const createdAt = new Date().toISOString();
    const [info] = await orm.insert(customers).values({ name, contactName, country, province, phone, city, address, notes, createdAt }).returning({ id: customers.id });
    res.json({ id: info.id, name, contactName, country, province, phone, city, address, notes, createdAt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/customers/:id', async (req, res) => {
  try {
    const { name, contactName = '', country = 'ایران', province = '', phone = '', city = '', address = '', notes = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'نام مشتری الزامی است.' });
    await orm.update(customers)
      .set({ name, contactName, country, province, phone, city, address, notes })
      .where(sql`${customers.id} = ${req.params.id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/customers/:id', async (req, res) => {
  try {
    await orm.delete(customers).where(sql`${customers.id} = ${req.params.id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
