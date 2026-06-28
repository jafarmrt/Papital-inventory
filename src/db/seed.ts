import { orm } from './drizzle.js';
import { users, categories, warehouses, appSettings, changelogs } from './schema.js';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';

export async function runSeed() {
  try {
    await orm.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_name text DEFAULT ''`);
    await orm.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS country text DEFAULT 'ایران'`);
    await orm.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS province text DEFAULT ''`);
    await orm.execute(sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location text DEFAULT 'safe'`);
    await orm.execute(sql`ALTER TABLE document_items ADD COLUMN IF NOT EXISTS location text DEFAULT 'safe'`);
    await orm.execute(sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS stocks jsonb DEFAULT '{}'::jsonb`);
  } catch(e) {
    console.error('Migration error:', e);
  }

  // Check users
  const existingUsers = await orm.select({ count: sql<number>`count(*)` }).from(users);
  if (existingUsers[0].count === 0) {
    const hashedPassword = await bcrypt.hash('123456', 10);
    await orm.insert(users).values({
      username: 'admin',
      password: hashedPassword,
      fullName: 'مدیر سیستم',
      role: 'admin'
    });
  }

  // Check categories
  const existingCats = await orm.select({ count: sql<number>`count(*)` }).from(categories);
  if (existingCats[0].count === 0) {
    await orm.insert(categories).values([
      { name: 'ترنسفر', prefix: 'T-', type: 'raw_material' },
      { name: 'مهره', prefix: 'B-', type: 'raw_material' },
      { name: 'مهره کریستالی', prefix: 'B-C-', type: 'raw_material' },
      { name: 'سنگ', prefix: 'S-', type: 'raw_material' },
      { name: 'مهره حدید', prefix: 'B-H-', type: 'raw_material' },
      { name: 'مهره چوبی', prefix: 'B-W-', type: 'raw_material' },
      { name: 'خرج کار', prefix: 'M-', type: 'raw_material' },
      { name: 'خرج کار طلایی', prefix: 'M-G-', type: 'raw_material' },
      { name: 'خرج کار برنزی', prefix: 'M-B-', type: 'raw_material' },
      { name: 'خرج کار استیل', prefix: 'M-M-', type: 'raw_material' },
      { name: 'بند چرمی و زنجیر', prefix: 'C-', type: 'raw_material' },
      { name: 'کیلر، رنگ، گلیز', prefix: 'G-', type: 'raw_material' },
      { name: 'سایر اقلام', prefix: 'O-', type: 'raw_material' },
      { name: 'محصول نهایی', prefix: 'PR-', type: 'product' }
    ]);
  }

  // Check warehouses
  const existingWHs = await orm.select({ count: sql<number>`count(*)` }).from(warehouses);
  if (existingWHs[0].count === 0) {
    await orm.insert(warehouses).values([
      { name: 'انبار اصلی', code: 'safe', isActive: 1 }
    ]);
  }

  // Settings
  const settings = [
    { key: 'invoice_start_number', value: '1000' },
    { key: 'fast_moving_days', value: '30' },
    { key: 'slow_moving_days', value: '90' },
    { key: 'dead_stock_days', value: '180' }
  ];

  for (const s of settings) {
    const existing = await orm.select().from(appSettings).where(eq(appSettings.key, s.key));
    if (existing.length === 0) {
      await orm.insert(appSettings).values(s);
    }
  }

  // Changelogs
  const initialChangelogs = [
    { version: '1.0.0', date: '2023-12-01', features: 'ایجاد ساختار اولیه سیستم\nمدیریت موجودی کالا\nصدور فاکتور و رسید', fixes: '' },
    { version: '2.5.0', date: new Date().toISOString(), features: 'مهاجرت دیتابیس به PostgreSQL با Drizzle ORM\nحذف کدهای زائد SQLite\nبهبود عملکرد کوئری‌های فاکتور و رسید', fixes: 'حذف فایل‌های اضافه و منسوخ\nاصلاح روت تراکنش‌ها' },
    { version: '2.5.1', date: new Date().toISOString(), features: 'پاکسازی نهایی فایل‌های دیتابیس', fixes: 'حذف کامل دایرکتوری data و فایل‌های دیتابیس محلی SQLite که دیگر استفاده نمی‌شدند' },
    { version: '2.6.0', date: new Date().toISOString(), features: 'اضافه شدن سیستم Logging حرفه‌ای با Winston و Morgan در بک‌اند\nجایگزینی تمام هشدارهای سیستمی (Alert) با پیام‌های پاپ‌آپ زیبا (Toast) در فرانت‌اند', fixes: 'بهبود مدیریت خطاها و لاگ‌ها برای محیط پروداکشن' },
    { version: '2.7.0', date: new Date().toISOString(), features: 'افزودن سیستم اعتبارسنجی (Validation) سمت سرور با استفاده از Zod\nافزایش امنیت و پایداری سیستم در برابر داده‌های نامعتبر', fixes: 'جلوگیری از خطاهای دیتابیس با بررسی دقیق ورودی‌ها پیش از پردازش' },
    { version: '2.8.0', date: new Date().toISOString(), features: 'اضافه شدن محدودیت‌های یکپارچگی (Foreign Keys و Unique) در دیتابیس\nمهاجرت تصاویر از Base64 به ذخیره‌سازی فایل (Object Storage/File System)\nبهبود مشکل N+1 در صفحه قیمت‌گذاری', fixes: 'رفع مشکل Race Condition در محاسبه میانگین قیمت\nجلوگیری از ثبت موجودی منفی\nاصلاح مقداردهی created_at در مشتریان' },
    { version: '2.9.0', date: new Date().toISOString(), features: 'اضافه شدن امکان ویرایش و حذف در مدیریت مشتریان\nامکان انتخاب انبار در رسیدهای ورود کالا\nپشتیبانی از مقادیر اعشاری در انبارگردانی فیزیکی کالاها و مواد اولیه وزنی\nافزودن قابلیت دسته‌بندی و صفحه‌بندی در صفحات کالاها و مشتریان برای بهبود سرعت رندر', fixes: 'رفع باگ متن‌های انگلیسی باقیمانده در داشبورد\nحذف نمایش وضعیت سرور ثابت از منوی سایدبار\nرفع خطای عدم وجود دایرکتوری logs در حین راه‌اندازی بک‌اند با ایجاد خودکار پوشه قبل از راه‌اندازی Winston' },
    { version: '2.9.1', date: new Date().toISOString(), features: 'بهبود پایداری صفحه گالری در مواجهه با اقلام فاقد نام یا کد\nرفع مشکل تبدیل نوع داده‌های تاریخ در دیتابیس PostgreSQL', fixes: 'رفع کرش صفحه گالری تصاویر\nرفع خطای داشبورد تحلیلی به دلیل مقایسه تاریخ با نوع Text در PostgreSQL' },
    { version: '3.0.0', date: new Date().toISOString(), features: 'اصلاح عنوان تب مرورگر به نام فارسی سامانه\nطراحی و پیاده‌سازی لایه اختصاصی Service (لایه سرویس داکیومنت) برای تفکیک منطق تراکنش‌های پیچیده مالی و انبارداری از لایه کنترلر/روت‌ها', fixes: 'بهبود ساختاریافتگی کد، افزایش قابلیت تست‌پذیری و نگهداری آسان‌تر بخش‌های تراکنشی برنامه' }
  ];

  for (const log of initialChangelogs) {
    const existing = await orm.select().from(changelogs).where(eq(changelogs.version, log.version));
    if (existing.length === 0) {
      await orm.insert(changelogs).values(log);
    }
  }
}
