import React, { useEffect, useState, useRef } from 'react';
import { fetchJson } from '../api';
import { Item, User } from '../types';
import { Plus, Trash2, Printer } from 'lucide-react';
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { cn } from '../utils';
import ConfirmModal from '../components/ConfirmModal';

// Print styles are added globally or inline
export default function CreateInvoicePage({ user: currentUser }: { user: User }) {
  const [items, setItems] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [itemPrices, setItemPrices] = useState<any[]>([]);
  const [docType, setDocType] = useState('invoice');
  const [status, setStatus] = useState('final'); // 'proforma' or 'final'
  const [location, setLocation] = useState<string>('safe');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  
  const [refNumber, setRefNumber] = useState('');
  const [date, setDate] = useState<any>(new Date());
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; docId: number }>({ isOpen: false, docId: 0 });
  
  // Buyer fields
  const [buyerName, setBuyerName] = useState('');
  const [buyerCity, setBuyerCity] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [discount, setDiscount] = useState<number | ''>(0);
  
  const [docItems, setDocItems] = useState<{item: Item, quantity: number, unitPrice: number, discount: number}[]>([]);

  // Print view state
  const [printedDoc, setPrintedDoc] = useState<any>(null);

  const fetchNextRef = async () => {
    try {
      const { nextRef } = await fetchJson('/documents/next-ref?type=out');
      setRefNumber(nextRef);
    } catch (e) { console.error(e); }
  };

  const [proformas, setProformas] = useState<any[]>([]);
  const loadProformas = () => {
    fetchJson('/documents?type=invoice').then(data => {
      setProformas(data.filter((d: any) => d.status === 'proforma'));
    }).catch(console.error);
  }

  useEffect(() => {
    fetchJson('/items').then(setItems).catch(console.error);
    fetchJson('/customers').then(setCustomers).catch(console.error);
    fetchJson('/warehouses').then(whs => {
      setWarehouses(whs);
      if (whs.length > 0) {
        setLocation(whs[0].code);
      }
    }).catch(console.error);
    fetchNextRef();
    loadProformas();
  }, []);

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      setBuyerName(''); setBuyerCity(''); setBuyerPhone(''); setBuyerAddress('');
      return;
    }
    const c = customers.find(c => c.id.toString() === val);
    if (c) {
      setBuyerName(c.name);
      setBuyerCity(c.city);
      setBuyerPhone(c.phone);
      setBuyerAddress(c.address);
    }
  };

  const handleItemSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedItem(val);
    setDiscount(0);
    setUnitPrice(0);
    setItemPrices([]);
    if (val) {
      fetchJson(`/items/${val}/prices`).then(setItemPrices).catch();
    }
  };

  const handleAddItem = () => {
    if (!selectedItem) {
      alert('لطفاً ابتدا کالا را انتخاب کنید.');
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      alert('لطفاً تعداد کالا را وارد کنید (باید بیشتر از صفر باشد).');
      return;
    }
    const it = items.find(i => i.id.toString() === selectedItem);
    if (!it) return;

    if (status === 'final' && docType === 'invoice') {
      const locationStock = (it as any)[`stock_${location}`] || 0;
      if (locationStock < Number(quantity)) {
        const whName = warehouses.find(w => w.code === location)?.name || location;
        alert(`عدم موجودی کافی در انبار انتخابی! موجودی ${whName}: ${locationStock} ${it.unit}`);
        return;
      }
    }

    setDocItems(prev => {
      const existing = prev.find(p => p.item.id === it.id);
      if (existing) {
        return prev.map(p => p.item.id === it.id ? { ...p, quantity: p.quantity + Number(quantity) } : p);
      }
      return [...prev, { item: it, quantity: Number(quantity), unitPrice: Number(unitPrice || 0), discount: Number(discount || 0) }];
    });
    setSelectedItem('');
    setQuantity('');
    setUnitPrice('');
    setDiscount(0);
  };

  const handleRemove = (id: number) => {
    setDocItems(prev => prev.filter(p => p.item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (docItems.length === 0) {
      alert('هیچ کالایی اضافه نشده است.');
      return;
    }

    try {
      let formattedDate = '';
      if (date && date.toDate) {
        formattedDate = date.toDate().toISOString().split('T')[0];
      } else if (date instanceof Date) {
        formattedDate = date.toISOString().split('T')[0];
      } else {
        formattedDate = new Date().toISOString().split('T')[0];
      }

      const res = await fetchJson('/documents', {
        method: 'POST',
        body: JSON.stringify({
          docType,
          status,
          refNumber,
          date: formattedDate,
          user: currentUser.full_name,
          inOut: 'out',
          buyer_name: buyerName,
          buyer_city: buyerCity,
          buyer_phone: buyerPhone,
          buyer_address: buyerAddress,
          notes,
          location,
          items: docItems.map(d => ({ itemId: d.item.id, quantity: d.quantity, unit_price: d.unitPrice, discount: d.discount }))
        })
      });
      alert('سند با موفقیت ثبت شد!');
      
      const docDetails = await fetchJson(`/documents/${res.docId}`);
      setPrintedDoc(docDetails);
      
      // Reset form
      setDocItems([]);
      setBuyerName('');
      setBuyerCity('');
      setBuyerPhone('');
      setBuyerAddress('');
      setNotes('');
      fetchNextRef();
      fetchJson('/items').then(setItems).catch();
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت سند');
    }
  };

  const executeFinalize = async () => {
    const docId = confirmState.docId;
    try {
      await fetchJson(`/documents/${docId}/finalize`, { method: 'PUT', body: JSON.stringify({ user: currentUser.full_name }) });
      alert('فاکتور نهایی شد.');
      loadProformas();
      fetchJson('/items').then(setItems).catch();
      setConfirmState({ isOpen: false, docId: 0 });
    } catch(err) { alert('خطا در عملیات'); }
  };

  const totalSum = docItems.reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);
  const totalDiscount = docItems.reduce((acc, curr) => acc + curr.discount, 0);
  const finalPrice = totalSum - totalDiscount;

  if (printedDoc) {
    return (
      <div className="space-y-6">
        <div className="flex gap-4 mb-4 print:hidden">
          <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2 font-bold">
            <Printer size={18} /> چاپ فاکتور (A4)
          </button>
          <button onClick={() => setPrintedDoc(null)} className="border px-4 py-2 rounded hover:bg-slate-50 font-medium">
            بازگشت به فرم ثبت
          </button>
        </div>
        
        {/* Printable Area - strictly reproducing the layout from PDF */}
        <div className="bg-white p-6 mx-auto w-full max-w-[200mm] shadow print:shadow-none print:w-full print:p-4 font-sans text-sm border print:border-none">
          <div className="bg-[#6c74ad] text-white flex justify-center py-3 mb-4 font-bold text-lg rounded-t-xl print:rounded-none" style={{ backgroundColor: '#6c74ad', printColorAdjust: 'exact' }}>
            صورتحساب فروش کالا و خدمات (گالری پاپیتال)
            {printedDoc.status === 'proforma' && ' - پیش فاکتور'}
          </div>
          <div className="flex justify-between items-center mb-2 text-xs">
            <div className="font-bold">شماره فاکتور: {printedDoc.ref_number}</div>
            <div className="font-bold">تاریخ: {new Date(printedDoc.date).toLocaleDateString('fa-IR')}</div>
          </div>
          
          <table className="w-full mb-4 border-collapse print:text-[13px]">
            <tbody>
              <tr>
                <td colSpan={4} className="bg-gray-100 text-center font-bold py-1 border" style={{ backgroundColor: '#f3f4f6', printColorAdjust: 'exact' }}>مشخصات فروشنده</td>
              </tr>
              <tr>
                <td className="py-1 px-2 border w-1/4"><strong>نام فروشنده:</strong> گالری پاپیتال</td>
                <td className="py-1 px-2 border w-1/4"><strong>استان / شهر:</strong> تهران / تهران</td>
                <td colSpan={2} className="py-1 px-2 border"><strong>تلفن:</strong> 09308128622</td>
              </tr>
              <tr>
                <td colSpan={4} className="py-1 px-2 border"><strong>نشانی:</strong> خیابان طالقانی، بن بست مسعود، پلاک 13</td>
              </tr>

              <tr>
                <td colSpan={4} className="bg-gray-100 text-center font-bold py-1 border mt-2" style={{ backgroundColor: '#f3f4f6', printColorAdjust: 'exact' }}>مشخصات خریدار</td>
              </tr>
              <tr>
                <td className="py-1 px-2 border w-1/4"><strong>نام خریدار:</strong> {printedDoc.buyer_name}</td>
                <td className="py-1 px-2 border w-1/4"><strong>استان / شهر:</strong> {printedDoc.buyer_city}</td>
                <td colSpan={2} className="py-1 px-2 border"><strong>تلفن:</strong> {printedDoc.buyer_phone}</td>
              </tr>
              <tr>
                <td colSpan={4} className="py-1 px-2 border"><strong>نشانی:</strong> {printedDoc.buyer_address}</td>
              </tr>
            </tbody>
          </table>

          <div className="bg-gray-100 text-center font-bold py-1 border border-b-0 print:text-[13px]" style={{ backgroundColor: '#f3f4f6', printColorAdjust: 'exact' }}>مشخصات کالا یا خدمات مورد معامله</div>
          <table className="w-full text-center border-collapse border print:text-[12px] break-inside-auto">
            <thead>
              <tr className="bg-[#6c74ad] text-white" style={{ backgroundColor: '#6c74ad', printColorAdjust: 'exact' }}>
                <th className="border p-1.5 font-medium">ردیف</th>
                <th className="border p-1.5 font-medium">کد کالا</th>
                <th className="border p-1.5 font-medium w-1/3">شرح کالا</th>
                <th className="border p-1.5 font-medium">تعداد</th>
                <th className="border p-1.5 font-medium">واحد</th>
                <th className="border p-1.5 font-medium">مبلغ واحد</th>
                <th className="border p-1.5 font-medium">مبلغ کل</th>
                <th className="border p-1.5 font-medium">تخفیف</th>
                <th className="border p-1.5 font-medium">مبلغ نهایی</th>
              </tr>
            </thead>
            <tbody>
              {printedDoc.items.map((item: any, idx: number) => {
                const total = item.quantity * item.unit_price;
                const final = total - item.discount;
                return (
                  <tr key={item.id} className="h-7 hover:bg-slate-50 break-inside-avoid">
                    <td className="border p-1 font-medium bg-slate-50">{idx + 1}</td>
                    <td className="border p-1 font-mono text-[11px]" dir="ltr">{item.code}</td>
                    <td className="border p-1 font-bold">{item.name}</td>
                    <td className="border p-1">{item.quantity}</td>
                    <td className="border p-1">{item.unit}</td>
                    <td className="border p-1">{item.unit_price.toLocaleString()}</td>
                    <td className="border p-1">{total.toLocaleString()}</td>
                    <td className="border p-1">{item.discount > 0 ? item.discount.toLocaleString() : ''}</td>
                    <td className="border p-1 font-bold bg-slate-50">{final.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <table className="w-full mt-2 border-collapse print:text-[13px] break-inside-avoid">
            <tbody>
              <tr>
                <td className="border p-2 align-top h-20" colSpan={4} rowSpan={3}>
                  <strong>توضیحات:</strong> {printedDoc.notes}
                </td>
                <td className="border p-2 bg-gray-50 w-32 font-bold" style={{ backgroundColor: '#f9fafb', printColorAdjust: 'exact' }}>جمع کل:</td>
                <td className="border p-2 w-40 text-left font-bold">{printedDoc.items.reduce((a:any, b:any)=>a+(b.quantity*b.unit_price),0).toLocaleString()}</td>
              </tr>
              <tr>
                <td className="border p-2 bg-gray-50 font-bold" style={{ backgroundColor: '#f9fafb', printColorAdjust: 'exact' }}>تخفیف:</td>
                <td className="border p-2 text-left font-bold">{printedDoc.items.reduce((a:any, b:any)=>a+b.discount,0).toLocaleString()}</td>
              </tr>
              <tr>
                <td className="border p-2 bg-gray-200 font-bold" style={{ backgroundColor: '#e5e7eb', printColorAdjust: 'exact' }}>مبلغ نهایی:</td>
                <td className="border p-2 text-left font-bold bg-gray-200" style={{ backgroundColor: '#e5e7eb', printColorAdjust: 'exact' }}>
                  {(printedDoc.items.reduce((a:any, b:any)=>a+(b.quantity*b.unit_price),0) - printedDoc.items.reduce((a:any, b:any)=>a+b.discount,0)).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-8 flex justify-between items-center text-center font-bold px-10">
            <div>مهر و امضاء خریدار</div>
            <div>مهر و امضاء فروشنده</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto print:hidden">
      <div className="bg-white border rounded-xl shadow-sm flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-white rounded-t-xl">
          <h3 className="font-bold flex items-center gap-2">📑 ثبت فاکتور فروش (پیش فاکتور/فاکتور)</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border">
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-500">وضعیت سند</label>
              <select className="w-full border rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-bold text-slate-700" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="proforma">پیش فاکتور (رزرو موقت)</option>
                <option value="final">فاکتور نهایی (کسر قطعی از انبار)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-500">محل خروج قلم کالا (انبار مبدا)</label>
              <select className="w-full border rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-bold text-slate-700" value={location} onChange={e => setLocation(e.target.value)}>
                {warehouses.map(w => (
                  <option key={w.code} value={w.code}>📦 {w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-500">شماره سند / رفرنس (اتومات)</label>
              <input required type="text" value={refNumber} onChange={e => setRefNumber(e.target.value)} className="w-full border shadow-sm rounded text-sm px-3 py-1.5 text-left font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-500">تاریخ</label>
              <DatePicker 
                value={date} 
                onChange={setDate} 
                calendar={persian} 
                locale={persian_fa} 
                calendarPosition="bottom-right"
                inputClass="w-full border shadow-sm rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" 
                containerClassName="w-full"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-bold mb-3 text-slate-800">مشخصات خریدار</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="col-span-1 md:col-span-4 bg-blue-50 p-3 rounded border border-blue-100 flex items-center gap-3">
                <label className="text-sm font-bold text-blue-800 min-w-[120px]">انتخاب از مشتریان سابق:</label>
                <select className="w-full max-w-sm border rounded px-3 py-1.5 focus:ring-1 focus:ring-blue-500 text-sm" onChange={handleCustomerSelect} defaultValue="">
                  <option value="">-- مشتری جدید (ورود دستی) --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1 text-slate-500">نام خریدار</label>
                <input type="text" value={buyerName} onChange={e=>setBuyerName(e.target.value)} className="w-full border rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs mb-1 text-slate-500">استان / شهر</label>
                <input type="text" value={buyerCity} onChange={e=>setBuyerCity(e.target.value)} className="w-full border rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs mb-1 text-slate-500">تلفن</label>
                <input type="text" value={buyerPhone} onChange={e=>setBuyerPhone(e.target.value)} className="w-full border rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" dir="ltr" />
              </div>
              <div className="col-span-1 md:col-span-3">
                <label className="block text-xs mb-1 text-slate-500">نشانی</label>
                <input type="text" value={buyerAddress} onChange={e=>setBuyerAddress(e.target.value)} className="w-full border rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-bold mb-3 text-slate-800">اقلام فاکتور</h3>
            <div className="flex flex-wrap gap-3 items-end bg-slate-50 p-3 rounded-lg border">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs mb-1 text-slate-500">انتخاب کالا</label>
                <select value={selectedItem} onChange={handleItemSelect} className="w-full border shadow-sm rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="">- انتخاب کالا / ماده اولیه -</option>
                  {items.map(it => (
                    <option key={it.id} value={it.id} disabled={status === 'final' && it.current_stock <= 0}>
                      {it.code} - {it.name} (موجودی: {it.current_stock} {it.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-48">
                <label className="block text-xs mb-1 text-slate-500">سیاست قیمتی از پیش تعریف شده</label>
                <select 
                  className="w-full border shadow-sm rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onChange={e => e.target.value && setUnitPrice(Number(e.target.value))}
                  disabled={!selectedItem || itemPrices.length === 0}
                  defaultValue=""
                >
                  <option value="">-- ورود دستی قیمت --</option>
                  {itemPrices.map(p => (
                    <option key={p.id} value={p.price}>{p.title} - {p.price.toLocaleString()} {p.currency}</option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="block text-xs mb-1 text-slate-500">تعداد</label>
                <input type="number" min="0" step="any" value={quantity} onChange={e => setQuantity(e.target.value ? Number(e.target.value) : '')} className="w-full shadow-sm border rounded text-sm px-3 py-1.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500" dir="ltr" />
              </div>
              <div className="w-32">
                <label className="block text-xs mb-1 text-slate-500">مبلغ واحد (ریال)</label>
                <input type="number" min="0" value={unitPrice} onChange={e => setUnitPrice(e.target.value ? Number(e.target.value) : '')} className="w-full border shadow-sm rounded text-sm px-3 py-1.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500" dir="ltr" />
              </div>
              <div className="w-32">
                <label className="block text-xs mb-1 text-slate-500">تخفیف کلی ردیف (ریال)</label>
                <input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value ? Number(e.target.value) : '')} className="w-full border shadow-sm rounded text-sm px-3 py-1.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500" dir="ltr" />
              </div>
              <button type="button" onClick={handleAddItem} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded flex items-center gap-1 text-sm h-[34px] transition-colors shadow-sm">
                <Plus size={16} /> افزودن به لیست
              </button>
            </div>
          </div>

          {docItems.length > 0 && (
            <div className="border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm text-right">
                <thead className="bg-[#6c74ad] text-white">
                  <tr>
                    <th className="p-3 font-medium">کد</th>
                    <th className="p-3 font-medium text-right">شرح کالا</th>
                    <th className="p-3 font-medium text-center">تعداد / مقدار</th>
                    <th className="p-3 font-medium text-center">مبلغ واحد (ریال)</th>
                    <th className="p-3 font-medium text-center">مبلغ کل (ریال)</th>
                    <th className="p-3 font-medium text-center">تخفیف (ریال)</th>
                    <th className="p-3 font-medium text-center">مبلغ نهایی (ریال)</th>
                    <th className="p-3 font-medium text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {docItems.map((d, i) => {
                    const rowTotal = d.quantity * d.unitPrice;
                    const rowFinal = rowTotal - d.discount;
                    return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-slate-500" dir="ltr">{d.item.code}</td>
                      <td className="p-3 font-bold text-slate-800">{d.item.name}</td>
                      <td className="p-3 text-center">
                        <span className="font-bold">{d.quantity}</span> <span className="text-slate-500 text-xs">{d.item.unit}</span>
                      </td>
                      <td className="p-3 text-center text-slate-700">{d.unitPrice.toLocaleString()}</td>
                      <td className="p-3 text-center font-bold text-slate-700">{rowTotal.toLocaleString()}</td>
                      <td className="p-3 text-center text-rose-600">{d.discount > 0 ? d.discount.toLocaleString() : '-'}</td>
                      <td className="p-3 text-center font-bold text-indigo-700">{rowFinal.toLocaleString()}</td>
                      <td className="p-3 text-center">
                        <button type="button" onClick={() => handleRemove(d.item.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded transition-colors inline-block">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
              <div className="bg-slate-50 p-4 border-t flex justify-end gap-8 text-sm">
                <div className="text-center font-medium text-slate-500">جمع کل: <span className="text-slate-800 font-bold block mt-1 text-lg">{totalSum.toLocaleString()}</span></div>
                <div className="text-center font-medium text-slate-500">تخفیف: <span className="text-rose-600 font-bold block mt-1 text-lg">{totalDiscount.toLocaleString()}</span></div>
                <div className="text-center font-medium text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg ml-0">مبلغ نهایی: <span className=" font-bold block mt-1 text-xl">{finalPrice.toLocaleString()} ریال</span></div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1 text-slate-500">توضیحات تکمیلی</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} className="w-full border rounded text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"></textarea>
          </div>

          <div className="border-t pt-4 flex justify-end">
            <button type="submit" disabled={docItems.length === 0 || currentUser.role === 'viewer'} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              ثبت و صدور فاکتور
            </button>
          </div>
        </form>
      </div>

      {proformas.length > 0 && (
        <div className="bg-white border rounded-xl shadow-sm flex flex-col p-6 mt-8">
          <h3 className="font-bold flex items-center gap-2 mb-4">⏳ پیش فاکتورهای باز</h3>
          <div className="border rounded-xl flex overflow-hidden">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-slate-500 border-b">
                <tr>
                  <th className="p-3 font-medium">شماره سند</th>
                  <th className="p-3 font-medium">تاریخ</th>
                  <th className="p-3 font-medium">نام خریدار</th>
                  <th className="p-3 font-medium text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {proformas.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold">{p.ref_number}</td>
                    <td className="p-3 font-mono">{new Date(p.date).toLocaleDateString('fa-IR')}</td>
                    <td className="p-3">{p.buyer_name || '-'}</td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={async () => {
                          const doc = await fetchJson(`/documents/${p.id}`);
                          setPrintedDoc(doc);
                        }} className="text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1 rounded text-xs transition-colors">نمایش / چاپ</button>
                        <button onClick={() => setConfirmState({ isOpen: true, docId: p.id })} className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1 rounded text-xs font-bold transition-colors">تبدیل به فاکتور</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        message="آیا مطمئن هستید که می‌خواهید این پیش‌فاکتور را به فاکتور نهایی تبدیل کنید؟ با این کار لغو رزرو موقت شده و کسر قطعی و دائم از موجودی انبارها انجام خواهد پذیرفت."
        onConfirm={executeFinalize}
        onCancel={() => setConfirmState({ isOpen: false, docId: 0 })}
      />
    </div>
  );
}
