import React, { useEffect, useState } from 'react';
import { fetchJson } from '../api';
import { Settings, Trash2, Edit2, Plus, AlertTriangle, List, FolderTree, Building2, Tags, ShieldAlert } from 'lucide-react';
import { User, Category } from '../types';
import ConfirmModal from '../components/ConfirmModal';
import { cn } from '../utils';

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
  const [pricingStrategies, setPricingStrategies] = useState('فروشگاه,مصرف‌کننده,عمده');
  
  const [showCatModal, setShowCatModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [catForm, setCatForm] = useState({ id: 0, name: '', prefix: '', type: 'raw_material' });
  const [clearMode, setClearMode] = useState<'transactions' | 'all'>('transactions');
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; catId: number }>({ isOpen: false, catId: 0 });

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [whForm, setWhForm] = useState({ id: 0, name: '', code: '' });
  const [showWhModal, setShowWhModal] = useState(false);
  const [whConfirmState, setWhConfirmState] = useState<{ isOpen: boolean; whId: number }>({ isOpen: false, whId: 0 });

  const [activeTab, setActiveTab] = useState<'general' | 'categories' | 'warehouses' | 'pricing' | 'system'>('general');

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

      const strategies = data.find((s: any) => s.key === 'pricing_strategies');
      if (strategies) setPricingStrategies(strategies.value);
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
            { key: 'dead_stock_days', value: deadStockDays },
            { key: 'pricing_strategies', value: pricingStrategies }
          ]
        })
      });
      alert('تنظیمات عمومی با موفقیت ذخیره شد');
    } catch(err) { alert('خطا در ذخیره تنظیمات'); }
  };

  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (catForm.id) {
        await fetchJson(`/categories/${catForm.id}`, { method: 'PUT', body: JSON.stringify(catForm) });
      } else {
        await fetchJson('/categories', { method: 'POST', body: JSON.stringify(catForm) });
      }
      setShowCatModal(false);
      setCatForm({ id: 0, name: '', prefix: '', type: 'raw_material' });
      loadCategories();
    } catch (err: any) { alert(err.message || 'خطا در ثبت'); }
  };

  const handleCatDelete = async (id: number) => { setConfirmState({ isOpen: true, catId: id }); };
  const executeCatDelete = async () => {
    try {
      await fetchJson(`/categories/${confirmState.catId}`, { method: 'DELETE' });
      loadCategories();
      setConfirmState({ isOpen: false, catId: 0 });
    } catch (err: any) { alert('خطا در حذف'); }
  };

  const handleWhSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (whForm.id) {
        await fetchJson(`/warehouses/${whForm.id}`, { method: 'PUT', body: JSON.stringify({ name: whForm.name }) });
      } else {
        await fetchJson('/warehouses', { method: 'POST', body: JSON.stringify(whForm) });
      }
      setShowWhModal(false);
      setWhForm({ id: 0, name: '', code: '' });
      loadWarehouses();
    } catch (err: any) { alert(err.message || 'خطا در ثبت انبار'); }
  };

  const handleWhDelete = (id: number) => { setWhConfirmState({ isOpen: true, whId: id }); };
  const executeWhDelete = async () => {
    try {
      await fetchJson(`/warehouses/${whConfirmState.whId}`, { method: 'DELETE' });
      loadWarehouses();
      setWhConfirmState({ isOpen: false, whId: 0 });
    } catch (err: any) { alert(err.message || 'خطا در حذف انبار'); }
  };

  const handleClearData = async () => {
    if (prompt(`برای تایید کلمه DELETE را وارد کنید`) !== 'DELETE') return alert('عملیات لغو شد');
    try {
      await fetchJson('/admin/clear-data', { method: 'POST', body: JSON.stringify({ mode: clearMode }) });
      alert('اطلاعات با موفقیت پاک شد');
      setShowClearModal(false);
    } catch (err: any) { alert(err.message || 'خطا در عملیات پاکسازی'); }
  };

  if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
    return <div className="p-8 text-center text-slate-500">عدم دسترسی</div>;
  }

  const tabs = [
    { id: 'general', label: 'تنظیمات عمومی', icon: List },
    { id: 'categories', label: 'دسته‌بندی‌ها', icon: FolderTree },
    { id: 'warehouses', label: 'مدیریت انبارها', icon: Building2 },
    { id: 'pricing', label: 'سیاست‌های قیمتی', icon: Tags },
    ...(currentUser.role === 'admin' ? [{ id: 'system', label: 'عملیات سیستمی', icon: ShieldAlert }] : [])
  ] as const;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
          <Settings size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">تنظیمات سامانه</h1>
          <p className="text-slate-500 text-xs mt-1">پیکربندی سیستم و مدیریت داده‌های پایه</p>
        </div>
      </div>

      <div className="flex bg-white border-b px-6 gap-6 shrink-0 pt-2 overflow-x-auto">
        {tabs.map(t => (
          <button 
            key={t.id} 
            onClick={() => setActiveTab(t.id as any)}
            className={cn(
              "flex items-center gap-2 pb-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap",
              activeTab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            )}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      <div className="p-6 flex-1 overflow-auto">
        {activeTab === 'general' && (
          <div className="bg-white border rounded-xl shadow-sm p-6 max-w-4xl mx-auto">
            <h3 className="font-bold border-b pb-3 mb-6 text-slate-800 flex items-center gap-2">
              <List size={18} /> تنظیمات عمومی و دوره‌های گردش
            </h3>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">شماره شروع فاکتور چاپی</label>
                <input type="text" value={invoiceStartNum} onChange={e => setInvoiceStartNum(e.target.value)} className="w-full border rounded-lg px-3 py-2 font-mono text-left bg-white border-slate-300" dir="ltr" />
                <p className="text-xs text-slate-500 mt-1">شماره فاکتور بعدی از این عدد شروع خواهد شد.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">تند گردش (کمتر از چند روز)</label>
                <input type="number" min="1" value={fastMovingDays} onChange={e => setFastMovingDays(e.target.value)} className="w-full border rounded-lg px-3 py-2 font-mono text-left bg-white border-slate-300" dir="ltr" />
                <p className="text-xs text-slate-500 mt-1">کالاهایی که در این بازه خروج داشته باشند.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">کند گردش (بیشتر از چند روز)</label>
                <input type="number" min="1" value={slowMovingDays} onChange={e => setSlowMovingDays(e.target.value)} className="w-full border rounded-lg px-3 py-2 font-mono text-left bg-white border-slate-300" dir="ltr" />
                <p className="text-xs text-slate-500 mt-1">شروع بازه بدون خروج متوسط (مثلا ۹۰ روز).</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">کالای راکد (بیشتر از چند روز)</label>
                <input type="number" min="1" value={deadStockDays} onChange={e => setDeadStockDays(e.target.value)} className="w-full border rounded-lg px-3 py-2 font-mono text-left bg-white border-slate-300" dir="ltr" />
                <p className="text-xs text-slate-500 mt-1">شروع بازه بدون خروج طولانی (مثلا ۱۸۰ روز).</p>
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t">
              <button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">ذخیره تنظیمات</button>
            </div>
          </div>
        )}

        {activeTab === 'pricing' && (
          <div className="bg-white border rounded-xl shadow-sm p-6 max-w-4xl mx-auto">
            <h3 className="font-bold border-b pb-3 mb-6 text-slate-800 flex items-center gap-2">
              <Tags size={18} /> سیاست‌های قیمتی (عناوین)
            </h3>
            <div className="mb-8">
              <label className="block text-sm font-medium mb-2 text-slate-700">عناوین سیاست‌های قیمتی (با کاما جدا کنید)</label>
              <textarea 
                rows={3} 
                value={pricingStrategies} 
                onChange={e => setPricingStrategies(e.target.value)} 
                className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono bg-white" 
                placeholder="فروشگاه, مصرف‌کننده نهایی, عمده"
              />
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                این عناوین در صفحه «قیمت‌گذاری محصولات» به عنوان دسته‌های مرجع برای قیمت‌ها نمایش داده می‌شوند و می‌توانید قیمت کالا را بر این اساس‌ها سریعاً ست کنید.
              </p>
            </div>
            
            <div className="flex justify-end pt-4 border-t">
              <button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">ذخیره تنظیمات قیمت‌گذاری</button>
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="bg-white border rounded-xl shadow-sm flex flex-col min-h-[400px] max-w-4xl mx-auto">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold border-0 p-0 m-0">📂 دسته‌بندی کالاها / مواد اولیه</h3>
              <button onClick={() => { setCatForm({ id: 0, name: '', prefix: '', type: 'raw_material' }); setShowCatModal(true); }} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1">
                <Plus size={14} /> جدید
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-500 border-b">
                  <tr>
                    <th className="p-3 font-medium">نام دسته</th>
                    <th className="p-3 font-medium">پیشوند کد</th>
                    <th className="p-3 font-medium">نوع</th>
                    <th className="p-3 font-medium text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y relative">
                  {categories.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-800">{c.name}</td>
                      <td className="p-3 font-mono text-slate-600 text-left" dir="ltr">{c.prefix}</td>
                      <td className="p-3 text-xs text-slate-500">{c.type === 'product' ? 'محصول نهایی' : 'مواد اولیه'}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => { setCatForm(c); setShowCatModal(true); }} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded"><Edit2 size={16} /></button>
                          <button onClick={() => handleCatDelete(c.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'warehouses' && (
          <div className="bg-white border rounded-xl shadow-sm flex flex-col min-h-[400px] max-w-4xl mx-auto">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold border-0 p-0 m-0">🏭 مدیریت و تعریف انبارها</h3>
              <button onClick={() => { setWhForm({ id: 0, name: '', code: '' }); setShowWhModal(true); }} className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-1">
                <Plus size={14} /> انبار جدید
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-500 border-b">
                  <tr>
                    <th className="p-3 font-medium">نام انبار</th>
                    <th className="p-3 font-medium">کد سیستم</th>
                    <th className="p-3 font-medium text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {warehouses.map(w => (
                    <tr key={w.id} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-800">{w.name}</td>
                      <td className="p-3 font-mono text-slate-500 text-left" dir="ltr">{w.code}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => { setWhForm({ id: w.id, name: w.name, code: w.code }); setShowWhModal(true); }} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded"><Edit2 size={14} /></button>
                          {w.code !== 'safe' && <button onClick={() => handleWhDelete(w.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded"><Trash2 size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'system' && currentUser.role === 'admin' && (
          <div className="bg-white border text-red-700 border-red-200 rounded-xl shadow-sm p-6 space-y-4 max-w-4xl mx-auto">
            <div className="flex items-center gap-2 border-b border-red-100 pb-4 mb-4">
              <ShieldAlert size={24} />
              <h3 className="font-bold text-lg m-0 p-0 border-0">عملیات سیستمی و خطرناک</h3>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-100">
              <h4 className="font-bold text-red-800 mb-2">پاکسازی اطلاعات سیستم</h4>
              <p className="text-sm text-red-700 mb-4">می‌توانید اطلاعات تراکنش‌ها و تاریخچه را پاک کنید. غیر قابل بازگشت خواهد بود.</p>
              <button onClick={() => setShowClearModal(true)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium">اجرای عملیات پاکسازی</button>
            </div>
          </div>
        )}
      </div>

      {showCatModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center"><h3 className="font-bold text-lg">{catForm.id ? 'ویرایش دسته‌بندی' : 'ثبت دسته‌بندی جدید'}</h3></div>
            <form onSubmit={handleCatSubmit} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium mb-1">نام دسته‌بندی</label><input required type="text" value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" /></div>
              <div><label className="block text-sm font-medium mb-1">پیشوند کد (انگلیسی)</label><input required type="text" value={catForm.prefix} onChange={e => setCatForm({...catForm, prefix: e.target.value})} className="w-full border rounded px-3 py-2 text-sm font-mono text-left focus:ring-1 focus:ring-blue-500 outline-none" dir="ltr" /></div>
              <div><label className="block text-sm font-medium mb-1">نوع کالا</label>
                <select value={catForm.type} onChange={e => setCatForm({...catForm, type: e.target.value})} className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none">
                  <option value="raw_material">مواد اولیه</option><option value="product">محصول نهایی</option>
                </select></div>
              <div className="pt-4 flex justify-end gap-2"><button type="button" onClick={() => setShowCatModal(false)} className="px-4 py-2 border rounded hover:bg-slate-50 text-sm">انصراف</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">ثبت</button></div>
            </form>
          </div>
        </div>
      )}

      {showClearModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden border-2 border-red-500">
            <div className="px-6 py-4 border-b bg-red-50 text-red-600"><h3 className="font-bold text-lg border-0">هشدار امنیتی</h3></div>
            <div className="p-6 space-y-4">
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50"><input type="radio" value="transactions" checked={clearMode === 'transactions'} onChange={() => setClearMode('transactions')} className="mt-1" /><div><div className="font-bold text-sm">حذف تاریخچه تراکنش‌ها</div><div className="text-xs text-slate-500">فاکتورها و تراکنش‌ها حذف و کالاها ۰ می‌شوند.</div></div></label>
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50"><input type="radio" value="all" checked={clearMode === 'all'} onChange={() => setClearMode('all')} className="mt-1" /><div><div className="font-bold text-sm text-red-600">حذف کل اطلاعات</div><div className="text-xs text-slate-500">برگشت کامل به صفر، شامل همه کالاها.</div></div></label>
              <div className="pt-4 flex justify-end gap-2"><button onClick={() => setShowClearModal(false)} className="px-4 py-2 border rounded text-sm hover:bg-slate-50">انصراف</button><button onClick={handleClearData} className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700">تایید حذف</button></div>
            </div>
          </div>
        </div>
      )}

      {showWhModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b"><h3 className="font-bold text-lg border-0">تعریف انبار</h3></div>
            <form onSubmit={handleWhSubmit} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium mb-1">نام انبار</label><input required type="text" value={whForm.name} onChange={e => setWhForm({...whForm, name: e.target.value})} className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none" /></div>
              <div><label className="block text-sm font-medium mb-1">کد سیستم</label><input required disabled={!!whForm.id} type="text" value={whForm.code} onChange={e => setWhForm({...whForm, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})} className="w-full border rounded px-3 py-2 text-sm font-mono text-left focus:ring-1 focus:ring-emerald-500 outline-none" dir="ltr" /></div>
              <div className="pt-4 flex justify-end gap-2"><button type="button" onClick={() => setShowWhModal(false)} className="px-4 py-2 border rounded text-sm hover:bg-slate-50">انصراف</button><button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700">ثبت انبار</button></div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={confirmState.isOpen} message="آیا از حذف مطمئن هستید؟" onConfirm={executeCatDelete} onCancel={() => setConfirmState({ isOpen: false, catId: 0 })} />
      <ConfirmModal isOpen={whConfirmState.isOpen} message="غیرفعال‌سازی این انبار؟" onConfirm={executeWhDelete} onCancel={() => setWhConfirmState({ isOpen: false, whId: 0 })} />
    </div>
  );
}
