import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema.js';

// We use process.env.DATABASE_URL
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/inventory';

export const pool = new Pool({
  connectionString,
});

export const orm = drizzle(pool, { schema });
