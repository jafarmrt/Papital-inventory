import React, { useEffect, useState } from 'react';
import { fetchJson } from '../api';
import { Settings, Trash2, Edit2, Plus, AlertTriangle } from 'lucide-react';
import { User, Category } from '../types';
import ConfirmModal from '../components/ConfirmModal';

interface Warehouse {
  id: number;
  name: string;
  code: string;
  is_active: number;
}

export default function SettingsPage({ currentUser }: { currentUser: User }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [appSettings, setAppSettings] = useState<{key: string, value: string}[]>([]);
  const [invoiceStartNum, setInvoiceStartNum] = useState('1000');
  const [fastMovingDays, setFastMovingDays] = useState('30');
  const [slowMovingDays, setSlowMovingDays] = useState('90');
  const [deadStockDays, setDeadStockDays] = useState('180');
  const [showCatModal, setShowCatModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [catForm, setCatForm] = useState({ id: 0, name: '', prefix: '', type: 'raw_material' });
  const [clearMode, setClearMode] = useState<'transactions' | 'all'>('transactions');
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; catId: number }>({ isOpen: false, catId: 0 });

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [whForm, setWhForm] = useState({ id: 0, name: '', code: '' });
  const [showWhModal, setShowWhModal] = useState(false);
  const [whConfirmState, setWhConfirmState] = useState<{ isOpen: boolean; whId: number }>({ isOpen: false, whId: 0 });

  const loadCategories = () => {
    fetchJson('/categories').then(setCategories).catch(console.error);
  };

  const loadSettings = () => {
    fetchJson('/settings').then(data => {
      setAppSettings(data);
      const startNum = data.find((s: any) => s.key === 'invoice_start_number');
      if (startNum) setInvoiceStartNum(startNum.value);

      const fastDaysSetting = data.find((s: any) => s.key === 'fast_moving_days');
      if (fastDaysSetting) setFastMovingDays(fastDaysSetting.value);

      const slowDaysSetting = data.find((s: any) => s.key === 'slow_moving_days');
      if (slowDaysSetting) setSlowMovingDays(slowDaysSetting.value);

      const deadDaysSetting = data.find((s: any) => s.key === 'dead_stock_days');
      if (deadDaysSetting) setDeadStockDays(deadDaysSetting.value);
    }).catch(console.error);
  };

  const loadWarehouses = () => {
    fetchJson('/warehouses').then(setWarehouses).catch(console.error);
  };

  useEffect(() => {
    loadCategories();
    loadSettings();
    loadWarehouses();
  }, []);

  const handleSaveSettings = async () => {
    try {
      await fetchJson('/settings', {
        method: 'POST',
        body: JSON.stringify({
          settings: [
            { key: 'invoice_start_number', value: invoiceStartNum },
            { key: 'fast_moving_days', value: fastMovingDays },
            { key: 'slow_moving_days', value: slowMovingDays },
            { key: 'dead_stock_days', value: deadStockDays }
          ]
        })
      });
      alert('تنظیمات عمومی ذخیره شد');
    } catch(err) { alert('خطا در ذخیره تنظیمات'); }
  };

  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (catForm.id) {
        await fetchJson(`/categories/${catForm.id}`, {
          method: 'PUT',
          body: JSON.stringify(catForm)
        });
      } else {
        await fetchJson('/categories', {
          method: 'POST',
          body: JSON.stringify(catForm)
        });
      }
      setShowCatModal(false);
      setCatForm({ id: 0, name: '', prefix: '', type: 'raw_material' });
      loadCategories();
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت');
    }
  };

  const handleCatDelete = async (id: number) => {
    setConfirmState({ isOpen: true, catId: id });
  };

  const executeCatDelete = async () => {
    const id = confirmState.catId;
    try {
      await fetchJson(`/categories/${id}`, { method: 'DELETE' });
      loadCategories();
      setConfirmState({ isOpen: false, catId: 0 });
    } catch (err: any) {
      alert('خطا در حذف');
    }
  };

  const handleWhSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (whForm.id) {
        await fetchJson(`/warehouses/${whForm.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: whForm.name })
        });
      } else {
        await fetchJson('/warehouses', {
          method: 'POST',
          body: JSON.stringify(whForm)
        });
      }
      setShowWhModal(false);
      setWhForm({ id: 0, name: '', code: '' });
      loadWarehouses();
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت انبار');
    }
  };

  const handleWhDelete = (id: number) => {
    setWhConfirmState({ isOpen: true, whId: id });
  };

  const executeWhDelete = async () => {
    const id = whConfirmState.whId;
    try {
      await fetchJson(`/warehouses/${id}`, { method: 'DELETE' });
      loadWarehouses();
      setWhConfirmState({ isOpen: false, whId: 0 });
    } catch (err: any) {
      alert(err.message || 'خطا در حذف انبار');
    }
  };

  const handleClearData = async () => {
    if (prompt(`برای تایید کلمه DELETE را وارد کنید`) !== 'DELETE') {
      alert('عملیات لغو شد');
      return;
    }

    try {
      await fetchJson('/admin/clear-data', {
        method: 'POST',
        body: JSON.stringify({ mode: clearMode })
      });
      alert('اطلاعات با موفقیت پاک شد');
      setShowClearModal(false);
    } catch (err: any) {
      alert(err.message || 'خطا در عملیات پاکسازی');
    }
  };

  if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
    return <div className="p-8 text-center text-slate-500">عدم دسترسی</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-slate-200 text-slate-700 rounded-xl">
          <Settings size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">تنظیمات سامانه</h1>
          <p className="text-slate-500 text-sm mt-1">مدیریت دسته‌بندی‌ها و داده‌های پایه</p>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm p-6 mb-6">
        <h3 className="font-bold border-b pb-3 mb-4 text-slate-800">⚙️ تنظیمات عمومی</h3>
        <div className="space-y-6">
          <div className="grid md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700">شماره شروع فاکتور چاپی</label>
              <input 
                type="text" 
                value={invoiceStartNum} 
                onChange={e => setInvoiceStartNum(e.target.value)} 
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-left bg-white text-slate-800" 
                dir="ltr"
              />
              <p className="text-xs text-slate-500 mt-1">شماره فاکتور بعدی از این عدد شروع خواهد شد.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700">تند گردش (کمتر از چند روز)</label>
              <input 
                type="number" 
                min="1"
                value={fastMovingDays} 
                onChange={e => setFastMovingDays(e.target.value)} 
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-left bg-white text-slate-800" 
                dir="ltr"
              />
              <p className="text-xs text-slate-500 mt-1">کالاهایی که در این بازه خروج داشته باشند.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700">کند گردش (بیشتر از چند روز)</label>
              <input 
                type="number" 
                min="1"
                value={slowMovingDays} 
                onChange={e => setSlowMovingDays(e.target.value)} 
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-left bg-white text-slate-800" 
                dir="ltr"
              />
              <p className="text-xs text-slate-500 mt-1">شروع بازه بدون خروج متوسط (مثلا ۹۰ روز).</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700">کالای راکد (بیشتر از چند روز)</label>
              <input 
                type="number" 
                min="1"
                value={deadStockDays} 
                onChange={e => setDeadStockDays(e.target.value)} 
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-left bg-white text-slate-800" 
                dir="ltr"
              />
              <p className="text-xs text-slate-500 mt-1">شروع بازه بدون خروج طولانی (مثلا ۱۸۰ روز).</p>
            </div>
          </div>
          
          <div className="flex justify-end pt-4 border-t">
            <button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
              ذخیره تنظیمات
            </button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-xl shadow-sm flex flex-col min-h-[400px]">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
            <h3 className="font-bold flex items-center gap-2">📂 دسته‌بندی کالاها / مواد اولیه</h3>
            <button 
              onClick={() => { setCatForm({ id: 0, name: '', prefix: '', type: 'raw_material' }); setShowCatModal(true); }}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <Plus size={14} /> جدید
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-slate-500 border-b sticky top-0">
                <tr>
                  <th className="p-3 font-medium">نام دسته</th>
                  <th className="p-3 font-medium">پیشوند کد</th>
                  <th className="p-3 font-medium">نوع</th>
                  <th className="p-3 font-medium text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y relative">
                {categories.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-medium text-slate-800">{c.name}</td>
                    <td className="p-3 font-mono text-slate-600 text-left" dir="ltr">{c.prefix}</td>
                    <td className="p-3 text-xs text-slate-500">{c.type === 'product' ? 'محصول نهایی' : 'مواد اولیه'}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setCatForm(c); setShowCatModal(true); }} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded transition-colors inline-block">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleCatDelete(c.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded transition-colors inline-block">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border rounded-xl shadow-sm flex flex-col min-h-[400px]">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold flex items-center gap-2 text-slate-800">🏭 مدیریت و تعریف انبارها</h3>
              <button 
                onClick={() => { setWhForm({ id: 0, name: '', code: '' }); setShowWhModal(true); }}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors flex items-center gap-1"
              >
                <Plus size={14} /> انبار جدید
              </button>
            </div>
            
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-500 border-b sticky top-0">
                  <tr>
                    <th className="p-3 font-medium">نام انبار</th>
                    <th className="p-3 font-medium">کد سیستم</th>
                    <th className="p-3 font-medium text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {warehouses.map(w => (
                    <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-medium text-slate-800">{w.name}</td>
                      <td className="p-3 font-mono text-slate-500 text-left" dir="ltr">{w.code}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => { setWhForm({ id: w.id, name: w.name, code: w.code }); setShowWhModal(true); }} 
                            className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded transition-colors"
                            title="ویرایش نام انبار"
                          >
                            <Edit2 size={14} />
                          </button>
                          {w.code !== 'safe' && (
                            <button 
                              onClick={() => handleWhDelete(w.id)} 
                              className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded transition-colors"
                              title="غیرفعال‌سازی"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {warehouses.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-slate-400">هیچ انباری یافت نشد.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {currentUser.role === 'admin' && (
            <div className="bg-white border-red-200 border rounded-xl shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-2 text-red-600 border-b border-red-100 pb-4 mb-4">
                <AlertTriangle size={24} />
                <h3 className="font-bold text-lg">عملیات خطرناک (تنها برای مدیر)</h3>
              </div>
              
              <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                <h4 className="font-bold text-red-800 mb-2">پاکسازی اطلاعات نرم‌افزار</h4>
                <p className="text-sm text-red-700 mb-4 leading-relaxed">
                  در این بخش می‌توانید داده‌های ثبت‌شده را به صورت کامل پاک کنید. پس از تایید این عملیات، داده‌ها قابل بازگشت نیستند.
                </p>
                <button onClick={() => setShowClearModal(true)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
                  پاکسازی دیتابیس
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCatModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">{catForm.id ? 'ویرایش دسته‌بندی' : 'ثبت دسته‌بندی جدید'}</h3>
              <button type="button" onClick={() => setShowCatModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={handleCatSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">نام دسته‌بندی</label>
                <input required type="text" value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">پیشوند کد (انگلیسی)</label>
                <input required type="text" value={catForm.prefix} onChange={e => setCatForm({...catForm, prefix: e.target.value})} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-left" dir="ltr" placeholder="مثال: T-" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">نوع کالا</label>
                <select value={catForm.type} onChange={e => setCatForm({...catForm, type: e.target.value})} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="raw_material">مواد اولیه</option>
                  <option value="product">محصول نهایی</option>
                </select>
              </div>
              
              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setShowCatModal(false)} className="px-4 py-2 border rounded text-sm hover:bg-slate-50 transition-colors">انصراف</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors">ثبت دسته‌بندی</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showClearModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden border-2 border-red-500">
            <div className="px-6 py-4 border-b bg-red-50 border-red-100 flex justify-between items-center text-red-600">
              <h3 className="font-bold text-lg flex items-center gap-2"><AlertTriangle size={20} /> هشدار امنیتی</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm font-medium text-slate-700">داده‌هایی که می‌خواهید پاک کنید را انتخاب کنید:</p>
              
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500 transition-all">
                  <input type="radio" name="clearMode" value="transactions" checked={clearMode === 'transactions'} onChange={() => setClearMode('transactions')} className="mt-1" />
                  <div>
                    <div className="font-bold text-sm">حذف تاریخچه تراکنش‌ها</div>
                    <div className="text-xs text-slate-500 mt-1">تمامی فاکتورها، رسیدها و تراکنش‌ها پاک می‌شود. موجودی همه کالاها صفر خواهد شد ولی خود کالاها باقی می‌مانند.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 has-[:checked]:bg-red-50 has-[:checked]:border-red-500 transition-all">
                  <input type="radio" name="clearMode" value="all" checked={clearMode === 'all'} onChange={() => setClearMode('all')} className="mt-1" />
                  <div>
                    <div className="font-bold text-sm text-red-600">حذف کل اطلاعات (کالاها و تراکنش‌ها)</div>
                    <div className="text-xs text-slate-500 mt-1">سیستم کاملا به حالت اولیه برمی‌گردد. کالاها، مواد اولیه و تراکنش‌ها همگی حذف می‌شوند.</div>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button onClick={() => setShowClearModal(false)} className="px-4 py-2 border rounded text-sm hover:bg-slate-50 transition-colors">انصراف</button>
                <button onClick={handleClearData} className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors">تایید و حذف دائمی</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showWhModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">{whForm.id ? 'ویرایش نام انبار' : 'تعریف انبار جدید'}</h3>
              <button type="button" onClick={() => setShowWhModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={handleWhSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">نام انبار (فارسی)</label>
                <input required type="text" value={whForm.name} onChange={e => setWhForm({...whForm, name: e.target.value})} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500" placeholder="مثال: انبار قطعات و ملزومات" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">کد انحصاری سیستم (انگلیسی و کوچک)</label>
                <input 
                  required 
                  disabled={!!whForm.id}
                  type="text" 
                  value={whForm.code} 
                  onChange={e => setWhForm({...whForm, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})} 
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-left" 
                  dir="ltr" 
                  placeholder="مثال: accessories" 
                />
                {!whForm.id && <p className="text-xs text-slate-500 mt-1">این کد به عنوان کلید دیتابیس بکار می‌رود و پس از ثبت تغییری نمیکند.</p>}
              </div>
              
              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setShowWhModal(false)} className="px-4 py-2 border rounded text-sm hover:bg-slate-50 transition-colors">انصراف</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 transition-colors">ثبت انبار</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmState.isOpen}
        message="آیا از حذف این دسته‌بندی اطمینان دارید؟ تمامی کالاها و مواد اولیه‌ای که تحت این دسته‌بندی تعریف شده‌اند بدون دسته‌بندی خواهند شد."
        onConfirm={executeCatDelete}
        onCancel={() => setConfirmState({ isOpen: false, catId: 0 })}
      />

      <ConfirmModal 
        isOpen={whConfirmState.isOpen}
        message="آیا از غیرفعال‌سازی این انبار اطمینان دارید؟ موجودی این انبار در محاسبات دارایی لحاظ خواهد شد اما امکان انتخاب جدید در فاکتورها لغو خواهد شد."
        onConfirm={executeWhDelete}
        onCancel={() => setWhConfirmState({ isOpen: false, whId: 0 })}
      />
    </div>
  );
}
