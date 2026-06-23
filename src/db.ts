import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Store DB in a local data folder, allowing override via DB_PATH env var
const dbPathInput = process.env.DB_PATH || path.join(process.cwd(), 'data/inventory.db');
const dbPath = path.isAbsolute(dbPathInput) ? dbPathInput : path.join(process.cwd(), dbPathInput);

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

try {
  // on some network/cloud disks (like Liara volumes), WAL mode might throw disk I/O errors.
  db.pragma('journal_mode = WAL');
} catch (error) {
  console.warn('Could not set journal_mode to WAL (likely unsupported on this volume). Proceeding with default mode. Error:', error);
}

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'product' or 'raw_material'
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    current_stock REAL DEFAULT 0,
    unit TEXT NOT NULL,
    category TEXT DEFAULT '',
    image TEXT DEFAULT '',
    thumbnail TEXT DEFAULT '',
    reorder_point REAL DEFAULT 0,
    weighted_average_cost REAL DEFAULT 0,
    stock_safe REAL DEFAULT 0,
    stock_workshop REAL DEFAULT 0,
    stock_showroom REAL DEFAULT 0,
    is_deleted INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'in' or 'out'
    quantity REAL NOT NULL,
    date TEXT NOT NULL,
    document_type TEXT, -- 'invoice', 'remittance', 'manual', 'variance_shortage', 'variance_surplus'
    document_ref TEXT,
    user TEXT,
    notes TEXT,
    location TEXT DEFAULT 'safe', -- 'safe', 'workshop', 'showroom'
    is_deleted INTEGER DEFAULT 0,
    FOREIGN KEY(item_id) REFERENCES items(id)
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'receipt', 'invoice', 'return', 'remittance', 'waste', 'audit'
    ref_number TEXT NOT NULL,
    date TEXT NOT NULL,
    user TEXT,
    notes TEXT,
    buyer_name TEXT DEFAULT '',
    buyer_city TEXT DEFAULT '',
    buyer_phone TEXT DEFAULT '',
    buyer_address TEXT DEFAULT '',
    status TEXT DEFAULT 'final', -- 'final', 'proforma'
    is_deleted INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS document_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    location TEXT DEFAULT 'safe', -- 'safe', 'workshop', 'showroom'
    FOREIGN KEY(document_id) REFERENCES documents(id),
    FOREIGN KEY(item_id) REFERENCES items(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL -- 'admin', 'manager', 'viewer'
  );

  CREATE TABLE IF NOT EXISTS changelogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL,
    date TEXT NOT NULL,
    features TEXT NOT NULL,
    fixes TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    prefix TEXT NOT NULL,
    type TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 1
  );
`);

// Migration for existing tables
try {
  db.exec('ALTER TABLE items ADD COLUMN category TEXT DEFAULT ""');
} catch (e) {
}
try { db.exec('ALTER TABLE items ADD COLUMN image TEXT DEFAULT ""'); } catch (e) {}
try { db.exec('ALTER TABLE items ADD COLUMN thumbnail TEXT DEFAULT ""'); } catch (e) {}

try { db.exec('ALTER TABLE items ADD COLUMN reorder_point REAL DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE items ADD COLUMN weighted_average_cost REAL DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE items ADD COLUMN stock_safe REAL DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE items ADD COLUMN stock_workshop REAL DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE items ADD COLUMN stock_showroom REAL DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE items ADD COLUMN is_deleted INTEGER DEFAULT 0'); } catch (e) {}

try { db.exec('ALTER TABLE documents ADD COLUMN buyer_name TEXT DEFAULT ""'); } catch (e) {}
try { db.exec('ALTER TABLE documents ADD COLUMN buyer_city TEXT DEFAULT ""'); } catch (e) {}
try { db.exec('ALTER TABLE documents ADD COLUMN buyer_phone TEXT DEFAULT ""'); } catch (e) {}
try { db.exec('ALTER TABLE documents ADD COLUMN buyer_address TEXT DEFAULT ""'); } catch (e) {}
try { db.exec('ALTER TABLE documents ADD COLUMN status TEXT DEFAULT "final"'); } catch (e) {}
try { db.exec('ALTER TABLE documents ADD COLUMN is_deleted INTEGER DEFAULT 0'); } catch (e) {}

try { db.exec('ALTER TABLE document_items ADD COLUMN unit_price REAL DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE document_items ADD COLUMN discount REAL DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE document_items ADD COLUMN location TEXT DEFAULT "safe"'); } catch (e) {}

try {
  db.exec('ALTER TABLE transactions ADD COLUMN user TEXT DEFAULT ""');
} catch (e) {
}
try { db.exec('ALTER TABLE transactions ADD COLUMN location TEXT DEFAULT "safe"'); } catch (e) {}
try { db.exec('ALTER TABLE transactions ADD COLUMN is_deleted INTEGER DEFAULT 0'); } catch (e) {}

// Insert default categories if none exist
const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
if (catCount.count === 0) {
  const defaultCats = [
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
  ];
  const stmt = db.prepare('INSERT INTO categories (name, prefix, type) VALUES (?, ?, ?)');
  const insertMany = db.transaction((cats) => {
    for (const cat of cats) stmt.run(cat.name, cat.prefix, cat.type);
  });
  insertMany(defaultCats);
}

// Insert default admin if no users exist
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  db.prepare('INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)').run(
    'admin', '123456', 'مدیر سیستم', 'admin'
  );
}

// Insert default warehouses if none exist
const whCount = db.prepare('SELECT COUNT(*) as count FROM warehouses').get() as { count: number };
if (whCount.count === 0) {
  const defaultWHs = [
    { name: 'انبار اصلی', code: 'safe' }
  ];
  const stmt = db.prepare('INSERT INTO warehouses (name, code, is_active) VALUES (?, ?, 1)');
  for (const wh of defaultWHs) {
    stmt.run(wh.name, wh.code);
  }
} else {
  try {
    db.prepare("UPDATE warehouses SET name = 'انبار اصلی' WHERE code = 'safe' AND name = 'انبار گاوصندوق اصلی'").run();
  } catch (e) {}
}

// Insert default format setting if no table entry exists
const invoiceStartCheck = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('invoice_start_number');
if (!invoiceStartCheck) {
  db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run('invoice_start_number', '1000');
}

const fastCheck = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('fast_moving_days') as { value: string } | undefined;
if (!fastCheck) {
  db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run('fast_moving_days', '30');
}

const slowCheck = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('slow_moving_days') as { value: string } | undefined;
if (!slowCheck) {
  db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run('slow_moving_days', '90');
} else if (slowCheck.value === '60') {
  db.prepare('UPDATE app_settings SET value = ? WHERE key = ?').run('90', 'slow_moving_days');
}

const deadCheck = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('dead_stock_days') as { value: string } | undefined;
if (!deadCheck) {
  db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run('dead_stock_days', '180');
}

// Insert initial changelogs
const insertChangelog = (version: string, info: string, fixes: string) => {
  const exists = db.prepare('SELECT id FROM changelogs WHERE version = ?').get(version);
  if (!exists) {
    db.prepare('INSERT INTO changelogs (version, date, features, fixes) VALUES (?, ?, ?, ?)').run(
      version, new Date().toISOString(), info, fixes
    );
  }
};

insertChangelog('1.0.0', 'ایجاد ساختار اولیه سیستم\nمدیریت موجودی کالا\nصدور فاکتور و رسید', '');
insertChangelog('1.1.0', 'افزودن قابلیت ورود از فایل اکسل\nافزودن تاریخ شمسی\nاضافه شدن بخش کاربران و لاگ تغییرات', 'حل مشکل محاسبه اشتباه در مجموع تراکنش‌ها');
insertChangelog('1.2.0', 'افزودن دسته‌بندی به کالاها\nایجاد کدبندی خودکار پیشوند برای مواد اولیه\nرفع خطای تعریف جدول دیتابیس\nاصلاح سطوح دسترسی', '');
insertChangelog('1.3.0', 'جلوگیری از ثبت کد تکراری برای کالاها و مواد اولیه\nافزودن قابلیت آپلود تصویر برای کالاها با تولید خودکار نسخه بندانگشتی (Thumbnail)\nمحدودیت آپلود تصویر تا ۱۰۰ کیلوبایت', '');
insertChangelog('1.4.0', 'توسعه بخش تنظیمات برای مدیریت پویای دسته‌بندی‌ها و پیشوند‌ها\nامکان ویرایش مشخصات و سطح دسترسی کاربران توسط مدیر\nعملیات پاکسازی کل داده‌ها یا تاریخچه برای مدیران\nکدگذاری تمام اتوماتیک برای تمام کالاها', '');
insertChangelog('1.5.0', 'پیاده‌سازی تولید اتوماتیک شماره فاکتور\nامکان ثبت فاکتور نهایی و پیش فاکتور فروش\nچاپ فاکتور PDF دقیق و کامل مطابق الگو با مشخصات خریدار\nتولید رسید چاپی PDF\nاضافه شدن نمایش کاربر و ذخیره خودکار در جدول گزارش تراکنش‌ها', '');
insertChangelog('1.6.0', 'پیاده‌سازی مکانیزم تولید خودکار کد محصول با الگوی پایپتال (سال-دسته-ترنسفر-سریال)\nاصلاح واحد اندازه‌گیری گوشواره به "جفت" באופן خودکار\nرفع مشکل عدم نمایش یا خطای آپلود تصویر Thumbnail با افزایش حجم مجاز JSON', '');
insertChangelog('1.7.0', 'محدودسازی دسترسی به بخش‌های گزارش تراکنش‌ها، تنظیمات، مدیریت کاربران و تاریخچه تغییرات، تنها برای کاربران با نقش ادمین.', '');
insertChangelog('1.8.0', 'ساده‌سازی مکانیزم تولید خودکار کد محصول با وارد کردن دستی سال، دسته، ترنسفر (بدون اتصال اضافی در دیتابیس).\nثابت کردن دسته‌بندی‌های محصول با تفکیک و انتخاب حروف انگلیسی مخصوص.\nرفع اختلال ذخیره‌سازی تصاویر کالاها به دلیل محدودیت حجم ترافیک سمت سرور با ارتقای API.', '');
insertChangelog('1.9.0', 'افزودن امکان مدیریت تنظیمات عمومی، امکان تعیین شماره فاکتور پایه‌ای.\nرفع باگ ورود (Space trimming) هنگام نام کاربری.', '');
insertChangelog('1.10.0', 'افزودن قابلیت Lightbox (نمایش تصویر بزرگ) با کلیک روی تصاویر کوچک کالاها در جدول.\nرفع مشکل عدم نمایش تصویر اصلی.', '');
insertChangelog('2.0.0', 'پیاده‌سازی داشبورد تحلیلی و بصری هوشمند (BI) حاوی نمودارهای پیشرفته ارزش انبار، کارهای تندمصرف و راکد\nمدیریت انبار چندموقعیتی (تفکیک اختصاصی به گاوصندوق اصلی، کارگاه ساخت و ویترین نمایشگاه)\nپیاده‌سازی هشدار آلارم و آستانه بحرانی کسری کالا (نقطه سفارش)\nمحاسبه ارزش ریالی کل انبار بر مبنای روش میانگین متحرک موزون (WAC)\nتوسعه ماژول هوشمند انبارگردانی دوره‌ای و فیزیکی به همراه مغایرت‌گیری و محاسبه انحراف\nتوسعه مکانیزم پیشرفته حذف نرم (Soft Delete) جهت آرشیو فاقد تخریب اطلاعات اسناد و کالاها\nامکان ایمپورت و اکسپورت گروهی فایل اکسل منطبق بر داده‌های توزیع انبارها و نقطه سفارش', 'اصلاح سیستم کنترل موجودی فاکتورها به صورت موقعیت‌محور\nرفع باگ محاسبات تجمعی نمودارها با تفیلتر کارهای حذف‌شده\nرفع باگ فرآیند نهایی‌سازی پیش‌فاکتورها');
insertChangelog('2.1.0', 'پیاده‌سازی تعریف و مدیریت کاملاً پویای انبارها در بخش تنظیمات به همراه تغییر خودکار ستون‌های دیتابیس\nسازگاری ۱۰۰٪ بخش‌های انبارگردانی، ثبت فاکتور، ایجاد کالا، و قابلیت اکسل ایمپورت/اکسپورت با تمامی انبارها به صورت پویا\nجایگزینی متدهای تخریبی با فرمت‌های تعاملی پاپ‌آپ تاییدیه (ConfirmModal)', 'تسهیل مکانیسم ثبت دکمه افزودن فاکتور با اعتبارسنجی‌ها\nرفع باگ جستجوی فایل‌های منبع با مکانیسم یکپارچه لایت‌باکس');
insertChangelog('2.2.0', 'پیاده‌سازی بخش تنظیمات پیشرفته و قابلیت شخصی‌سازی دوره‌ی زمانی کالاهای تند گردش و کند گردش (راکد)\nحذف کلیدواژه‌ها و برچسب‌های موقت هوش مصنوعی (AI) از داشبورد مدیریتی جهت ساده‌سازی رابط کاربری بر مبنای منطق پایگاه داده انبار\nاصلاح الگوهای پیش‌فرض راه‌اندازی برای شروع با تنها یک انبار اصلی (روز صفر) و امکان فعال‌سازی پویای بقیه انبارها', '');
insertChangelog('2.3.0', 'توسعه فرمول تخصصی گردش کالا به سه رده مجزا: تند گردش، کند گردش و راکد.\nاضافه شدن تنظیمات پویای حد مرز بازه‌های گردش (تند گردش کمتر از ۳۰ روز، کند گردش بین ۹۰ تا ۱۸۰ روز، راکد بالای ۱۸۰ روز) به بخش تنظیمات عمومی برای تحلیل دقیق اقلام انبار.', '');
insertChangelog('2.4.0', 'بهینه‌سازی دپلوی و پایداری در پلتفرم‌های ابری (مانند لیارا) با اصلاح مسیر مپینگ دیسک‌های ابری به مسیر مطلق /app/data و پیاده‌سازی متغیر محیطی DB_PATH جهت بازنشانی منعطف فایل پایگاه‌داده.', '');

export default db;
