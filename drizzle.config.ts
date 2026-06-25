import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/inventory',
  },
  extensionsFilters: ["postgis"],
  tablesFilter: ["!spatial_ref_sys", "!geography_columns", "!geometry_columns"],
});
