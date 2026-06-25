import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import 'dotenv/config';

import { orm } from './src/db/drizzle.js';
import { users } from './src/db/schema.js';
import bcrypt from 'bcryptjs';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import authRoutes from './src/routes/auth.routes.js';
import usersRoutes from './src/routes/users.routes.js';
import systemRoutes from './src/routes/system.routes.js';
import itemsRoutes from './src/routes/items.routes.js';
import customersRoutes from './src/routes/customers.routes.js';
import categoriesRoutes from './src/routes/categories.routes.js';
import warehousesRoutes from './src/routes/warehouses.routes.js';
import transactionsRoutes from './src/routes/transactions.routes.js';
import dashboardRoutes from './src/routes/dashboard.routes.js';
import documentsRoutes from './src/routes/documents.routes.js';

async function seedAdmin() {
  try {
    const existingUsers = await orm.select().from(users).limit(1);
    if (existingUsers.length === 0) {
      console.log('No users found. Creating default admin user...');
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('admin', salt);
      await orm.insert(users).values({
        username: 'admin',
        password: hashedPassword,
        fullName: 'مدیر سیستم',
        role: 'admin'
      });
      console.log('Default admin user created: admin / admin');
    }
  } catch (err) {
    console.error('Error seeding admin user:', err);
  }
}

async function startServer() {
  try {
    console.log('Running migrations...');
    await migrate(orm, { migrationsFolder: './drizzle' });
    console.log('Migrations complete!');
  } catch (e) {
    console.error('Migration failed:', e);
  }

  await seedAdmin();

  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  // ======== API Routes ========
  app.use('/api', authRoutes);
  app.use('/api', usersRoutes);
  app.use('/api', systemRoutes);
  app.use('/api', itemsRoutes);
  app.use('/api', customersRoutes);
  app.use('/api', categoriesRoutes);
  app.use('/api', warehousesRoutes);
  app.use('/api', transactionsRoutes);
  app.use('/api', dashboardRoutes);
  app.use('/api', documentsRoutes);

  // ======== Vite Middleware ========
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      app.get('*', (req, res) => {
        res.status(404).send('Not built yet');
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
