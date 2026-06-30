import React, { useEffect, useState, useCallback } from 'react';
import { fetchJson } from '../api';
import { Customer, User } from '../types';
import { Search, Plus, ChevronRight, ChevronLeft, Edit2, Trash2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

const IRAN_PROVINCES = [
  'آذربایجان شرقی', 'آذربایجان غربی', 'اردبیل', 'اصفهان', 'البرز', 'ایلام',
  'بوشهر', 'تهران', 'چهارمحال و بختیاری', 'خراسان جنوبی', 'خراسان رضوی',
  'خراسان شمالی', 'خوزستان', 'زنجان', 'سمنان', 'سیستان و بلوچستان', 'فارس',
  'قزوین', 'قم', 'کردستان', 'کرمان', 'کرمانشاه', 'کهگیلویه و بویراحمد',
  'گلستان', 'گیلان', 'لرستان', 'مازندران', 'مرکزی', 'هرمزگان', 'همدان', 'یزد'
];

export default function CustomersPage({ user }: { user: User }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', contactName: '', country: 'ایران', province: '', phone: '', city: '', address: '', notes: '' });
  const [phoneList, setPhoneList] = useState<string[]>(['']);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      if (search) query.append('search', search);

      const res = await fetchJson(`/customers?${query.toString()}`);
      if (res && res.data) {
        setCustomers(res.data);
        setTotalPages(res.totalPages);
        setTotalItems(res.total);
      } else if (Array.isArray(res)) {
        setCustomers(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const handlePhoneChange = (index: number, val: string) => {
    const updated = [...phoneList];
    updated[index] = val;
    setPhoneList(updated);
  };

  const addPhoneField = () => {
    setPhoneList([...phoneList, '']);
  };

  const removePhoneField = (index: number) => {
    const updated = phoneList.filter((_, i) => i !== index);
    setPhoneList(updated.length ? updated : ['']);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validPhones = phoneList.filter(p => p.trim() !== '');
    const phoneRegex = /^[0-9+\-\s()]+$/;
    for (const p of validPhones) {
      if (!phoneRegex.test(p)) {
        toast.error(`فرمت شماره تلفن ${p} معتبر نیست. لطفاً فقط عدد وارد کنید.`);
        return;
      }
    }
    
    const finalForm = {
      ...form,
      phone: validPhones.join(', ')
    };

    const url = editingId ? `/customers/${editingId}` : '/customers';
    const method = editingId ? 'PUT' : 'POST';

    fetchJson(url, {
      method,
      body: JSON.stringify(finalForm)
    }).then(() => {
      setShowModal(false);
      setEditingId(null);
      resetForm();
      loadCustomers();
      toast.success(editingId ? 'با موفقیت ویرایش شد' : 'با موفقیت ثبت شد');
    }).catch(err => toast.error(err.message));
  };
  
  const resetForm = () => {
    setForm({ name: '', contactName: '', country: 'ایران', province: '', phone: '', city: '', address: '', notes: '' });
    setPhoneList(['']);
  };

  const handleEdit = (c: Customer) => {
    setForm({
      name: c.name,
      contactName: c.contactName || '',
      country: c.country || 'ایران',
      province: c.province || '',
      phone: c.phone || '',
      city: c.city || '',
      address: c.address || '',
      notes: c.notes || ''
    });
    setPhoneList(c.phone ? c.phone.split(',').map(s => s.trim()) : ['']);
    setEditingId(c.id);
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('آیا از حذف این شخص مطمئن هستید؟')) {
      fetchJson(`/customers/${id}`, { method: 'DELETE' }).then(() => {
        toast.success('شخص حذف شد');
        loadCustomers();
      }).catch(err => toast.error(err.message));
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[460px]">
      <div className="p-6 border-b flex justify-between items-center bg-slate-50 shrink-0">
        <h2 className="text-lg font-bold">مدیریت مشتریان و تامین‌کنندگان</h2>
        {user.role !== 'viewer' && (
          <button onClick={() => {
            setEditingId(null);
            resetForm();
            setShowModal(true);
          }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm">
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

      <div className="flex-1 overflow-auto relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        <table className="w-full text-sm text-right">
          <thead className="bg-slate-50 text-slate-500 border-b sticky top-0 text-xs text-center z-0">
            <tr>
              <th className="p-3 w-16">ردیف</th>
              <th className="p-3 font-medium text-right">نام شخص / شرکت</th>
              <th className="p-3 font-medium text-right">رابط</th>
              <th className="p-3 font-medium">شماره تماس</th>
              <th className="p-3 font-medium">استان/شهر</th>
              <th className="p-3 font-medium text-right">آدرس کامل</th>
              <th className="p-3 font-medium text-right">یادداشت</th>
              {user.role !== 'viewer' && <th className="p-3 font-medium text-center">عملیات</th>}
            </tr>
          </thead>
          <tbody className="divide-y text-xs">
            {customers.map((c, idx) => (
              <tr key={c.id} className="hover:bg-blue-50/20 text-center">
                <td className="p-3 text-slate-400">{((page - 1) * 50) + idx + 1}</td>
                <td className="p-3 font-bold text-slate-800 text-right">{c.name}</td>
                <td className="p-3 text-slate-600 text-right">{c.contactName || '-'}</td>
                <td className="p-3 text-slate-700 font-mono" dir="ltr">
                  {c.phone ? (
                    <div className="flex flex-col gap-1">
                      {c.phone.split(',').map((p, i) => <span key={i}>{p.trim()}</span>)}
                    </div>
                  ) : '-'}
                </td>
                <td className="p-3 text-slate-600">
                  {c.country === 'ایران' ? [c.province, c.city].filter(Boolean).join(' - ') || '-' : c.country || '-'}
                </td>
                <td className="p-3 text-slate-600 text-right">{c.address || '-'}</td>
                <td className="p-3 text-slate-500 text-right">{c.notes || '-'}</td>
                {user.role !== 'viewer' && (
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleEdit(c)} className="text-blue-500 hover:text-blue-700" title="ویرایش">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="text-rose-500 hover:text-rose-700" title="حذف">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!loading && customers.length === 0 && (
              <tr>
                <td colSpan={user.role !== 'viewer' ? 7 : 6} className="p-8 text-center text-slate-500">هیچ موردی یافت نشد.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-slate-50 border-t flex items-center justify-between mt-auto">
        <span className="text-xs text-slate-500">
          نمایش {customers.length} مورد {totalItems > 0 ? `از کل ${totalItems} مورد` : ''}
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

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm shadow flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg">{editingId ? 'ویرایش اطلاعات شخص' : 'ثبت حساب شخص جدید'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">نام شرکت / مجموعه</label>
                    <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">نام شخص رابط</label>
                    <input type="text" value={form.contactName} onChange={e => setForm({...form, contactName: e.target.value})} className="w-full border rounded-lg px-3 py-2" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">شماره‌های تماس</label>
                  <div className="space-y-2">
                    {phoneList.map((phone, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input 
                          type="text" 
                          value={phone} 
                          onChange={e => handlePhoneChange(idx, e.target.value)} 
                          className="w-full border rounded-lg px-3 py-2 font-mono" 
                          dir="ltr"
                          placeholder="09123456789"
                        />
                        <button type="button" onClick={() => removePhoneField(idx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                          <X size={20} />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={addPhoneField} className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                      <Plus size={14} /> افزودن شماره دیگر
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">کشور</label>
                    <select value={form.country} onChange={e => setForm({...form, country: e.target.value, province: '', city: ''})} className="w-full border rounded-lg px-3 py-2">
                      <option value="ایران">ایران</option>
                      <option value="سایر">سایر</option>
                    </select>
                  </div>
                  {form.country === 'ایران' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">استان</label>
                      <select value={form.province} onChange={e => setForm({...form, province: e.target.value})} className="w-full border rounded-lg px-3 py-2">
                        <option value="">انتخاب استان...</option>
                        {IRAN_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {form.country === 'ایران' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">شهر</label>
                    <input type="text" value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="w-full border rounded-lg px-3 py-2" />
                  </div>
                )}
                
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
