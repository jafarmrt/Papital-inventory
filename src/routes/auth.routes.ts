import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { orm } from '../db/drizzle.js';
import { users } from '../db/schema.js';
import { generateToken } from '../middleware/auth.js';

const router = Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const tUsername = (username || '').trim();
    
    const [user] = await orm.select().from(users).where(eq(users.username, tUsername)).limit(1);
    
    if (user) {
      const isMatch = bcrypt.compareSync(password, user.password);
      if (isMatch || password === user.password) { 
        if (password === user.password) {
          const newHash = bcrypt.hashSync(password, 10);
          await orm.update(users).set({ password: newHash }).where(eq(users.id, user.id));
        }

        const token = generateToken({ id: user.id, username: user.username, role: user.role });
        const { password: _, ...userWithoutPassword } = user;
        
        res.json({ success: true, user: { ...userWithoutPassword, full_name: user.fullName || user.username }, token });
      } else {
        res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
      }
    } else {
      res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
