import 'dotenv/config';
import postgres from 'postgres';

async function check() {
  const sql = postgres(process.env.DATABASE_URL as string);
  const res = await sql`SELECT * FROM users`;
  console.log(res);
  process.exit(0);
}
check();
