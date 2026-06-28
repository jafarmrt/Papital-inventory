import React, { useEffect, useState } from 'react';
import { fetchJson } from '../api';
import { toast } from 'react-hot-toast';
import { Item, User } from '../types';
import { Plus, Trash2 } from 'lucide-react';
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

export default function DocumentsPage({ actionType, title, user: currentUser }: { actionType: 'in' | 'out', title: string, user: User }) {
  const [items, setItems] = useState<Item[]>([]);
  const [docType, setDocType] = useState(actionType === 'in' ? 'receipt' : 'invoice');
  const [refNumber, setRefNumber] = useState('');
  const [date, setDate] = useState<any>(new Date());
  const [user, setUser] = useState(currentUser.full_name);
  const [warehouses, setWarehouses] = useState<{code: string, name: string}[]>([]);
  const [location, setLocation] = useState('safe');

  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  
  const [docItems, setDocItems] = useState<{item: Item, quantity: number}[]>([]);

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
    // reset form when actionType changes
    setDocType(actionType === 'in' ? 'receipt' : 'invoice');
    setDocItems([]);
    setRefNumber('');
  }, [actionType]);

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
          inOut: actionType,
          items: docItems.map(d => ({ itemId: d.item.id, quantity: d.quantity }))
        })
      });
      toast.success('سند با موفقیت ثبت شد!');
      setDocItems([]);
      setRefNumber('');
      setUser('');
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
        <div className="p-4 border-b flex justify-between items-center bg-white">
          <h3 className="font-bold flex items-center gap-2">📝 {title}</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    <option value="invoice">فاکتور فروش</option>
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
              <label className="block text-xs font-medium mb-1 text-slate-500">کاربر / تحویل گیرنده</label>
              <input required type="text" value={user} onChange={e => setUser(e.target.value)} className="w-full border rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
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
                        <span className="font-bold text-blue-600">{d.quantity}</span> <span className="text-slate-500 text-xs">{d.item.unit}</span>
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
