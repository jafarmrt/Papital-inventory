# Changelog

All notable changes to this project will be documented in this file.

## [3.8.2] - 2026-06-29
### Fixed
- **Postgres JSONB Array Type Inference (`operator is not unique: unknown * unknown`):** Completely removed raw PostgreSQL calculations (`tx.execute(sql...)`) inside `document.service.ts` and `transactions.routes.ts` in favor of Drizzle ORM native TypeScript update models (`tx.update(...)`). This resolves persistent parameter casting issues that caused stock update crashes (particularly when multiplying prices or adding quantities via raw `$N` params).
- **Dashboard Shamsi Dates for Monthly Trends:** Fixed the monthly trend logic on the dashboard which previously used standard Gregorian dates. Processed dates via standard JavaScript Internationalization (`Intl.DateTimeFormat`) in Persian localization for rendering the BI trend chart.

## [3.8.1] - 2026-06-29
### Fixed
- **Category Filter Dropdown:** Fixed an issue where the category dropdown in Pricing and Gallery pages was empty. Removed strict type filtering and fixed Zod schema validation to allow 'raw_material' enum.

## [3.8.0] - 2026-06-29
### Added
- **Category Filtering in Pricing and Gallery:** Implemented dynamic category dropdowns in the Pricing and Gallery pages. Users can now filter items not only by product/raw material type but also by their specific categories (e.g., necklaces, bracelets, transfers).

## [3.7.0] - 2026-06-29
### Changed
- **Shamsi (Jalali) DatePicker on Transactions Page:** Replaced standard Gregorian calendar `<input type="date">` tags on the "Transactions and Item Flow" page with the Persian Shamsi DatePicker (`react-multi-date-picker` with `persian` calendar and `persian_fa` locale), matching the rest of the application. Handled automatic backend conversions by parsing Persian selected dates to standard ISO/Gregorian `YYYY-MM-DD` strings before querying database routes.

## [3.6.0] - 2026-06-29
### Added
- **Dynamic Warehouse Description on Dashboard:** Replaced the hardcoded Persian message in the Dashboard component with a dynamically computed string that aggregates and formats active warehouse names (e.g. joining "گاوصندوق", "ویترین", etc. with Persian comma separator) dynamically.

### Fixed
- **Postgres Untyped Parameter in Array Constructor:** Completely fixed the critical database error `ERROR: could not determine data type of parameter $1` when finalising warehouse receipt documents by casting the array elements explicitly to text: `ARRAY[${targetLoc}::text]` and `ARRAY[${loc}::text]`. This ensures the PostgreSQL driver and database engine can successfully infer parameter types during execution of JSONB paths inside `jsonb_set` updates.

## [3.5.0] - 2026-06-29
### Fixed
- **Warehouse Receipt stock calculation (Division-by-Zero prevention):** Resolved a critical crash during stock updates for inbound/outbound transactions. Added rigorous mathematical checks inside PostgreSQL `CASE` statements to avoid division by zero when calculating `weighted_average_cost` on zero/negative stock offsets. Integrated `COALESCE` defaults to protect against null properties.
- **Postgres text-array casting error:** Fixed parameter identification error in JSONB path updates by explicitly casting location index arrays to `ARRAY[${loc}]::text[]`.
- **Dashboard failure (Timestamp types):** Corrected dashboard business intelligence analytics queries to compare transaction `date` values as true `timestamp` objects rather than strings (`::text`), and resolved monthly formatting with standard `to_char(date, 'YYYY-MM')`.

## [3.4.0] - 2026-06-29
### Added
- **Graceful Shutdown (6.1):** Configured signal listeners inside `server.ts` to capture `SIGTERM` and `SIGINT` and shut down active HTTP server operations gracefully before process exit.
- **Reference Integrity Checks for Categories (6.4):** Configured deletion barriers on product categories. The server now checks for active items referencing the target category and blocks deletion to prevent catalog corruption.
- **Customers Soft-Delete (6.4):** Migrated database schema and self-healing migrations to add an `is_deleted` column to the `customers` table, and updated client and server APIs to use soft-deletion instead of hard deletion.

### Changed
- **Strict Payload Validations (6.3):** Replaced `.passthrough()` validation with `.strict()` mode on `itemCreateUpdateSchema` in `src/routes/items.routes.ts`. Added a Zod `preprocess` sanitization layer to strip dynamic `stock_*` properties from payloads prior to strict validation.
- **CORS Policies (6.2):** Reconfigured general Express CORS policies in `server.ts` to strictly authenticate `FRONTEND_URL` and enable credentials transmission securely.

## [3.3.0] - 2026-06-29
### Added
- **Server-Side Pagination & Search in Inventory Audit:** Configured server-side pagination, search queries, and filtering for the `InventoryAuditPage` to handle large catalogs.
- **Robust Audit State Preservation:** Created a mapping state (`auditedItemsMap`) synced with a React reference to prevent counted item losses during search changes or page navigation.

### Fixed
- **ItemsPage Edit Stock Fix:** Excluded `stock_*` allocation values from payloads when editing existing products to prevent stock values from being modified or corrupted during item detail updates.
- **CustomersPage Form Reset Fix:** Corrected customer form initialization by calling a complete `resetForm` function to properly clean up `contactName`, `country`, `province`, and multiple phone lists.
- **Concurrent 401 Redirect Prevention:** Introduced a redirection guard (`isRedirecting`) inside the `fetchJson` utility to secure routes and prevent browser refresh/redirect loops from multiple parallel unauthorized requests.

## [3.2.0] - 2026-06-29
### Changed
- **Database Column Migration:** Converted all date columns (`transactions.date`, `documents.date`, `changelogs.date`, `customers.createdAt`) from simple `text` representation to high-performance, standardized `timestamp` columns in both schema definitions and dynamic self-healing database migrations.

### Added
- **Performance Indexes:** Implemented critical database indexes on `transactions` (`idx_item`, `idx_doc`, `idx_date`, `idx_type_deleted`), `items` (`idx_type_deleted`, `idx_code`, `idx_category`), `documents` (`idx_type_deleted`, `idx_date`), `document_items` (`idx_doc_id`, `idx_item_id`), and `item_prices` (`idx_item_id`).
- **Soft-Delete Safe Partial Unique Index:** Dropped standard absolute uniqueness constraint on item `code` columns and replaced it with a conditional partial unique index (`items_code_active`) to allow code reuse after deletion (`WHERE is_deleted = 0`).

## [3.1.0] - 2026-06-29
### Added
- **Role-Based Access Control (RBAC):** Added `authorize` middleware in `src/middleware/authorize.ts` to secure admin and manager-level operations on products, categories, users, documents, warehouses, and transactions.
- **Zod Input Validation:** Implemented strict input schemas and validations on category creation/updates, warehouse creation/updates, customer creation/updates, bulk price changes, settings, and clear-data endpoints.
- **Rate Limiting:** Added `express-rate-limit` to limit overall API requests to 200 requests per minute, and `/api/login` requests to 10 attempts per 15 minutes to prevent brute-force attacks.

### Fixed
- **Race Conditions:** Secured database locks using `FOR UPDATE` queries in `getNextRef` reference number generation and the stock check routines.
- **Draft Finalization:** Fixed `finalizeDocument` to correctly process both incoming ('receipt'/'return') and outgoing ('out'/'delivery') draft types.
- **Weighted Average Cost (WAC):** Implemented back-calculation of WAC when removing receipt documents or deleting incoming transactions to ensure correct asset valuation.
- **Inventory Discrepancies:** Updated transaction deletion handlers to synchronize and update the `stocks` JSONB distribution field along with the total stock count.
- **URL Configuration:** Removed database URL leaks from public endpoints.
- **JWT Protection:** Fixed JWT fallback to enforce runtime security in production and prevent token forging.
