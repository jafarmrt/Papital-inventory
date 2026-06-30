import React, { useEffect, useState } from 'react';
import { fetchJson } from '../api';
import { toast } from 'react-hot-toast';
import { Item, ItemPrice, User } from '../types';
import { Search, Save, Trash2, Check } from 'lucide-react';
import { cn } from '../utils';

export default function PricingPage({ user }: { user: User }) {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<number, ItemPrice[]>>({});
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'product'|'raw_material'>('product');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Bulk update mode
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkPercent, setBulkPercent] = useState('');
  
  const [strategies, setStrategies] = useState<string[]>(['فروشگاه', 'مصرف‌کننده', 'عمده']);
  
  // State for tracking un-saved local inputs: itemId -> { strategyTitle: amountString }
  const [localEdits, setLocalEdits] = useState<Record<number, Record<string, string>>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const loadData = async () => {
    try {
      const allItemsResponse = await fetchJson(`/items?type=${tab}&limit=0`);
      const allItems = allItemsResponse.data || allItemsResponse;
      setItems(allItems);
      
      try {
        const cats = await fetchJson('/categories');
        setCategories(cats || []);
      } catch(e) {}
      
      try {
        const allPrices = await fetchJson('/items/prices/all');
        setPrices(allPrices || {});
      } catch(e) {}
      
      try {
        const settings = await fetchJson('/settings');
        const st = settings.find((s: any) => s.key === 'pricing_strategies');
        if (st && st.value) {
          setStrategies(st.value.split(',').map((s: string) => s.trim()).filter((s: string) => s));
        }
      } catch(e) {}
    } catch(err) {}
  };

  useEffect(() => {
    loadData();
  }, [tab]);

  const handlePriceChange = (itemId: number, title: string, val: string) => {
    setLocalEdits(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [title]: val }
    }));
  };

  const handleSaveItemPrices = async (itemId: number) => {
    setSavingId(itemId);
    const itemLocal = localEdits[itemId] || {};
    try {
      // Create or update each price for which there's a non-empty string or existing strategy with new value
      for (const st of strategies) {
        const valStr = itemLocal[st];
        // If the user hasn't typed anything for this strategy, we don't save; 
        // unless they cleared the input? For simplicity, we just insert new if string isn't empty.
        // Wait, what if they already had a price? We just delete old ones for this strategy and insert new.
        if (valStr && !isNaN(Number(valStr)) && Number(valStr) > 0) {
           // delete old one
           const existing = (prices[itemId] || []).find(p => p.title === st);
           if (existing) {
             await fetchJson(`/items/${itemId}/prices/${existing.id}`, { method: 'DELETE' });
           }
           await fetchJson(`/items/${itemId}/prices`, {
             method: 'POST',
             body: JSON.stringify({ title: st, price: Number(valStr), currency: 'IRR' })
           });
        }
      }
      
      // Update local state by fetching this item again
      const currentPrices = await fetchJson(`/items/${itemId}/prices`);
      setPrices(prev => ({ ...prev, [itemId]: currentPrices }));
      
      // clear local edits
      setLocalEdits(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    } catch(err: any) { toast.error(err.message); }
    setSavingId(null);
  };

  const handleDeletePrice = async (itemId: number, priceId: number) => {
    if(!confirm('حذف قیمت؟')) return;
    try {
      await fetchJson(`/items/${itemId}/prices/${priceId}`, { method: 'DELETE' });
      const currentPrices = await fetchJson(`/items/${itemId}/prices`);
      setPrices(prev => ({ ...prev, [itemId]: currentPrices }));
    } catch(err: any) { toast.error(err.message); }
  };

  const filtered = items.filter(c => 
    (c.name.includes(search) || c.code.includes(search) || (c.category && c.category.includes(search))) &&
    (selectedCategory ? c.category === selectedCategory : true)
  );

  const handleBulkUpdate = async () => {
    if (!bulkPercent || isNaN(Number(bulkPercent))) return;
    if (!confirm(`آیا مطمئن هستید که می‌خواهید روی نتایج جستجوی فعلی (${filtered.length} کالا) افزایش ${bulkPercent} درصدی اعمال کنید؟`)) return;

    try {
      const itemIds = filtered.map(i => i.id);
      await fetchJson('/items/prices/bulk', {
        method: 'POST',
        body: JSON.stringify({ itemIds, percentage: Number(bulkPercent) })
      });
      toast.success('با موفقیت بروزرسانی شد.');
      setBulkMode(false);
      loadData();
    } catch(err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b flex justify-between items-center bg-slate-50 shrink-0">
        <div>
          <h2 className="text-lg font-bold">مدیریت قیمت‌گذاری</h2>
          <p className="text-xs text-slate-500 mt-1">عناوین در بخش تنظیمات قابل تغییر هستند.</p>
        </div>
        
        <div className="flex gap-4 items-center">
          <div className="flex bg-slate-200 rounded-lg p-1">
            <button 
              onClick={() => setTab('product')} 
              className={cn("px-4 py-1.5 rounded-md text-sm font-bold transition-all", tab === 'product' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              محصولات نهایی
            </button>
            <button 
              onClick={() => setTab('raw_material')} 
              className={cn("px-4 py-1.5 rounded-md text-sm font-bold transition-all", tab === 'raw_material' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              مواد اولیه
            </button>
          </div>
          {user.role === 'admin' && (
            <button onClick={() => setBulkMode(!bulkMode)} className="text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold px-4 py-2 rounded-lg transition-colors">
              تغییر گروهی قیمت‌ها
            </button>
          )}
        </div>
      </div>

      {bulkMode && (
        <div className="bg-indigo-50 border-b border-indigo-100 p-4 shrink-0 flex items-end gap-4">
          <div className="flex-1 max-w-sm">
            <label className="block text-xs font-bold text-indigo-800 mb-1">افزایش دسته جمعی (درصد):</label>
            <input type="number" dir="ltr" value={bulkPercent} onChange={e => setBulkPercent(e.target.value)} placeholder="+10 or -10" className="w-full text-sm py-1.5 px-3 rounded border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button onClick={handleBulkUpdate} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-4 py-1.5 rounded">اعمال بر روی موارد جستجو شده</button>
          <button onClick={() => setBulkMode(false)} className="text-indigo-600 text-sm hover:underline">انصراف</button>
        </div>
      )}

      <div className="p-3 bg-slate-50 border-b flex justify-between items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 w-full max-w-2xl">
          <div className="relative w-full max-w-sm">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="جستجو محصول یا کد..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-3 pr-10 py-1.5 rounded border text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-48 py-1.5 px-3 rounded border text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="">همه دسته‌بندی‌ها</option>
            {categories.filter(c => c.type === tab).length === 0 && <option disabled>دسته بندی یافت نشد</option>}
            {categories.filter(c => c.type === tab).map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-slate-50/50">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(item => {
            const currentItemPrices = prices[item.id] || [];
            const hasLocalEdits = !!localEdits[item.id];
            
            return (
            <div key={item.id} className="border border-slate-200 rounded-xl p-0 flex flex-col bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              <div className="flex gap-4 items-center bg-slate-50 p-4 border-b">
                {item.thumbnail ? (
                  <img src={item.thumbnail} className="w-14 h-14 rounded object-cover border bg-white" />
                ) : (
                  <div className="w-14 h-14 rounded bg-slate-100 flex items-center justify-center text-slate-400 text-xs border border-slate-200">بدون عکس</div>
                )}
                <div>
                  <div className="font-bold text-sm text-slate-800">{item.name}</div>
                  <div className="font-mono text-xs text-slate-500 mt-1">{item.code}</div>
                  <div className="text-[10px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded inline-block mt-1">{item.category || 'بدون دسته'}</div>
                </div>
              </div>

              <div className="flex-1 p-4 flex flex-col gap-3">
                {strategies.map(st => {
                  const existingPriceRecord = currentItemPrices.find(p => p.title === st);
                  const isEditing = localEdits[item.id]?.[st] !== undefined;
                  const displayVal = isEditing ? localEdits[item.id][st] : (existingPriceRecord ? existingPriceRecord.price.toString() : '');
                  
                  return (
                    <div key={st} className="flex items-center gap-3">
                      <div className="w-24 shrink-0 text-xs font-bold text-slate-600">{st}</div>
                      <div className="flex-1 relative">
                        <input
                          type="number"
                          dir="ltr"
                          placeholder="مثلاً ۱۰۰,۰۰۰"
                          value={displayVal}
                          onChange={(e) => handlePriceChange(item.id, st, e.target.value)}
                          className={cn(
                            "w-full border rounded text-sm px-3 py-1.5 font-mono text-left focus:outline-none focus:ring-1 focus:ring-blue-500",
                            isEditing ? "border-blue-300 bg-blue-50/30" : "border-slate-200"
                          )}
                        />
                        {existingPriceRecord && !isEditing && (
                          <div className="absolute right-3 top-2 text-[10px] text-slate-400 bg-white">ثبت شده</div>
                        )}
                      </div>
                      <div className="w-10 flex shrink-0 justify-end">
                         {existingPriceRecord && (
                            <button onClick={() => handleDeletePrice(item.id, existingPriceRecord.id)} className="text-red-400 hover:text-red-600 p-1 bg-red-50 rounded" title="حذف این قیمت">
                              <Trash2 size={14} />
                            </button>
                         )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {user.role !== 'viewer' && (
                <div className="p-3 bg-slate-50 border-t flex justify-between items-center">
                  <div className="text-xs text-slate-500">
                    {currentItemPrices.length} قیمت در سیستم
                  </div>
                  <button 
                    disabled={!hasLocalEdits || savingId === item.id}
                    onClick={() => handleSaveItemPrices(item.id)} 
                    className={cn(
                      "px-4 py-1.5 text-xs font-bold rounded flex items-center gap-2 transition-colors",
                      hasLocalEdits 
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm" 
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    )}
                  >
                    {savingId === item.id ? 'در حال ثبت...' : <><Save size={14} /> ثبت تغییرات قیمت</>}
                  </button>
                </div>
              )}
            </div>
          )})}
        </div>
      </div>
    </div>
  );
}

