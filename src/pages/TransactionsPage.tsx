import { useEffect, useState, useCallback } from 'react';
import { fetchJson } from '../api';
import { Transaction } from '../types';
import { Search, ArrowDownRight, ArrowUpRight, Download, ChevronRight, ChevronLeft } from 'lucide-react';
import * as xlsx from 'xlsx';
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState<any>('');
  const [endDate, setEndDate] = useState<any>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);

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
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      if (search) query.append('search', search);

      const startStr = formatToGregorian(startDate);
      const endStr = formatToGregorian(endDate);
      if (startStr) query.append('startDate', startStr);
      if (endStr) query.append('endDate', endStr);

      const res = await fetchJson(`/transactions?${query.toString()}`);
      if (res && res.data) {
        setTxs(res.data);
        setTotalPages(res.totalPages);
        setTotalItems(res.total);
      } else if (Array.isArray(res)) {
        setTxs(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset to page 1 on filter change
  useEffect(() => {
    setPage(1);
  }, [search, startDate, endDate]);

  const handleExport = async () => {
    try {
      const query = new URLSearchParams({
        export: 'true',
      });
      if (search) query.append('search', search);

      const startStr = formatToGregorian(startDate);
      const endStr = formatToGregorian(endDate);
      if (startStr) query.append('startDate', startStr);
      if (endStr) query.append('endDate', endStr);

      const fullData: Transaction[] = await fetchJson(`/transactions?${query.toString()}`);

      const ws = xlsx.utils.json_to_sheet(fullData.map(t => ({
        'تاریخ': new Date(t.date).toLocaleDateString('fa-IR'),
        'کاربر': t.user || '-',
        'نوع تراکنش': t.type === 'in' ? 'ورود به انبار' : 'خروج از انبار',
        'نام کالا': t.item_name,
        'کد کالا': t.item_code,
        'نوع کالا': t.item_type === 'product' ? 'محصول' : 'ماده اولیه',
        'مقدار': t.quantity,
        'واحد': t.item_unit,
        'کد پیگیری/سند': t.document_ref,
        'نوع سند': t.document_type
      })));
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'تراکنش‌ها');
      xlsx.writeFile(wb, `Transactions.xlsx`);
    } catch(err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl shadow-sm flex flex-col min-h-[460px]">
        <div className="p-4 border-b flex justify-between items-center bg-white flex-wrap gap-4">
          <h3 className="font-bold flex items-center gap-2">📊 گزارش تراکنش‌ها و گردش کالا</h3>
          <div className="flex gap-2">
            <button onClick={handleExport} className="px-3 py-1.5 text-xs font-medium border rounded hover:bg-slate-50 transition-colors flex items-center gap-1">
              <Download size={14} /> خروجی اکسل
            </button>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border-b flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="جستجو کالا، کد یا شماره سند..."
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
                <th className="p-3 font-medium">تاریخ</th>
                <th className="p-3 font-medium">کاربر</th>
                <th className="p-3 font-medium">نوع تراکنش</th>
                <th className="p-3 font-medium">کالا</th>
                <th className="p-3 font-medium">تعداد / مقدار</th>
                <th className="p-3 font-medium">شماره سند / حواله</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {txs.map(t => (
                <tr key={t.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="p-3 font-mono text-slate-500" dir="ltr">{new Date(t.date).toLocaleDateString('fa-IR')}</td>
                  <td className="p-3 text-slate-700 font-medium">{t.user || '-'}</td>
                  <td className="p-3">
                    {t.type === 'in' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium text-xs">
                        <ArrowDownRight size={14} /> ورود به انبار
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-100 text-rose-800 font-medium text-xs">
                        <ArrowUpRight size={14} /> خروج از انبار
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-slate-800">{t.item_name} <span className="text-xs text-slate-400 font-normal bg-slate-100 px-1 rounded">{t.item_type === 'product' ? 'محصول' : 'ماده اولیه'}</span></div>
                    <div className="font-mono text-xs text-slate-500 mt-1">{t.item_code}</div>
                  </td>
                  <td className="p-3 font-bold">
                    <span className={t.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}>
                      {t.type === 'in' ? '+' : '-'}{t.quantity.toLocaleString()}
                    </span>
                    <span className="text-xs font-normal text-slate-500 mr-1">{t.item_unit}</span>
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-slate-800">{t.document_ref}</div>
                    <div className="text-xs text-slate-500">{t.document_type}</div>
                  </td>
                </tr>
              ))}
              {!loading && txs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 text-sm">موردی یافت نشد.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-3 bg-slate-50 border-t flex items-center justify-between mt-auto">
          <span className="text-xs text-slate-500">
            نمایش {txs.length} مورد {totalItems > 0 ? `از کل ${totalItems} مورد` : ''}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1 border rounded bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-600"
              >
                <ChevronRight size={16} />
              </button>
              <span className="text-xs font-medium px-2 text-slate-600">
                صفحه {page} از {totalPages}
              </span>
              <button 
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-1 border rounded bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-600"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
