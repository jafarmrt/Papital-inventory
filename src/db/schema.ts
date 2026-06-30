import { pgTable, text, serial, doublePrecision, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull() // 'admin', 'manager', 'viewer'
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  prefix: text('prefix').notNull(),
  type: text('type').notNull() // 'product' or 'raw_material'
});

export const warehouses = pgTable('warehouses', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  isActive: integer('is_active').default(1)
});

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
});

export const changelogs = pgTable('changelogs', {
  id: serial('id').primaryKey(),
  version: text('version').notNull(),
  date: timestamp('date', { withTimezone: false, mode: 'string' }).notNull(),
  features: text('features').notNull(),
  fixes: text('fixes').notNull()
});

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  contactName: text('contact_name').default(''),
  country: text('country').default('ایران'),
  province: text('province').default(''),
  phone: text('phone').default(''),
  city: text('city').default(''),
  address: text('address').default(''),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  isDeleted: integer('is_deleted').default(0)
});

export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  currentStock: doublePrecision('current_stock').default(0),
  unit: text('unit').notNull(),
  category: text('category').default(''),
  image: text('image').default(''),
  thumbnail: text('thumbnail').default(''),
  reorderPoint: doublePrecision('reorder_point').default(0),
  weightedAverageCost: doublePrecision('weighted_average_cost').default(0),
  stocks: jsonb('stocks').default({}), // Replaces dynamic columns stock_safe, etc.
  color: text('color'),
  weight: doublePrecision('weight'),
  material: text('material'),
  size: text('size'),
  isDeleted: integer('is_deleted').default(0),
}, (table) => ({
  idx_type_deleted: index('items_type_deleted').on(table.type, table.isDeleted),
  idx_code: index('items_code').on(table.code),
  idx_category: index('items_category').on(table.category),
}));

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').notNull().references(() => items.id),
  documentId: integer('document_id').references(() => documents.id),
  type: text('type').notNull(), // 'in' or 'out'
  quantity: doublePrecision('quantity').notNull(),
  date: timestamp('date', { withTimezone: false, mode: 'string' }).notNull(),
  documentType: text('document_type'),
  documentRef: text('document_ref'),
  createdBy: text('created_by'),
  notes: text('notes'),
  location: text('location').default('safe'),
  isDeleted: integer('is_deleted').default(0),
}, (table) => ({
  idx_item: index('tx_item_id').on(table.itemId),
  idx_doc: index('tx_doc_id').on(table.documentId),
  idx_date: index('tx_date').on(table.date),
  idx_type_deleted: index('tx_type_deleted').on(table.type, table.isDeleted),
}));

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), 
  refNumber: text('ref_number').notNull(),
  date: timestamp('date', { withTimezone: false, mode: 'string' }).notNull(),
  user: text('user'),
  notes: text('notes'),
  buyerName: text('buyer_name').default(''),
  buyerCity: text('buyer_city').default(''),
  buyerPhone: text('buyer_phone').default(''),
  buyerAddress: text('buyer_address').default(''),
  status: text('status').default('final'),
  isDeleted: integer('is_deleted').default(0)
}, (table) => ({
  idx_type_deleted: index('docs_type_deleted').on(table.type, table.isDeleted),
  idx_date: index('docs_date').on(table.date),
}));

export const documentItems = pgTable('document_items', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').notNull().references(() => documents.id),
  itemId: integer('item_id').notNull().references(() => items.id),
  quantity: doublePrecision('quantity').notNull(),
  unitPrice: doublePrecision('unit_price').default(0),
  discount: doublePrecision('discount').default(0),
  location: text('location').default('safe')
}, (table) => ({
  idx_doc_id: index('doc_items_doc_id').on(table.documentId),
  idx_item_id: index('doc_items_item_id').on(table.itemId),
}));

export const itemPrices = pgTable('item_prices', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').notNull().references(() => items.id),
  title: text('title').notNull(),
  price: doublePrecision('price').notNull(),
  currency: text('currency').default('IRR'),
  isDeleted: integer('is_deleted').default(0),
}, (table) => ({
  idx_item_id: index('item_prices_item_id').on(table.itemId),
}));
