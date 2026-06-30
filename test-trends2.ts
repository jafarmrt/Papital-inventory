import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const orm = drizzle(pool);

async function run() {
  try {
    const trendsResult = await orm.execute(sql`
      SELECT to_char(date::timestamp, 'YYYY-MM') as month, type, SUM(quantity) as total
      FROM transactions
      WHERE is_deleted = 0 AND date::timestamp >= current_date - interval '6 months'
      GROUP BY to_char(date::timestamp, 'YYYY-MM'), type
      ORDER BY month ASC
    `);
    console.log("Trends:", trendsResult.rows);
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
run();
