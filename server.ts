import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import 'dotenv/config';
import rateLimit from 'express-rate-limit';

import { logger, morganMiddleware, errorHandler } from './src/middleware/logger.js';
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
import { runSeed } from './src/db/seed.js';
import { orm } from './src/db/drizzle.js';
import { sql } from 'drizzle-orm';

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = 3000;

  // Run database seed
  try {
    await runSeed();
    logger.info('Database seeded successfully');
  } catch (error) {
    logger.error('Error seeding database:', error);
  }

  app.use(cors({ 
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', 
    credentials: true 
  }));
  app.use(express.json({ limit: '5mb' }));
  app.use(morganMiddleware);

  // Rate Limiting
  const generalLimiter = rateLimit({ 
    windowMs: 60 * 1000, 
    max: 200,
    message: { error: 'درخواستهای شما بیش از حد مجاز است' }
  });

  const loginLimiter = rateLimit({ 
    windowMs: 15 * 60 * 1000, 
    max: 10,
    message: { error: 'تلاشهای ورود بیش از حد مجاز. لطفاً ۱۵ دقیقه صبر کنید.' }
  });

  app.use('/api', generalLimiter);
  app.use('/api/login', loginLimiter);

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

  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

  app.use(errorHandler);

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

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT}`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => process.exit(0));
  });
}

startServer();
