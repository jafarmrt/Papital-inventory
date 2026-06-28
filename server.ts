import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import 'dotenv/config';

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Run database seed
  try {
    await runSeed();
    logger.info('Database seeded successfully');
  } catch (error) {
    logger.error('Error seeding database:', error);
  }

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));
  app.use(morganMiddleware);

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

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

startServer();
