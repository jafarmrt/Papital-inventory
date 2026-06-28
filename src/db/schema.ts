import { pgTable, text, serial, doublePrecision, integer, jsonb } from 'drizzle-orm/pg-core';

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
  date: text('date').notNull(),
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
  createdAt: text('created_at')
});

export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  currentStock: doublePrecision('current_stock').default(0),
  unit: text('unit').notNull(),
  category: text('category').default(''),
  image: text('image').default(''),
  thumbnail: text('thumbnail').default(''),
  reorderPoint: doublePrecision('reorder_point').default(0),
  weightedAverageCost: doublePrecision('weighted_average_cost').default(0),
  stocks: jsonb('stocks').default({}), // Replaces dynamic columns stock_safe, etc.
  isDeleted: integer('is_deleted').default(0),
});

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').notNull().references(() => items.id),
  documentId: integer('document_id').references(() => documents.id),
  type: text('type').notNull(), // 'in' or 'out'
  quantity: doublePrecision('quantity').notNull(),
  date: text('date').notNull(),
  documentType: text('document_type'),
  documentRef: text('document_ref'),
  user: text('user'),
  notes: text('notes'),
  location: text('location').default('safe'),
  isDeleted: integer('is_deleted').default(0),
});

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), 
  refNumber: text('ref_number').notNull(),
  date: text('date').notNull(),
  user: text('user'),
  notes: text('notes'),
  buyerName: text('buyer_name').default(''),
  buyerCity: text('buyer_city').default(''),
  buyerPhone: text('buyer_phone').default(''),
  buyerAddress: text('buyer_address').default(''),
  status: text('status').default('final'),
  isDeleted: integer('is_deleted').default(0)
});

export const documentItems = pgTable('document_items', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').notNull().references(() => documents.id),
  itemId: integer('item_id').notNull().references(() => items.id),
  quantity: doublePrecision('quantity').notNull(),
  unitPrice: doublePrecision('unit_price').default(0),
  discount: doublePrecision('discount').default(0),
  location: text('location').default('safe')
});

export const itemPrices = pgTable('item_prices', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').notNull().references(() => items.id),
  title: text('title').notNull(),
  price: doublePrecision('price').notNull(),
  currency: text('currency').default('IRR'),
  isDeleted: integer('is_deleted').default(0),
});
