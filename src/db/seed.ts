import { orm } from './drizzle.js';
import { users, categories, warehouses, appSettings, changelogs } from './schema.js';
import bcrypt from 'bcryptjs';
import { eq, sql, inArray } from 'drizzle-orm';

export async function runSeed() {
  const migrations = [
    sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_name text DEFAULT ''`,
    sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS country text DEFAULT 'ایران'`,
    sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS province text DEFAULT ''`,
    sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location text DEFAULT 'safe'`,
    sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes text DEFAULT ''`,
    sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS document_type text`,
    sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS document_ref text`,
    sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by text`,
    sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS document_id integer`,
    sql`ALTER TABLE document_items ADD COLUMN IF NOT EXISTS location text DEFAULT 'safe'`,
    sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS stocks jsonb DEFAULT '{}'::jsonb`,
    sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS color text`,
    sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS weight double precision`,
    sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS material text`,
    sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS size text`,
    sql`ALTER TABLE transactions ALTER COLUMN date TYPE timestamp USING date::timestamp`,
    sql`ALTER TABLE documents ALTER COLUMN date TYPE timestamp USING date::timestamp`,
    sql`ALTER TABLE changelogs ALTER COLUMN date TYPE timestamp USING date::timestamp`,
    sql`ALTER TABLE customers ALTER COLUMN created_at TYPE timestamp USING created_at::timestamp`,
    sql`ALTER TABLE customers ALTER COLUMN created_at SET DEFAULT now()`,
    sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_deleted integer DEFAULT 0`,
    sql`ALTER TABLE items DROP CONSTRAINT IF EXISTS items_code_unique`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS items_code_active ON items(code) WHERE is_deleted = 0`,
    sql`CREATE INDEX IF NOT EXISTS tx_item_id ON transactions(item_id)`,
    sql`CREATE INDEX IF NOT EXISTS tx_doc_id ON transactions(document_id)`,
    sql`CREATE INDEX IF NOT EXISTS tx_date ON transactions(date)`,
    sql`CREATE INDEX IF NOT EXISTS tx_type_deleted ON transactions(type, is_deleted)`,
    sql`CREATE INDEX IF NOT EXISTS items_type_deleted ON items(type, is_deleted)`,
    sql`CREATE INDEX IF NOT EXISTS items_code ON items(code)`,
    sql`CREATE INDEX IF NOT EXISTS items_category ON items(category)`,
    sql`CREATE INDEX IF NOT EXISTS docs_type_deleted ON documents(type, is_deleted)`,
    sql`CREATE INDEX IF NOT EXISTS docs_date ON documents(date)`,
    sql`CREATE INDEX IF NOT EXISTS doc_items_doc_id ON document_items(document_id)`,
    sql`CREATE INDEX IF NOT EXISTS doc_items_item_id ON document_items(item_id)`,
    sql`CREATE INDEX IF NOT EXISTS item_prices_item_id ON item_prices(item_id)`
  ];

  console.log('Starting database schema self-healing migrations...');
  for (const query of migrations) {
    const sqlText = typeof query === 'object' && 'sql' in query ? (query as any).sql : String(query);
    try {
      console.log(`Executing migration query: ${sqlText}`);
      await orm.execute(query);
      console.log(`Migration successful for: ${sqlText.substring(0, 50)}...`);
    } catch (e: any) {
      console.error(`Migration error for query [${sqlText}]:`, e.message || e);
    }
  }

  // Self-healing: Migrate data from old "user" column to "created_by" column if "user" column exists
  try {
    console.log('Migrating data from old "user" column to "created_by"...');
    await orm.execute(sql`
      UPDATE transactions 
      SET created_by = "user" 
      WHERE created_by IS NULL 
        AND EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'transactions' 
            AND column_name = 'user'
        )
    `);
    console.log('Data migration from "user" to "created_by" completed successfully.');
  } catch (e: any) {
    console.log('Skipping "user" to "created_by" migration (column "user" might not exist or already migrated):', e.message || e);
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
  const defaultCategories = [
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
    { name: 'گردنبند', prefix: 'N-', type: 'product' },
    { name: 'گوشواره میخی', prefix: 'S-', type: 'product' },
    { name: 'گوشواره آویز', prefix: 'E-', type: 'product' },
    { name: 'انگشتر', prefix: 'R-', type: 'product' },
    { name: 'دستبند', prefix: 'B-', type: 'product' }
  ];

  const existingCatRows = await orm.select().from(categories);
  const existingCatNames = new Set(existingCatRows.map(c => c.name));
  const newCategories = defaultCategories.filter(c => !existingCatNames.has(c.name));
  
  if (newCategories.length > 0) {
    await orm.insert(categories).values(newCategories);
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

  const existingSettings = await orm.select().from(appSettings).where(inArray(appSettings.key, settings.map(s => s.key)));
  const existingKeys = new Set(existingSettings.map(s => s.key));
  const newSettings = settings.filter(s => !existingKeys.has(s.key));
  if (newSettings.length > 0) {
    await orm.insert(appSettings).values(newSettings);
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
    { version: '3.0.0', date: new Date().toISOString(), features: 'اصلاح عنوان تب مرورگر به نام فارسی سامانه\nطراحی و پیاده‌سازی لایه اختصاصی Service (لایه سرویس داکیومنت) برای تفکیک منطق تراکنش‌های پیچیده مالی و انبارداری از لایه کنترلر/روت‌ها', fixes: 'بهبود ساختاریافتگی کد، افزایش قابلیت تست‌پذیری و نگهداری آسان‌تر بخش‌های تراکنشی برنامه' },
    { version: '3.0.1', date: new Date().toISOString(), features: 'افزودن قابلیت ثبت یادداشت برای تراکنش‌ها و انبارگردانی‌ها\nتکمیل لاگ‌های انبارگردانی برای نمایش کسری و اضافی', fixes: 'رفع خطای ذخیره‌سازی اسناد و انبارگردانی به دلیل فقدان ستون notes در دیتابیس\nاصلاح نوع داده‌های ورودی فاکتورها جهت جلوگیری از خطای پایگاه داده' },
    { version: '3.0.2', date: new Date().toISOString(), features: 'افزودن سیستم خود-ترمیمی خودکار دیتابیس در زمان بالا آمدن سرور برای همگام‌سازی کامل Schema دیتابیس با لایه ORM', fixes: 'رفع خطای عدم وجود ستون document_id در جدول تراکنش‌ها در زمان ثبت نهایی اسناد و انبارگردانی\nرفع مشکل عدم همگام‌سازی ستون‌های user و created_by و انتقال خودکار و امن داده‌های قدیمی به ستون استاندارد جدید' },
    { version: '3.0.3', date: new Date().toISOString(), features: 'فارسی‌سازی کامل مبالغ، قیمت‌ها، تخفیف‌ها، مقادیر و کدهای کالا در پیش‌فاکتور و فاکتور فروش چاپی و فرم ثبت نهایی فاکتور', fixes: 'رفع نمایش اعداد به فرمت انگلیسی در مبالغ فاکتور و پیش‌فاکتور' },
    { version: '3.1.0', date: new Date().toISOString(), features: 'پیاده‌سازی لایه کنترل نقش‌ها (Role-Based Access Control) جهت ارتقای امنیت عملیات ادمین و ویرایش اطلاعات\nمحاسبه معکوس بهای تمام شده کالا (میانگین وزنی WAC) هنگام حذف اسناد ورود کالا\nهمگام‌سازی توزیع موجودی انبارها (فیلد stocks JSONB) در زمان حذف تراکنش‌ها', fixes: 'برطرف کردن مسابقه همزمانی (Race Condition) در صدور پیاپی شماره مرجع اسناد و بررسی همزمان موجودی کالاها\nرفع مشکل فرآیند نهایی‌سازی اسناد ورودی (قبوض انبار و برگشتی‌ها) در لایه سرویس\nجلوگیری از تغییر مستقیم فیلدهای موجودی فیزیکی و میانگین قیمت از طریق متد ویرایش کالا جهت حفظ اصالت داده‌ها\nپایداری امنیتی توکن JWT در محیط پروداکشن در صورت عدم تعریف کلید محیطی' },
    { version: '3.2.0', date: new Date().toISOString(), features: 'تبدیل نوع فیلدهای تاریخ در دیتابیس به timestamp استاندارد برای افزایش پرفورمنس\nافزودن ایندکس‌های پیشرفته در تمامی جداول برای سرعت‌بخشیدن به کوئری‌های سنگین\nپشتیبانی از ساخت مجدد کدهای کالاهای حذف‌شده با Partial Unique Index', fixes: '' },
    { version: '3.3.0', date: new Date().toISOString(), features: 'اضافه شدن صفحه‌بندی سمت سرور و جستجو در صفحه انبارگردانی\nحفظ هوشمند ردیف‌های انبارگردانی‌شده در صورت جستجو یا تغییر صفحه', fixes: 'جلوگیری از تغییر مقادیر انبارها حین ویرایش اطلاعات کالا\nاصلاح پاکسازی فرم افزودن مشتری (ریست شدن استان، شهر و شماره‌ها)\nمدیریت و رفع حلقه ریدایرکت ۴۰۱ در ریکوئست‌های موازی' },
    { version: '3.4.0', date: new Date().toISOString(), features: 'خاموش‌شدن نرم سرور (Graceful Shutdown) برای جلوگیری از قطع ناگهانی درخواست‌ها\nکنترل یکپارچگی ارجاعی در حذف دسته‌بندی‌ها (جلوگیری از حذف دسته‌بندی‌های دارای کالا)\nتغییر مکانیسم حذف مشتریان به سافت-دیلیت (Soft-Delete) و حفظ اطلاعات مشتری در فاکتورهای قدیمی', fixes: 'اصلاح پالیسی CORS برای ارتباط امن\nفعال‌سازی ولیدیشن سخت‌گیرانه (strict) در افزودن کالا' },
    { version: '3.5.0', date: new Date().toISOString(), features: '', fixes: 'جلوگیری از کرش برنامه بر اثر تقسیم بر صفر در زمان محاسبه میانگین قیمت وزنی (WAC)\nاصلاح کشف نوع داده (Type inference) در ذخیره‌سازی JSONB در پستگرس با استفاده از کست متنی و آرایه\nرفع باگ صفحه داشبورد مدیریتی به دلیل عدم سازگاری توابع متنی روی فیلدهای timestamp' },
    { version: '3.6.0', date: new Date().toISOString(), features: 'توضیحات پویای انبارها در داشبورد بر اساس نام‌های واقعی انبارهای فعال', fixes: 'حل مشکل بحرانی ERROR: could not determine data type of parameter در رسید انبار' },
    { version: '3.7.0', date: new Date().toISOString(), features: 'استفاده از تقویم شمسی در صفحه تراکنش‌ها برای انتخاب تاریخ', fixes: 'رفع خطاهای مربوط به کوئری‌های داشبورد\nحل مشکل بروزرسانی مقادیر JSONB در پستگرس با تایپ‌کست صریح' },
    { version: '3.8.0', date: new Date().toISOString(), features: 'فیلتر بر اساس دسته‌بندی محصولات و مواد اولیه در صفحات قیمت‌گذاری و گالری', fixes: '' },
    { version: '3.8.1', date: new Date().toISOString(), features: '', fixes: 'رفع مشکل خالی بودن لیست دسته‌بندی‌ها در فیلتر کشویی صفحات قیمت‌گذاری و گالری\nاصلاح اعتبارسنجی (Validation) در ساخت دسته‌بندی‌های جدید در بخش تنظیمات' }
  ];

  const existingLogs = await orm.select().from(changelogs).where(inArray(changelogs.version, initialChangelogs.map(l => l.version)));
  const existingVersions = new Set(existingLogs.map(l => l.version));
  const newLogs = initialChangelogs.filter(l => !existingVersions.has(l.version));
  if (newLogs.length > 0) {
    await orm.insert(changelogs).values(newLogs);
  }
}
