import React, { useEffect, useState, useRef } from 'react';
import { fetchJson } from '../api';
import { Item, User } from '../types';
import { Search, Plus, Upload, Download } from 'lucide-react';
import * as xlsx from 'xlsx';
import { cn } from '../utils';
import { useSearch } from '../SearchContext';
import ConfirmModal from '../components/ConfirmModal';

export default function ItemsPage({ type, title, user }: { type: 'product' | 'raw_material', title: string, user: User }) {
  const [items, setItems] = useState<Item[]>([]);
  const { searchQuery: search, setSearchQuery: setSearch } = useSearch();
  const [showModal, setShowModal] = useState(false);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; itemId: number }>({ isOpen: false, itemId: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<any>({ 
    name: '', 
    code: '', 
    unit: '', 
    current_stock: 0, 
    category: '', 
    image: '', 
    thumbnail: '',
    reorder_point: 0,
    weighted_average_cost: 0
  });
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [codePrefix, setCodePrefix] = useState('');
  const [codeNumber, setCodeNumber] = useState('');
  const [viewImage, setViewImage] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024) {
      alert('حجم تصویر نباید بیشتر از ۱۰۰ کیلوبایت باشد');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      setForm(prev => ({ ...prev, image: base64 }));
      
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 64;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const thumbBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setForm(prev => ({ ...prev, thumbnail: thumbBase64 }));
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
  };

  const loadItems = () => {
    fetchJson(`/items?type=${type}`)
      .then(setItems)
      .catch(console.error);
  };

  const executeArchive = () => {
    const id = confirmState.itemId;
    fetchJson(`/items/${id}`, { method: 'DELETE' })
      .then(() => {
        alert('کالا با موفقیت بایگانی گردید.');
        loadItems();
        setConfirmState({ isOpen: false, itemId: 0 });
      })
      .catch(err => {
        alert(err.message);
        setConfirmState({ isOpen: false, itemId: 0 });
      });
  };

  useEffect(() => {
    loadItems();
    setSearch('');
    
    // load categories
    fetchJson('/categories')
      .then(cats => {
        setAllCategories(cats.filter((c: any) => c.type === type));
      }).catch(console.error);

    // load warehouses
    fetchJson('/warehouses')
      .then(whs => {
        setWarehouses(whs);
        const initialStocks: Record<string, number> = {};
        for (const w of whs) {
          initialStocks[`stock_${w.code}`] = 0;
        }
        setForm((prev: any) => ({ ...prev, ...initialStocks }));
      }).catch(console.error);

  }, [type]);

  const [allCategories, setAllCategories] = useState<{ id: number; name: string; prefix: string; type: string }[]>([]);
  const [productYear, setProductYear] = useState(() => Intl.DateTimeFormat('en-US-u-ca-persian', {year: 'numeric'}).format(new Date()));
  const [productTransfer, setProductTransfer] = useState('');

  const productFixedCategories = [
    { name: 'گردنبند', prefix: 'N', unit: 'عدد' },
    { name: 'گوشواره میخی', prefix: 'S', unit: 'جفت' },
    { name: 'گوشواره آویز', prefix: 'E', unit: 'جفت' },
    { name: 'انگشتر', prefix: 'R', unit: 'عدد' },
    { name: 'دستبند', prefix: 'B', unit: 'عدد' },
  ];

  const generateNextProductCode = async (catPrefix: string, transferRaw: string, yearRaw: string) => {
    if (!catPrefix || !transferRaw || !yearRaw) {
      setCodePrefix('');
      setCodeNumber('');
      setForm(f => ({ ...f, code: '' }));
      return;
    }
    
    // code pattern: Year-Category-Transfer-Serial
    const finalPrefix = `${yearRaw}-${catPrefix}-${transferRaw}-`;
    setCodePrefix(finalPrefix);
    
    try {
      // We need to fetch the next sequential number based on the prefix finalPrefix
      const res = await fetchJson(`/items/next-product-code?year=${yearRaw}&prefix=${catPrefix}&transfer=${transferRaw}`);
      if (res.nextCode) {
         const numPart = res.nextCode.substring(finalPrefix.length);
         setCodeNumber(numPart);
         setForm(f => ({ ...f, code: res.nextCode }));
      } else {
         setCodeNumber('01');
         setForm(f => ({ ...f, code: `${finalPrefix}01` }));
      }
    } catch(e) { console.error(e); }
  };

  const generateNextCodeAndSet = async (prefix: string) => {
    if (!prefix) {
      setCodePrefix('');
      setCodeNumber('');
      setForm(f => ({ ...f, code: '' }));
      return;
    }
    
    setCodePrefix(prefix);
    try {
      const res = await fetchJson(`/categories/next-code?prefix=${encodeURIComponent(prefix)}`);
      // res.nextCode is the full next code like B-001. We want the number part if the user sees prefix + number separately
      if (res.nextCode) {
        const numPart = res.nextCode.substring(prefix.length);
        setCodeNumber(numPart);
        setForm(f => ({ ...f, code: res.nextCode }));
      } else {
         setCodeNumber('001');
         setForm(f => ({...f, code: `${prefix}001`}));
      }
    } catch(err) {
      console.error(err);
      setCodeNumber('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const finalCode = type === 'raw_material' ? `${codePrefix}${codeNumber}` : form.code;
      await fetchJson('/items', {
        method: 'POST',
        body: JSON.stringify({ ...form, code: finalCode, type })
      });
      setShowModal(false);
      const initialStocks: Record<string, number> = {};
      for (const w of warehouses) {
        initialStocks[`stock_${w.code}`] = 0;
      }
      setForm({
        name: '', 
        code: '', 
        unit: '', 
        current_stock: 0, 
        category: '', 
        image: '', 
        thumbnail: '',
        reorder_point: 0,
        weighted_average_cost: 0,
        ...initialStocks
      });
      setCodePrefix('');
      setCodeNumber('');
      setProductTransfer('');
      setProductYear(Intl.DateTimeFormat('en-US-u-ca-persian', {year: 'numeric'}).format(new Date()));
      loadItems();
    } catch (err) {
      alert('خطا در ثبت کالا، لطفا کد کالا را مجددا بررسی نمایید.');
    }
  };

  const handleExport = () => {
    const ws = xlsx.utils.json_to_sheet(items.map(item => {
      const exportRow: any = {
        'دسته‌بندی': item.category || '',
        'کد کالا': item.code,
        'نام محصول': item.name,
        'موجودی کل': item.current_stock,
      };
      for (const w of warehouses) {
        exportRow[`موجودی ${w.name}`] = (item as any)[`stock_${w.code}`] || 0;
      }
      exportRow['حد نقطه سفارش (آلارم کسری)'] = (item as any).reorder_point || 0;
      exportRow['قیمت میانگین خرید (ریال)'] = (item as any).weighted_average_cost || 0;
      exportRow['واحد'] = item.unit;
      return exportRow;
    }));
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, title);
    xlsx.writeFile(wb, `${title}.xlsx`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = xlsx.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = xlsx.utils.sheet_to_json<any>(ws);

        let successCount = 0;
        for (const row of data) {
          const category = row['دسته‌بندی'] || row['دسته'] || row['category'] || '';
          const code = row['کد کالا'] || row['کد'] || row['code'] || new Date().getTime().toString() + Math.floor(Math.random() * 1000);
          const name = row['نام محصول'] || row['نام'] || row['name'];
          
          const rPoint = Number(row['حد نقطه سفارش (آلارم کسری)'] || row['reorder_point'] || row['نقطه سفارش'] || 0);
          const avgCost = Number(row['قیمت میانگین خرید (ریال)'] || row['arzeshe_kharid'] || row['weighted_average_cost'] || row['قیمت میانگین خرید'] || 0);
          const unit = row['واحد'] || row['unit'] || 'عدد';

          // Extract stocks dynamically for all warehouses
          const stockValues: Record<string, number> = {};
          let computedStock = 0;
          for (const wh of warehouses) {
            const rowVal = row[`موجودی ${wh.name}`] || row[`stock_${wh.code}`] || row[wh.name] || 0;
            stockValues[`stock_${wh.code}`] = Number(rowVal);
            computedStock += Number(rowVal);
          }
          const current_stock = Number(row['موجودی کل'] || row['موجودی فعلی'] || row['موجودی'] || row['stock']) || computedStock;

          if (name) {
            await fetchJson('/items', {
              method: 'POST',
              body: JSON.stringify({ 
                name, 
                code: code.toString(), 
                unit, 
                type, 
                category,
                reorder_point: rPoint,
                weighted_average_cost: avgCost,
                current_stock,
                ...stockValues
              })
            });
            successCount++;
          }
        }
        alert(`${successCount} کالا با موفقیت از اکسل وارد شد.`);
        loadItems();
      } catch (err) {
        alert('خطا در پردازش فایل اکسل. لطفاً ساختار ستون‌ها را بر اساس خروجی سیستم هماهنگ کنید.');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    item.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {viewImage && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewImage(null)}>
          <div className="relative bg-white p-2 rounded-xl shadow-2xl max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setViewImage(null)}
              className="absolute -top-4 -right-4 w-8 h-8 bg-slate-800 text-white rounded-full flex items-center justify-center hover:bg-slate-700 shadow-lg border-2 border-white z-10"
            >
              ✕
            </button>
            <div className="overflow-auto rounded-lg">
              <img src={viewImage} alt="نمای بزرگ تصویر" className="max-w-full max-h-[85vh] object-contain rounded" />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl shadow-sm flex flex-col min-h-[460px]">
        <div className="p-4 border-b flex justify-between items-center bg-white">
          <h3 className="font-bold flex items-center gap-2">📦 {title}</h3>
          <div className="flex gap-2">
            <button onClick={handleExport} className="px-3 py-1.5 text-xs font-medium border rounded hover:bg-slate-50 transition-colors flex items-center gap-1">
              <Download size={14} /> خروجی اکسل
            </button>
            {user.role !== 'viewer' && (
              <>
                <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 text-xs font-medium border rounded hover:bg-slate-50 transition-colors flex items-center gap-1">
                  <Upload size={14} /> ورود از اکسل
                </button>
                <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleImport} />
                <button 
                  onClick={() => setShowModal(true)}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  <Plus size={14} />
                  ثبت جدید
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-3 bg-slate-50 border-b flex justify-between items-center gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="جستجو بر اساس نام یا کد..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-3 pr-10 py-1.5 rounded border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-500 border-b sticky top-0 text-xs">
              <tr>
                <th className="p-3 w-16">No.</th>
                <th className="p-3 font-medium">دسته‌بندی</th>
                <th className="p-3 font-medium">کد شناسایی</th>
                <th className="p-3 font-medium">نام قلم کالا</th>
                <th className="p-3 font-medium text-center">توزیع فیزیکی (گاوصندوق / کارگاه / نمایشگاه)</th>
                <th className="p-3 font-medium text-center">نقطه سفارش</th>
                <th className="p-3 font-medium text-center">ارزش خرید متحرک (WAC)</th>
                <th className="p-3 font-medium text-center">کل موجودی</th>
                <th className="p-3 font-medium">واحد</th>
                {user.role !== 'viewer' && <th className="p-3 font-medium text-center">عملیات</th>}
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {filteredItems.map((item, idx) => {
                const rPoint = (item as any).reorder_point || 0;
                const avgCost = (item as any).weighted_average_cost || 0;
                const isUnderReorder = item.current_stock <= rPoint && rPoint > 0;

                return (
                  <tr key={item.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="p-3 text-center">
                      {item.thumbnail ? (
                        <img 
                          src={item.thumbnail} 
                          alt={item.name} 
                          onClick={() => setViewImage(item.image || item.thumbnail)}
                          className="w-8 h-8 object-cover rounded shadow-sm border m-auto cursor-pointer hover:opacity-80 transition-opacity" 
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">#{idx+1}</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-500">
                      {item.category ? (
                         <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px]">{item.category}</span>
                      ) : '-'}
                    </td>
                    <td className="p-3 font-mono text-slate-600">{item.code}</td>
                    <td className="p-3 font-bold text-slate-850">{item.name}</td>
                    
                    {/* Multi-Location inventory break-up */}
                    <td className="p-3 text-center">
                      <div className="flex flex-wrap justify-center items-center gap-1.5" dir="ltr">
                        {warehouses.map(w => {
                          const val = (item as any)[`stock_${w.code}`] || 0;
                          let badgeColor = "bg-slate-50 text-slate-700";
                          if (w.code === 'safe') badgeColor = "bg-indigo-50 text-indigo-700";
                          else if (w.code === 'workshop') badgeColor = "bg-orange-50 text-orange-700";
                          else if (w.code === 'showroom') badgeColor = "bg-emerald-50 text-emerald-700";
                          return (
                            <span key={w.code} className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${badgeColor}`} title={w.name}>
                              {w.name}: {val}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Reorder Point limit */}
                    <td className="p-3 text-center font-mono font-medium text-slate-500">
                      {rPoint > 0 ? (
                        <span className={cn(
                          "px-2 py-0.5 rounded-full font-bold text-[10px]",
                          isUnderReorder ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                        )}>
                          {rPoint}
                        </span>
                      ) : '-'}
                    </td>

                    {/* Average Purchase Cost Badge (WAC) */}
                    <td className="p-3 text-center font-mono font-semibold text-slate-700">
                      {avgCost > 0 ? (
                        <span className="bg-slate-50 border px-2 py-0.5 rounded text-[10px]" title="هزینه میانگین برای کل دوره‌ها">
                          {avgCost.toLocaleString()} ریال
                        </span>
                      ) : '-'}
                    </td>

                    {/* Final Totals */}
                    <td className="p-3 text-center font-bold font-mono">
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-md",
                        isUnderReorder ? "bg-red-50 text-red-600 border border-red-100" : "text-blue-600"
                      )}>
                        {item.current_stock.toLocaleString()}
                      </span>
                    </td>

                    <td className="p-3 text-slate-500">{item.unit}</td>
                    
                    {/* Soft Delete Control */}
                    {user.role !== 'viewer' && (
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setConfirmState({ isOpen: true, itemId: item.id })}
                          className="bg-red-50 text-red-600 hover:bg-red-100 font-bold px-2 py-1 rounded text-[10px]"
                        >
                          آرشیو کالا
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500">موردی یافت نشد.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-3 bg-slate-50 border-t flex items-center justify-between mt-auto">
          <span className="text-xs text-slate-500">نمایش {filteredItems.length} مورد</span>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm shadow flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">ثبت {type === 'product' ? 'محصول' : 'ماده اولیه'} جدید</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">نام</label>
                <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border rounded-lg px-3 py-2" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {type === 'product' ? (
                  <>
                    <div className="col-span-2 grid grid-cols-3 gap-2 border p-3 rounded-lg bg-slate-50 items-end">
                      <div className="col-span-3 pb-2 border-b mb-2">
                        <span className="text-xs font-bold text-slate-500">مشخصات کد گذاری محصول</span>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">سال طراحی</label>
                        <input 
                          type="text" 
                          value={productYear}
                          onChange={e => {
                            setProductYear(e.target.value);
                            generateNextProductCode(productFixedCategories.find(c => c.name === form.category)?.prefix || '', productTransfer, e.target.value);
                          }}
                          className="w-full border rounded px-3 py-1.5 text-sm"
                          dir="ltr"
                          placeholder="مثال: 1403"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">دسته‌بندی (نوع مجصول)</label>
                        <select 
                          required
                          value={form.category} 
                          onChange={e => {
                            const catName = e.target.value;
                            const cat = productFixedCategories.find(c => c.name === catName);
                            setForm({...form, category: catName, unit: cat?.unit || 'عدد'});
                            generateNextProductCode(cat?.prefix || '', productTransfer, productYear);
                          }} 
                          className="w-full border rounded px-3 py-1.5 text-sm"
                        >
                          <option value="">- نوع محصول -</option>
                          {productFixedCategories.map(c => (
                            <option key={c.prefix} value={c.name}>{c.name} ({c.prefix})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">کد ترنسفر (دستی)</label>
                        <input 
                          required 
                          type="text" 
                          value={productTransfer}
                          onChange={e => {
                            setProductTransfer(e.target.value);
                            generateNextProductCode(productFixedCategories.find(c => c.name === form.category)?.prefix || '', e.target.value, productYear);
                          }}
                          className="w-full border rounded px-3 py-1.5 text-sm"
                          dir="ltr"
                          placeholder="مثال: 001"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-1">دسته‌بندی</label>
                    <select 
                      required
                      value={form.category} 
                      onChange={e => {
                        const catName = e.target.value;
                        const cat = allCategories.find(c => c.name === catName);
                        setForm({...form, category: catName});
                        generateNextCodeAndSet(cat?.prefix || '');
                      }} 
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="">- انتخاب دسته -</option>
                      {allCategories.map(c => (
                        <option key={c.id} value={c.name}>{c.name} {c.prefix ? `(${c.prefix}XXX)` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className={type === 'product' ? "col-span-2" : ""}>
                  <label className="block text-sm font-medium mb-1">کد شناسایی</label>
                  <div className="flex w-full mt-1 rounded-lg shadow-sm border overflow-hidden bg-slate-50">
                    {codePrefix && (
                      <span className="inline-flex items-center px-3 rounded-r-lg border-l bg-slate-100 text-slate-500 font-mono text-sm">
                        {codePrefix}
                      </span>
                    )}
                    <input 
                      required 
                      type="text" 
                      value={codeNumber || (form.code.startsWith(codePrefix) ? form.code.replace(codePrefix, '') : form.code)} 
                      onChange={e => {
                        setCodeNumber(e.target.value);
                        setForm({...form, code: codePrefix + e.target.value});
                      }} 
                      readOnly={!!codePrefix}
                      className={cn("flex-1 block w-full px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono text-left", codePrefix && "bg-slate-50 text-slate-500 cursor-not-allowed")}
                      dir="ltr"
                      placeholder={codePrefix ? "خودکار" : "دستی"}
                    />
                  </div>
                </div>
              </div>
              <div className="p-3 border rounded-lg bg-slate-50 space-y-3">
                <span className="text-xs font-bold text-slate-500 block border-b pb-1">تخصیص موجودی اولیه به تفکیک انبارها</span>
                <div className="grid grid-cols-3 gap-2">
                  {warehouses.map(w => (
                    <div key={w.code}>
                      <label className="block text-[10px] font-medium mb-1 text-slate-600 truncate">📦 {w.name}</label>
                      <input 
                        type="number" 
                        min="0" 
                        step="any" 
                        value={form[`stock_${w.code}`] || 0} 
                        onChange={e => setForm({...form, [`stock_${w.code}`]: parseFloat(e.target.value) || 0})} 
                        className="w-full border rounded-lg px-2 py-1 text-center font-mono text-xs bg-white" 
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">حد آستانه سفارش (آلارم)</label>
                  <input type="number" min="0" step="any" value={form.reorder_point} onChange={e => setForm({...form, reorder_point: parseFloat(e.target.value) || 0})} className="w-full border rounded-lg px-3 py-2 text-left font-mono" dir="ltr" placeholder="مثال: ۱۰" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ارزش واحد اولیه (WAC)</label>
                  <input type="number" min="0" step="any" value={form.weighted_average_cost} onChange={e => setForm({...form, weighted_average_cost: parseFloat(e.target.value) || 0})} className="w-full border rounded-lg px-3 py-2 text-left font-mono" dir="ltr" placeholder="ریال" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">واحد اندازه‌گیری</label>
                  <input required type="text" placeholder="مثال: عدد، کیلوگرم" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">تصویر (اختیاری - حداکثر ۱۰۰ کیلوبایت)</label>
                <input type="file" accept="image/*" onChange={handleImageChange} className="w-full border rounded-lg px-3 py-2 text-sm" />
                {form.thumbnail && (
                  <div className="mt-2">
                    <img src={form.thumbnail} alt="پیش‌نمایش" className="w-16 h-16 object-cover rounded shadow-sm border" />
                  </div>
                )}
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg hover:bg-slate-50">انصراف</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">ثبت و ذخیره</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmState.isOpen}
        title="آرشیو و بایگانی کالا"
        message="آیا از حذف (آرشیو) این کالا اطمینان دارید؟ با انتقال کالا به آرشیو، این مورد دیگر در جداول فعال محصولات و مواد اولیه نشان داده نخواهد شد. اما برای حفظ ثبات و صحت اسناد مالی و فاکتورهای قبلی، تمام تراکنش‌ها و اقلام فاکتورهای ثبت شده با این کالا کماکان به طور دقیق نگهداری می‌شوند."
        onConfirm={executeArchive}
        onCancel={() => setConfirmState({ isOpen: false, itemId: 0 })}
        confirmText="بله، انتقال به آرشیو"
        cancelText="انصراف"
      />
    </div>
  );
}
