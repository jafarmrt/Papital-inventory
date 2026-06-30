# AI Agent Instructions

This project has specific architectural constraints discovered during development. You MUST adhere to these rules when modifying code:

## Drizzle ORM & Postgres Rules
1. **NO RAW SQL FOR MUTATIONS:** Never use `tx.execute(sql\`UPDATE ...\`)` or raw SQL with bindings for inserts/updates, especially when dealing with math operations or `jsonb` columns. `node-postgres` struggles with parameter casting and will throw `operator is not unique: unknown * unknown` errors.
2. **Update Pattern:** Always use the Read-Calculate-Update pattern. Fetch the row using `tx.select()`, perform all mathematical or JSON object mutations in standard TypeScript, and save it using `tx.update().set()`.
3. **Row Locking:** When querying data that will be updated in the same transaction (e.g. checking stock limits), use `.for('update')`. DO NOT use `.forUpdate()` as it does not exist in the current Drizzle API version.

## Business Logic
- **Inventory tracking:** Stored globally in `current_stock` and per-location in a `jsonb` column named `stocks`. Both must be kept in sync.
- **Weighted Average Cost (WAC):** Updated ONLY on stock 'in' events. If current stock is <= 0, new WAC is simply the new unit price.
- **Soft Deletes:** Always filter with `.where(eq(table.isDeleted, 0))` on reads.

## Localization
- **Dates:** Store dates as standard timestamps. Use JavaScript's `Intl.DateTimeFormat('fa-IR')` for grouping or displaying dates in the Persian (Jalali) calendar on the frontend or API layer.
