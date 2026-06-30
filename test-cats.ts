import { config } from 'dotenv';
config();
import { orm } from './src/db/drizzle.js';
import { categories } from './src/db/schema.js';

async function run() {
  const cats = await orm.select().from(categories);
  console.log(cats);
  process.exit(0);
}
run();
