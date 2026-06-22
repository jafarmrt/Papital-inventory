import React, { useEffect, useState } from 'react';
import { fetchJson } from '../api';
import { User } from '../types';
import { Users, Plus, Trash2, Edit2 } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

export default function UsersPage({ currentUser }: { currentUser: User }) {
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ id: 0, username: '', password: '', full_name: '', role: 'viewer' });
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; userId: number }>({ isOpen: false, userId: 0 });

  const loadUsers = () => {
    fetchJson('/users').then(setUsers).catch(console.error);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (form.id) {
        await fetchJson(`/users/${form.id}`, {
          method: 'PUT',
          body: JSON.stringify(form)
        });
      } else {
        await fetchJson('/users', {
          method: 'POST',
          body: JSON.stringify(form)
        });
      }
      setShowModal(false);
      setForm({ id: 0, username: '', password: '', full_name: '', role: 'viewer' });
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت کاربر');
    }
  };

  const handleDelete = async (id: number) => {
    setConfirmState({ isOpen: true, userId: id });
  };

  const executeDelete = async () => {
    const id = confirmState.userId;
    try {
      await fetchJson(`/users/${id}`, { method: 'DELETE' });
      loadUsers();
      setConfirmState({ isOpen: false, userId: 0 });
    } catch (err: any) {
      alert('خطا در حذف');
    }
  };

  if (currentUser.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <Users size={48} className="mb-4 opacity-50" />
        <h2 className="text-xl font-bold mb-2">دسترسی مسدود</h2>
        <p>شما اجازه دسترسی به این بخش را ندارید.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl shadow-sm flex flex-col min-h-[460px]">
        <div className="p-4 border-b flex justify-between items-center bg-white">
          <h3 className="font-bold flex items-center gap-2">👥 مدیریت کاربران</h3>
          <button 
            onClick={() => { setForm({ id: 0, username: '', password: '', full_name: '', role: 'viewer' }); setShowModal(true); }}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
          >
            <Plus size={14} /> ثبت کاربر جدید
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-500 border-b sticky top-0">
              <tr>
                <th className="p-3 font-medium">نام کامل</th>
                <th className="p-3 font-medium">نام کاربری</th>
                <th className="p-3 font-medium">سطح دسترسی</th>
                <th className="p-3 font-medium text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="p-3 font-bold text-slate-800">{u.full_name}</td>
                  <td className="p-3 font-mono text-slate-600 text-left" dir="ltr">{u.username}</td>
                  <td className="p-3">
                    {u.role === 'admin' ? <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">مدیر سیستم</span> : 
                     u.role === 'manager' ? <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">سرپرست انبار</span> : 
                     <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs">کاربر تماشاگر</span>}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => { setForm({ id: u.id, full_name: u.full_name, username: u.username, password: '', role: u.role }); setShowModal(true); }} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded transition-colors inline-block">
                        <Edit2 size={16} />
                      </button>
                      {u.id !== currentUser.id && (
                        <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded transition-colors inline-block">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">{form.id ? 'ویرایش کاربر' : 'ثبت کاربر جدید'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">نام کامل</label>
                <input required type="text" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">نام کاربری</label>
                  <input required={!form.id} disabled={!!form.id} type="text" value={form.username} onChange={e => setForm({...form, username: e.target.value})} className="w-full border rounded px-3 py-2 text-sm text-left font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500" dir="ltr" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">رمز عبور {form.id && <span className="text-xs text-slate-400 font-normal">(در صورت تغییر وارد کنید)</span>}</label>
                  <input required={!form.id} type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full border rounded px-3 py-2 text-sm text-left font-mono focus:outline-none focus:ring-1 focus:ring-blue-500" dir="ltr" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">نقش / سطح دسترسی</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="viewer">کاربر تماشاگر (فقط خواندن)</option>
                  <option value="manager">سرپرست انبار (ثبت و تغییرات)</option>
                  <option value="admin">مدیر سیستم (دسترسی کامل)</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded text-sm hover:bg-slate-50 transition-colors">انصراف</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors">ثبت اطلاعات</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        message="آیا از حذف این کاربر اطمینان دارید؟ این عملیات غیر قابل بازگشت است."
        onConfirm={executeDelete}
        onCancel={() => setConfirmState({ isOpen: false, userId: 0 })}
      />
    </div>
  );
}
