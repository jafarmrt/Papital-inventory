import { Router } from 'express';
import { sql, ilike, or, and, eq } from 'drizzle-orm';
import { orm } from '../db/drizzle.js';
import { customers } from '../db/schema.js';
import { authenticateToken } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();
router.use(authenticateToken);

const customerSchema = z.object({
  name: z.string().min(1, 'نام مشتری الزامی است').max(150),
  contactName: z.string().max(100).optional().default(''),
  country: z.string().max(100).optional().default('ایران'),
  province: z.string().max(100).optional().default(''),
  city: z.string().max(100).optional().default(''),
  phone: z.string().max(50).optional().default(''),
  address: z.string().max(500).optional().default(''),
  notes: z.string().max(1000).optional().default(''),
});

router.get('/customers', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const isExport = req.query.export === 'true';

    let conditions = eq(customers.isDeleted, 0) as any;
    if (search) {
      conditions = and(
        eq(customers.isDeleted, 0),
        or(
          ilike(customers.name, `%${search}%`),
          ilike(customers.phone, `%${search}%`)
        )
      ) as any;
    }

    let query = orm.select().from(customers).where(conditions);

    query = query.orderBy(customers.name) as any;
    
    if (!isExport && limit > 0) {
      query = query.limit(limit).offset(offset) as any;
    }

    const allCustomers = await query;

    if (isExport) {
      return res.json(allCustomers);
    }

    let countQuery = orm.select({ count: sql`count(*)`.mapWith(Number) }).from(customers).where(conditions);
    
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
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'اطلاعات ارسالی نامعتبر است', details: parsed.error.flatten().fieldErrors });
    }
    const { name, contactName, country, province, phone, city, address, notes } = parsed.data;
    const createdAt = new Date().toISOString();
    const [info] = await orm.insert(customers).values({ name, contactName, country, province, phone, city, address, notes, createdAt }).returning({ id: customers.id });
    res.json({ id: info.id, name, contactName, country, province, phone, city, address, notes, createdAt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/customers/:id', async (req, res) => {
  try {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'اطلاعات ارسالی نامعتبر است', details: parsed.error.flatten().fieldErrors });
    }
    const { name, contactName, country, province, phone, city, address, notes } = parsed.data;
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
    await orm.update(customers)
      .set({ isDeleted: 1 })
      .where(sql`${customers.id} = ${req.params.id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
