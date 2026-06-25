import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq, desc } from 'drizzle-orm';
import { orm } from '../db/drizzle.js';
import { users } from '../db/schema.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken); // Protect all user routes

// Users Management
router.get('/users', async (req, res) => {
  try {
    const allUsers = await orm.select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role
    }).from(users).orderBy(desc(users.id));
    
    const mapped = allUsers.map(u => ({ id: u.id, username: u.username, full_name: u.fullName, role: u.role }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { username, password, full_name, role } = req.body;
    const tUsername = (username || '').trim();
    
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const [info] = await orm.insert(users).values({
      username: tUsername,
      password: hashedPassword,
      fullName: full_name,
      role: role
    }).returning({ id: users.id });
    
    res.json({ id: info.id, username: tUsername, full_name, role });
  } catch (err: any) {
    if (err.message.includes('unique constraint') || err.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'نام کاربری تکراری است' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { password, full_name, role } = req.body;
    const updateData: any = { fullName: full_name, role };
    
    if (password) {
      const salt = bcrypt.genSaltSync(10);
      updateData.password = bcrypt.hashSync(password, salt);
    }
    
    await orm.update(users).set(updateData).where(eq(users.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await orm.delete(users).where(eq(users.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
