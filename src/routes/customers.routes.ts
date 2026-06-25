import { Router } from 'express';
import { orm } from '../db/drizzle.js';
import { customers } from '../db/schema.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/customers', async (req, res) => {
  try {
    const allCustomers = await orm.select().from(customers).orderBy(customers.name);
    res.json(allCustomers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/customers', async (req, res) => {
  try {
    const { name, phone = '', city = '', address = '', notes = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'نام مشتری الزامی است.' });
    const [info] = await orm.insert(customers).values({ name, phone, city, address, notes }).returning({ id: customers.id });
    res.json({ id: info.id, name, phone, city, address, notes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
