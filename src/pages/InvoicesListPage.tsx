import React, { useEffect, useState, useCallback } from 'react';
import { fetchJson } from '../api';
import { Search, Printer, Edit3 } from 'lucide-react';
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { formatPersianNumber, formatPersianPrice } from '../utils';
import InvoicePrintView from '../components/InvoicePrintView';

export default function InvoicesListPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState<any>('');
  const [endDate, setEndDate] = useState<any>('');
  const [loading, setLoading] = useState(false);

  const [editingNotesId, setEditingNotesId] = useState<number | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  
  const [printedDoc, setPrintedDoc] = useState<any>(null);

  const formatToGregorian = (d: any): string => {
    if (!d) return '';
    if (d.toDate) {
      return d.toDate().toISOString().split('T')[0];
    }
    if (d instanceof Date) {
      return d.toISOString().split('T')[0];
    }
    return String(d);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/documents';
      
      const res = await fetchJson(url);
      let filtered = res;
      
      const startStr = formatToGregorian(startDate);
      const endStr = formatToGregorian(endDate);
      
      if (startStr) {
        filtered = filtered.filter((d: any) => d.date >= startStr);
      }
      if (endStr) {
        filtered = filtered.filter((d: any) => d.date <= endStr);
      }
      if (search) {
        filtered = filtered.filter((d: any) => 
          (d.ref_number || '').includes(search) || 
          (d.buyer_name || '').includes(search)
        );
      }

      setDocs(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateNotes = async (id: number) => {
    try {
      await fetchJson(`/documents/${id}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes: tempNotes })
      });
      setDocs(prev => prev.map(d => d.id === id ? { ...d, notes: tempNotes } : d));
      setEditingNotesId(null);
    } catch (err) {
      console.error(err);
      alert('خطا در بروزرسانی توضیحات');
    }
  };

  const handlePrint = async (id: number) => {
    try {
      setLoading(true);
      const doc = await fetchJson(`/documents/${id}`);
      setPrintedDoc(doc);
    } catch (err) {
      console.error(err);
      alert('خطا در بارگذاری اطلاعات فاکتور');
    } finally {
      setLoading(false);
    }
  };

  if (printedDoc) {
    return (
      <div className="space-y-6">
        <div className="flex gap-4 mb-4 print:hidden">
          <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2 font-bold">
            <Printer size={18} /> چاپ فاکتور (A4)
          </button>
          <button onClick={() => setPrintedDoc(null)} className="border px-4 py-2 rounded hover:bg-slate-50 font-medium">
            بازگشت به لیست
          </button>
        </div>
        
        <InvoicePrintView printedDoc={printedDoc} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl shadow-sm flex flex-col min-h-[460px]">
        <div className="p-4 border-b flex justify-between items-center bg-white flex-wrap gap-4">
          <h3 className="font-bold flex items-center gap-2">📄 لیست اسناد و فاکتورها</h3>
        </div>

        <div className="p-3 bg-slate-50 border-b flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="جستجو فاکتور یا شخص..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-3 pr-10 py-1.5 rounded border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-2 items-center flex-wrap">
             <div className="flex items-center gap-2 text-sm">
               <span className="text-slate-600">از:</span>
               <DatePicker 
                 value={startDate} 
                 onChange={setStartDate} 
                 calendar={persian} 
                 locale={persian_fa} 
                 calendarPosition="bottom-right"
                 inputClass="p-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none w-32" 
                 containerClassName="inline-block"
               />
             </div>
             <div className="flex items-center gap-2 text-sm">
               <span className="text-slate-600">تا:</span>
               <DatePicker 
                 value={endDate} 
                 onChange={setEndDate} 
                 calendar={persian} 
                 locale={persian_fa} 
                 calendarPosition="bottom-right"
                 inputClass="p-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none w-32" 
                 containerClassName="inline-block"
               />
             </div>
             {(startDate || endDate || search) && (
                <button onClick={() => { setStartDate(''); setEndDate(''); setSearch(''); }} className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1">
                  پاک کردن فیلترها
                </button>
             )}
          </div>
        </div>

        <div className="flex-1 overflow-auto relative min-h-[300px]">
          {loading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-500 border-b sticky top-0 z-0">
              <tr>
                <th className="p-3 font-medium">شماره سند</th>
                <th className="p-3 font-medium">نوع سند</th>
                <th className="p-3 font-medium">وضعیت</th>
                <th className="p-3 font-medium">تاریخ</th>
                <th className="p-3 font-medium">شخص</th>
                <th className="p-3 font-medium">مبلغ نهایی</th>
                <th className="p-3 font-medium w-1/3">توضیحات</th>
                <th className="p-3 font-medium text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {docs.map(doc => {
                let typeLabel = doc.type;
                if (doc.type === 'invoice') typeLabel = 'فاکتور فروش';
                if (doc.type === 'receipt') typeLabel = 'رسید انبار';
                if (doc.type === 'remittance') typeLabel = 'حواله خروج';
                if (doc.type === 'return') typeLabel = 'برگشت از فروش';
                if (doc.type === 'waste') typeLabel = 'ضایعات';

                return (
                  <tr key={doc.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="p-3 font-mono text-slate-700 font-bold">{formatPersianNumber(doc.ref_number)}</td>
                    <td className="p-3 text-slate-600 font-medium whitespace-nowrap">{typeLabel}</td>
                    <td className="p-3">
                      {doc.status === 'proforma' ? (
                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs">پیش‌فاکتور</span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs">نهایی</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-500" dir="ltr">{formatPersianNumber(new Date(doc.date).toLocaleDateString('fa-IR'))}</td>
                    <td className="p-3 text-slate-700 font-medium">{doc.buyer_name || '-'}</td>
                    <td className="p-3 font-bold text-indigo-700">
                      {doc.type === 'invoice' ? formatPersianPrice(doc.items?.reduce((acc: any, i: any) => acc + (i.quantity * i.unit_price) - i.discount, 0) || 0) + ' ریال' : '-'}
                    </td>
                    <td className="p-3">
                    {editingNotesId === doc.id ? (
                      <div className="flex items-center gap-2">
                        <textarea 
                          value={tempNotes} 
                          onChange={e => setTempNotes(e.target.value)} 
                          className="w-full border rounded p-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                          rows={2}
                        />
                        <div className="flex flex-col gap-1">
                          <button onClick={() => handleUpdateNotes(doc.id)} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">ثبت</button>
                          <button onClick={() => setEditingNotesId(null)} className="bg-slate-200 px-2 py-1 rounded text-xs">لغو</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between group">
                        <span className="text-slate-600 text-xs truncate max-w-[200px]" title={doc.notes}>{doc.notes || '-'}</span>
                        <button 
                          onClick={() => { setEditingNotesId(doc.id); setTempNotes(doc.notes || ''); }} 
                          className="opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700 p-1"
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <button 
                      onClick={() => handlePrint(doc.id)} 
                      className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-md font-medium text-xs transition-colors"
                    >
                      <Printer size={14} /> نمایش و چاپ
                    </button>
                  </td>
                </tr>
              )})}
              {!loading && docs.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 text-sm">سندی یافت نشد.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
