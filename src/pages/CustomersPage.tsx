import React, { useEffect, useState } from 'react';
import { fetchJson } from '../api';
import { Customer, User } from '../types';
import { Search, Plus } from 'lucide-react';

export default function CustomersPage({ user }: { user: User }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', city: '', address: '', notes: '' });

  const loadCustomers = () => {
    fetchJson('/customers').then(setCustomers).catch();
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchJson('/customers', {
      method: 'POST',
      body: JSON.stringify(form)
    }).then(() => {
      setShowModal(false);
      setForm({ name: '', phone: '', city: '', address: '', notes: '' });
      loadCustomers();
    }).catch(err => alert(err.message));
  };

  const filtered = customers.filter(c => 
    c.name.includes(search) || 
    c.phone.includes(search) || 
    (c.city || '').includes(search)
  );

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b flex justify-between items-center bg-slate-50 shrink-0">
        <h2 className="text-lg font-bold">مدیریت مشتریان و تامین‌کنندگان</h2>
        {user.role !== 'viewer' && (
          <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm">
            <Plus size={16} /> ثبت شخص جدید
          </button>
        )}
      </div>

      <div className="p-3 bg-slate-50 border-b flex justify-between items-center gap-4 shrink-0">
        <div className="relative w-full max-w-sm">
          <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="جستجو مشتری..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-3 pr-10 py-1.5 rounded border text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-right">
          <thead className="bg-slate-50 text-slate-500 border-b sticky top-0 text-xs text-center">
            <tr>
              <th className="p-3 w-16">ردیف</th>
              <th className="p-3 font-medium text-right">نام شخص / شرکت</th>
              <th className="p-3 font-medium">شماره تماس</th>
              <th className="p-3 font-medium">شهر</th>
              <th className="p-3 font-medium text-right">آدرس کامل</th>
              <th className="p-3 font-medium text-right">یادداشت</th>
            </tr>
          </thead>
          <tbody className="divide-y text-xs">
            {filtered.map((c, idx) => (
              <tr key={c.id} className="hover:bg-blue-50/20 text-center">
                <td className="p-3 text-slate-400">{idx + 1}</td>
                <td className="p-3 font-bold text-slate-800 text-right">{c.name}</td>
                <td className="p-3 text-slate-700 font-mono" dir="ltr">{c.phone || '-'}</td>
                <td className="p-3 text-slate-600">{c.city || '-'}</td>
                <td className="p-3 text-slate-600 text-right">{c.address || '-'}</td>
                <td className="p-3 text-slate-500 text-right">{c.notes || '-'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">هیچ موردی یافت نشد.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm shadow flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg">ثبت حساب شخص جدید</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium mb-1">نام کامل / عنوان شرکت</label>
                  <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">شماره موبایل / تماس</label>
                  <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full border rounded-lg px-3 py-2 font-mono" dir="ltr" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">استان / شهر</label>
                  <input type="text" value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">آدرس پستی</label>
                  <textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full border rounded-lg px-3 py-2" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">یادداشت</label>
                  <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full border rounded-lg px-3 py-2" rows={2} />
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-2 bg-slate-50 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg hover:bg-white bg-transparent">انصراف</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold">ثبت و ذخیره</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
