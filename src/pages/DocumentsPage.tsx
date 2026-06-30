import React, { useEffect, useState } from 'react';
import { fetchJson } from '../api';
import { toast } from 'react-hot-toast';
import { Item, User } from '../types';
import { Plus, Trash2 } from 'lucide-react';
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

export default function DocumentsPage({ user: currentUser }: { user: User }) {
  const [actionType, setActionType] = useState<'in' | 'out'>('in');
  const [items, setItems] = useState<Item[]>([]);
  const [docType, setDocType] = useState('in');
  const [refNumber, setRefNumber] = useState('');
  const [date, setDate] = useState<any>(new Date());
  const [user, setUser] = useState(currentUser.full_name);
  const [warehouses, setWarehouses] = useState<{code: string, name: string}[]>([]);
  const [location, setLocation] = useState('safe');
  const [buyerName, setBuyerName] = useState('');
  const [returnInvoiceRef, setReturnInvoiceRef] = useState('');
  const [notes, setNotes] = useState('');

  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  
  const [docItems, setDocItems] = useState<{item: Item, quantity: number}[]>([]);

  const handleFetchReturnInvoice = async () => {
    if (!returnInvoiceRef) return;
    try {
      const doc = await fetchJson(`/documents/by-ref/${returnInvoiceRef}?type=invoice`);
      if (doc && doc.items) {
        setBuyerName(doc.buyer_name || '');
        const newDocItems = doc.items.map((i: any) => ({
          item: { id: i.item_id, name: i.name, code: i.code, unit: i.unit },
          quantity: i.quantity
        }));
        setDocItems(newDocItems);
        setNotes(`برگشت از فاکتور فروش شماره ${returnInvoiceRef}`);
        toast.success('اقلام فاکتور مرجع با موفقیت بارگذاری شد.');
      }
    } catch (e: any) {
      toast.error('فاکتوری با این شماره یافت نشد.');
    }
  };

  const fetchNextRef = async () => {
    if (!docType) return;
    try {
      const { nextRef } = await fetchJson(`/documents/next-ref?type=${docType}`);
      setRefNumber(nextRef);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchJson('/items?limit=0').then(res => {
      if (res && res.data) setItems(res.data);
      else if (Array.isArray(res)) setItems(res);
    }).catch(console.error);
    fetchJson('/warehouses').then(whs => {
      setWarehouses(whs);
      if (whs.length > 0) {
        setLocation(whs[0].code);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    // reset form when actionType changes
    setDocType(actionType === 'in' ? 'receipt' : 'remittance');
    setDocItems([]);
    setBuyerName('');
  }, [actionType]);

  useEffect(() => {
    fetchNextRef();
  }, [docType]);

  const handleAddItem = () => {
    if (!selectedItem) {
      toast.error('لطفاً ابتدا کالا را انتخاب کنید.');
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      toast.error('لطفاً تعداد کالا را وارد کنید (باید بیشتر از صفر باشد).');
      return;
    }
    const it = items.find(i => i.id.toString() === selectedItem);
    if (!it) return;

    if (actionType === 'out' && it.current_stock < Number(quantity)) {
      toast.error(`موجودی کافی نیست! موجودی فعلی: ${it.current_stock}`);
      return;
    }

    setDocItems(prev => {
      const existing = prev.find(p => p.item.id === it.id);
      if (existing) {
        return prev.map(p => p.item.id === it.id ? { ...p, quantity: p.quantity + Number(quantity) } : p);
      }
      return [...prev, { item: it, quantity: Number(quantity) }];
    });
    setSelectedItem('');
    setQuantity('');
  };

  const handleRemove = (id: number) => {
    setDocItems(prev => prev.filter(p => p.item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (docItems.length === 0) {
      toast.error('هیچ کالایی اضافه نشده است.');
      return;
    }

    try {
      // formatting the date parameter correctly to ISO or string format
      let formattedDate = '';
      if (date && date.toDate) {
        formattedDate = date.toDate().toISOString().split('T')[0];
      } else if (date instanceof Date) {
        formattedDate = date.toISOString().split('T')[0];
      } else {
        formattedDate = new Date().toISOString().split('T')[0];
      }

      await fetchJson('/documents', {
        method: 'POST',
        body: JSON.stringify({
          docType,
          refNumber,
          date: formattedDate,
          user,
          location,
          buyer_name: buyerName,
          notes,
          inOut: actionType,
          items: docItems.map(d => ({ itemId: d.item.id, quantity: d.quantity }))
        })
      });
      toast.success('سند با موفقیت ثبت شد!');
      setDocItems([]);
      fetchNextRef();
      setUser('');
      setBuyerName('');
      setNotes('');
      // refresh items stock silently
      fetchJson('/items?limit=0').then(res => {
        if (res && res.data) setItems(res.data);
        else if (Array.isArray(res)) setItems(res);
      }).catch(console.error);
    } catch (err: any) {
      toast.error(err.message || 'خطا در ثبت سند');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl shadow-sm flex flex-col">
        <div className="flex border-b text-sm font-medium">
          <button 
            type="button" 
            className={`flex-1 py-4 text-center border-b-2 transition-colors ${actionType === 'in' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            onClick={() => setActionType('in')}
          >
            ورود به انبار (رسید)
          </button>
          <button 
            type="button" 
            className={`flex-1 py-4 text-center border-b-2 transition-colors ${actionType === 'out' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            onClick={() => setActionType('out')}
          >
            خروج از انبار (حواله)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-500">نوع سند</label>
              <select className="w-full border rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" value={docType} onChange={e => setDocType(e.target.value)}>
                {actionType === 'in' ? (
                  <>
                    <option value="receipt">رسید انبار</option>
                    <option value="return">برگشت از فروش</option>
                  </>
                ) : (
                  <>
                    <option value="remittance">حواله خروج مصرف</option>
                    <option value="waste">ضایعات</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-500">شماره سند / رفرنس</label>
              <input required type="text" value={refNumber} onChange={e => setRefNumber(e.target.value)} className="w-full border rounded text-sm px-3 py-1.5 text-left font-mono focus:outline-none focus:ring-1 focus:ring-blue-500" dir="ltr" />
            </div>
            {docType === 'return' && (
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-500">شماره فاکتور مرجع</label>
                <div className="flex gap-2">
                  <input type="text" value={returnInvoiceRef} onChange={e => setReturnInvoiceRef(e.target.value)} placeholder="مثال: 1005" className="w-full border rounded text-sm px-3 py-1.5 text-left font-mono focus:outline-none focus:ring-1 focus:ring-blue-500" dir="ltr" />
                  <button type="button" onClick={handleFetchReturnInvoice} className="bg-slate-100 border text-slate-600 px-3 rounded hover:bg-slate-200 text-sm whitespace-nowrap">
                    جستجو
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-500">{actionType === 'in' ? 'تحویل دهنده' : 'گیرنده حواله'}</label>
              <input required={actionType === 'out'} type="text" value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder={actionType === 'in' ? 'اختیاری...' : 'الزامی...'} className="w-full border rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-500">انبار</label>
              <select className="w-full border rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" value={location} onChange={e => setLocation(e.target.value)}>
                {warehouses.map(wh => (
                  <option key={wh.code} value={wh.code}>{wh.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-500">تاریخ</label>
              <DatePicker 
                value={date} 
                onChange={setDate} 
                calendar={persian} 
                locale={persian_fa} 
                calendarPosition="bottom-right"
                inputClass="w-full border rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" 
                containerClassName="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-500">کاربر / صادرکننده</label>
              <input required type="text" value={user} onChange={e => setUser(e.target.value)} className="w-full border rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1 text-slate-500">توضیحات</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="توضیحات تکمیلی..." className="w-full border rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-bold mb-3">اقلام سند</h3>
            <div className="flex gap-3 items-end bg-slate-50 p-3 rounded border">
              <div className="flex-1">
                <label className="block text-xs mb-1 text-slate-500">انتخاب کالا / ماده اولیه</label>
                <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)} className="w-full border rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="">- انتخاب کنید -</option>
                  {items.map(it => (
                    <option key={it.id} value={it.id} disabled={actionType === 'out' && it.current_stock <= 0}>
                      {it.code} - {it.name} (موجودی: {it.current_stock} {it.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="block text-xs mb-1 text-slate-500">تعداد</label>
                <input type="number" min="0" step="any" value={quantity} onChange={e => setQuantity(e.target.value ? Number(e.target.value) : '')} className="w-full border rounded text-sm px-3 py-1.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500" dir="ltr" />
              </div>
              <button type="button" onClick={handleAddItem} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded flex items-center gap-1 text-sm h-[34px] transition-colors">
                <Plus size={16} /> افزودن
              </button>
            </div>
          </div>

          {docItems.length > 0 && (
            <div className="border rounded overflow-hidden">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-500 border-b">
                  <tr>
                    <th className="p-3 font-medium">کد</th>
                    <th className="p-3 font-medium">نام</th>
                    <th className="p-3 font-medium">تعداد / مقدار</th>
                    <th className="p-3 font-medium text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {docItems.map((d, i) => (
                    <tr key={i} className="hover:bg-blue-50/50">
                      <td className="p-3 font-mono">{d.item.code}</td>
                      <td className="p-3 font-bold">{d.item.name}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            min="0" 
                            step="any"
                            value={d.quantity} 
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setDocItems(prev => prev.map((item, idx) => idx === i ? { ...item, quantity: val } : item));
                            }} 
                            className="w-20 border rounded px-2 py-1 text-center text-sm" 
                            dir="ltr"
                          />
                          <span className="text-slate-500 text-xs">{d.item.unit}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <button type="button" onClick={() => handleRemove(d.item.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t pt-4 flex justify-end">
            <button type="submit" disabled={docItems.length === 0 || currentUser.role === 'viewer'} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded text-sm font-medium shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              ثبت نهایی سند
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
