import { useEffect, useState } from 'react';
import { fetchJson } from '../api';
import { Transaction } from '../types';
import { Search, ArrowDownRight, ArrowUpRight, Download } from 'lucide-react';
import * as xlsx from 'xlsx';

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchJson('/transactions').then(setTxs).catch(console.error);
  }, []);

  const filtered = txs.filter(t => 
    t.item_name?.includes(search) || t.item_code?.includes(search) || t.document_ref?.includes(search)
  );

  const handleExport = () => {
    const ws = xlsx.utils.json_to_sheet(filtered.map(t => ({
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
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl shadow-sm flex flex-col min-h-[460px]">
        <div className="p-4 border-b flex justify-between items-center bg-white">
          <h3 className="font-bold flex items-center gap-2">📊 گزارش تراکنش‌ها و گردش کالا</h3>
          <div className="flex gap-2">
            <button onClick={handleExport} className="px-3 py-1.5 text-xs font-medium border rounded hover:bg-slate-50 transition-colors flex items-center gap-1">
              <Download size={14} /> خروجی اکسل
            </button>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border-b flex justify-between items-center gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="جستجو کالا، کد یا شماره سند..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-3 pr-10 py-1.5 rounded border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-500 border-b sticky top-0">
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
              {filtered.map(t => (
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">موردی یافت نشد.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-3 bg-slate-50 border-t flex items-center justify-between mt-auto">
          <span className="text-xs text-slate-500">نمایش {filtered.length} مورد</span>
        </div>
      </div>
    </div>
  );
}
