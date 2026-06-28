import React, { useState, useEffect } from 'react';
import { fetchJson } from '../api';
import { User } from '../types';
import { 
  ClipboardCheck, RefreshCw, Search, CheckCircle, 
  AlertTriangle, Save, HelpCircle, Warehouse, ArrowLeftRight 
} from 'lucide-react';

interface AuditItemInput {
  id: number;
  name: string;
  code: string;
  unit: string;
  type: string;
  stock_safe: number;
  stock_workshop: number;
  stock_showroom: number;
  system_stock_computed: number; // dynamically computed based on selected location
  physical_stock: string; // operator input text
}

export default function InventoryAuditPage({ user }: { user: User }) {
  const [items, setItems] = useState<AuditItemInput[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, product, raw_material
  const [selectedLocation, setSelectedLocation] = useState<string>('safe');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [nextRef, setNextRef] = useState('');
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    // 1. Fetch next references
    fetchJson(`/documents/next-ref?type=audit`)
      .then(res => {
        setNextRef(res.nextRef || '1');
      })
      .catch(err => console.error(err));

    // 2. Fetch items
    fetchJson('/items?limit=0')
      .then((res: any) => {
        const data = res.data || res;
        // Map items and compute system stock on selected location
        const mapped = data.map((i: any) => {
          const system_stock_computed = i[`stock_${selectedLocation}`] || 0;

          return {
            ...i,
            system_stock_computed,
            physical_stock: '' // starts with blank, meaning untouched
          };
        });
        setItems(mapped);
        setErrorMsg(null);
      })
      .catch(err => {
        setErrorMsg('خطا در بارگذاری فرآیند انبارداری و کالاها');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchJson('/warehouses').then(whs => {
      setWarehouses(whs);
      if (whs.length > 0 && !selectedLocation) {
        setSelectedLocation(whs[0].code);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedLocation]); // reload if location changes so system stock calculations match that location

  // Handle single physical input change
  const handlePhysicalChange = (itemId: number, value: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        // protect numerals
        const sanitized = value.replace(/[^0-9.]/g, '');
        return {
          ...item,
          physical_stock: sanitized
        };
      }
      return item;
    }));
  };

  // Quick helper: Autofill physical stock with current system stock for items to save operator time
  const handleAutofillAll = () => {
    setItems(prev => prev.map(item => ({
      ...item,
      physical_stock: item.system_stock_computed.toString()
    })));
  };

  // Reset physical counters
  const handleClearAll = () => {
    setItems(prev => prev.map(item => ({
      ...item,
      physical_stock: ''
    })));
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          item.code.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleSubmitAudit = (e: React.FormEvent) => {
    e.preventDefault();

    if (user.role === 'viewer') {
      setErrorMsg('شما دسترسی تماشاگر دارید و مجاز به انجام عملیات انبارگردانی نیستید.');
      return;
    }

    // Filter down to only items that have been physically counted (operator put a value)
    const auditedItems = items.filter(item => item.physical_stock !== '');
    if (auditedItems.length === 0) {
      setErrorMsg('کالایی شمارش نشده است. لطفاً حداقل موجودی واقعی یک کالا را وارد نمائید.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const payload = {
      docType: 'audit',
      refNumber: nextRef,
      date: new Date().toISOString().split('T')[0],
      user: user.full_name,
      location: selectedLocation,
      notes: notes || `انبارگردانی دوره‌ای انبار (${selectedLocation === 'safe' ? 'گاوصندوق اصلی' : selectedLocation === 'workshop' ? 'کارگاه ساخت' : 'ویترین نمایشگاه'})`,
      items: auditedItems.map(item => ({
        itemId: item.id,
        system_stock: item.system_stock_computed,
        physical_stock: parseInt(item.physical_stock, 10),
        location: selectedLocation
      }))
    };

    fetchJson('/documents', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
      .then(res => {
        setSuccessMsg(`انبارگردانی دوره‌ای شماره سند ${nextRef} با موفقیت ثبت شد و موجودی فیزیکی سیستم تعدیل گردید.`);
        setNotes('');
        loadData(); // reload
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(err => {
        setErrorMsg(err.message || 'خطا در ثبت نهایی گزارش انبارگردانی');
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 border rounded-xl shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardCheck size={22} className="text-blue-600" />
            انبارگردانی دوره‌ای و پایش مغایرت‌ها
          </h1>
          <p className="text-slate-500 text-xs mt-1">تطابق موجودی فیزیکی اقلام با سیستم و ثبت اتوماتیک مغایرت‌های اضافی و کسری انبار</p>
        </div>
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={loadData}
            className="p-2 border rounded-lg hover:bg-slate-50 flex items-center gap-1.5 text-xs font-semibold text-slate-600"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            بروزرسانی داده‌ها
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl">
          <CheckCircle size={18} className="text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl">
          <AlertTriangle size={18} className="text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Audit Location Selector & Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Col 1 & 2: Warehouse and Location setup */}
        <div className="md:col-span-2 bg-white p-6 border rounded-xl shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm border-b pb-2">
            <Warehouse size={16} className="text-indigo-600" />
            انتخاب موقعیت انبار جهت شمارش اقلام
          </h3>
          
          <div className="grid grid-cols-3 gap-3">
            {warehouses.map(w => {
              let emoji = "📦";
              let borderActive = "border-slate-600 bg-slate-50/50 text-slate-800";
              if (w.code === 'safe') { emoji = "🔒"; borderActive = "border-indigo-600 bg-indigo-50/50 text-indigo-800"; }
              else if (w.code === 'workshop') { emoji = "⚒️"; borderActive = "border-orange-600 bg-orange-50/50 text-orange-800"; }
              else if (w.code === 'showroom') { emoji = "💎"; borderActive = "border-emerald-600 bg-emerald-50/50 text-emerald-800"; }
              return (
                <button
                  key={w.code}
                  type="button"
                  onClick={() => setSelectedLocation(w.code)}
                  className={`p-4 border rounded-xl text-center transition-all ${selectedLocation === w.code ? `${borderActive} font-bold shadow-sm` : "hover:bg-slate-50 text-slate-600"}`}
                >
                  <span className="block text-xl">{emoji}</span>
                  <span className="block text-xs mt-1">{w.name}</span>
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
            🔔 نکته: انتخاب هر موقعیت، موجودی سیستم آن موقعیت مجزا را نمایش می‌دهد. با اتمام ثبت فرم، موجودی سیستم در آن قسمت دقیقاً با شمارش واقعی شما تراز و مغایرت‌ها به تفکیک زمان درج خواهد شد.
          </p>
        </div>

        {/* Col 3: Metadata / Submit Block */}
        <div className="bg-white p-6 border rounded-xl shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="font-bold text-slate-800 text-sm border-b pb-1.5">شناسه سند انبارگردانی</h3>
            <div>
              <span className="text-[10px] text-slate-400 font-medium">شماره سند اتوماتیک:</span>
              <p className="text-base font-bold font-mono text-slate-700 mt-0.5">#{nextRef}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium">مسئول شمارش (اپراتور):</span>
              <p className="text-xs font-bold text-slate-700 mt-0.5">{user.full_name}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium">ملاحظات انبارگردانی:</span>
              <input 
                type="text" 
                placeholder="توضیحات اختیاری..." 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full mt-1 border px-3 py-1.5 rounded-lg text-xs focus:outline-indigo-500 bg-slate-50" 
              />
            </div>
          </div>

          <div className="pt-4 border-t mt-4">
            <button
              type="button"
              onClick={handleSubmitAudit}
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition-transform flex items-center justify-center gap-1.5 active:scale-95 disabled:bg-slate-300"
            >
              <Save size={14} />
              {submitting ? 'در حال ثبت و تعدیل...' : 'ثبت نهایی و همگام‌سازی انبار'}
            </button>
          </div>
        </div>
      </div>

      {/* Counting Grid / Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        
        {/* Table Toolbar */}
        <div className="p-4 bg-slate-50 border-b flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            
            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <span className="absolute right-3 top-2.5 text-slate-400"><Search size={14} /></span>
              <input
                type="text"
                placeholder="جستجو کالا یا کد..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-9 pl-4 py-1.5 border rounded-lg text-xs bg-white focus:outline-indigo-500"
              />
            </div>

            {/* Type filters */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border p-1.5 rounded-lg text-xs bg-white"
            >
              <option value="all">همه دسته‌ها</option>
              <option value="product">فقط محصولات</option>
              <option value="raw_material">فقط مواد اولیه</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAutofillAll}
              className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
            >
              تکمیل خودکار شمارش‌ها (برابر سیستم)
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-200 transition-colors"
            >
              تنظیم مجدد فرم
            </button>
          </div>
        </div>

        {/* Audit Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-500 border-b uppercase">
              <tr>
                <th className="p-3 text-right">کد کالا</th>
                <th className="p-3 text-right">نام قلم کالا</th>
                <th className="p-3 text-center">نوع</th>
                {warehouses.map(w => (
                  <th key={w.code} className="p-3 text-center bg-slate-50">موجودی {w.name}</th>
                ))}
                <th className="p-3 text-center bg-indigo-50 font-bold text-indigo-900 border-l border-r">موقعیتی (سیستم)</th>
                <th className="p-3 text-center bg-blue-50/50 w-28">کارت شمارش واقعی</th>
                <th className="p-3 text-center bg-slate-50/80">مغایرت انبارگردانی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={warehouses.length + 6} className="p-10 text-center text-slate-400">
                    در حال بازیابی اطلاعات انبارها و موجودی‌ها...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={warehouses.length + 6} className="p-10 text-center text-slate-400">
                    کالایی با فیلتر انتخابی شما در انبار یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const physical_val = item.physical_stock === '' ? null : parseInt(item.physical_stock, 10);
                  const isCounted = physical_val !== null;
                  const variance = isCounted ? (physical_val - item.system_stock_computed) : 0;

                  return (
                    <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${isCounted ? "bg-indigo-50/10" : ""}`}>
                      <td className="p-3 font-mono text-slate-500">{item.code}</td>
                      <td className="p-3">
                        <p className="font-bold text-slate-800">{item.name}</p>
                        <span className="text-[10px] text-slate-400 font-semibold">{item.unit}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.type === 'product' ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}>
                          {item.type === 'product' ? 'کالا' : 'ماده'}
                        </span>
                      </td>
                      {warehouses.map(w => {
                        const val = (item as any)[`stock_${w.code}`] || 0;
                        return (
                          <td key={w.code} className="p-3 text-center bg-slate-50 font-mono font-medium text-slate-600">{val.toLocaleString()}</td>
                        );
                      })}
                      
                      {/* Active system stock */}
                      <td className="p-3 text-center bg-indigo-50 font-bold font-mono text-indigo-800 border-l border-r">
                        {item.system_stock_computed.toLocaleString()}
                      </td>

                      {/* Counting Input */}
                      <td className="p-3 text-center bg-blue-50/50">
                        <input
                          type="text"
                          placeholder="--"
                          value={item.physical_stock}
                          onChange={(e) => handlePhysicalChange(item.id, e.target.value)}
                          className="w-full border rounded-lg px-2 py-1 text-center font-mono font-bold text-indigo-900 border-indigo-200 focus:outline-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                      </td>

                      {/* Discrepancy details */}
                      <td className="p-3 text-center bg-slate-50/80">
                        {!isCounted ? (
                          <span className="text-[10px] text-slate-400 font-semibold">انتظار شمارش</span>
                        ) : variance === 0 ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">✓ منطبق</span>
                        ) : variance > 0 ? (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-mono font-bold px-2 py-0.5 rounded-full">
                            +{variance} اضافی
                          </span>
                        ) : (
                          <span className="text-[10px] bg-rose-100 text-rose-800 font-mono font-bold px-2 py-0.5 rounded-full">
                            {variance} کسری
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
