import React, { useEffect, useState } from 'react';
import { fetchJson } from '../api';
import { Item, User } from '../types';
import { Search } from 'lucide-react';
import { cn } from '../utils';

export default function GalleryPage({ user }: { user: User }) {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'product'|'raw_material'>('product');

  const loadData = async () => {
    try {
      const allItems = await fetchJson(`/items?type=${tab}`);
      setItems(allItems);
    } catch(err) {}
  };

  useEffect(() => {
    loadData();
  }, [tab]);

  // filter only items that have an image or thumbnail
  const withImages = items.filter(c => c.image || c.thumbnail);
  
  const filtered = withImages.filter(c => 
    c.name.includes(search) || 
    c.code.includes(search) || 
    (c.category && c.category.includes(search))
  );

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b flex flex-col md:flex-row justify-between items-center bg-slate-50 shrink-0 gap-4">
        <h2 className="text-lg font-bold">گالری تصاویر اقلام انبار</h2>
        
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
      </div>

      <div className="p-3 bg-slate-50 border-b flex justify-between items-center gap-4 shrink-0">
        <div className="relative w-full max-w-sm">
          <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="جستجو نام، کد یا دسته‌بندی..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-3 pr-10 py-1.5 rounded border text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 bg-slate-100">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {filtered.map(item => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md transition-shadow group relative">
              <a href={item.image || item.thumbnail} target="_blank" rel="noreferrer" className="aspect-square bg-slate-50 flex items-center justify-center p-2 relative overflow-hidden cursor-zoom-in">
                <img src={item.image || item.thumbnail} alt={item.name} className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform" />
              </a>
              <div className="p-3 bg-white flex flex-col gap-1 border-t">
                <div className="font-bold text-sm text-slate-800 line-clamp-1" title={item.name}>{item.name}</div>
                <div className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mr-auto select-all">{item.code}</div>
                <div className="text-[10px] text-slate-400">{item.category || 'بدون دسته'}</div>
              </div>
            </div>
          ))}
          
          {filtered.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-500 flex flex-col items-center">
              <div className="text-4xl mb-4">🖼️</div>
              <div>موردی برای نمایش در گالری یافت نشد. باید برای کالاها تصویر بارگذاری کنید.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
