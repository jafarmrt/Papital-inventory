import React, { useState } from 'react';
import { fetchJson } from '../api';
import { User } from '../types';
import { Lock, User as UserIcon } from 'lucide-react';

export default function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchJson('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      if (res.success) {
        onLogin(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'خطا در ورود');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans" dir="rtl">
      <div className="bg-white p-8 rounded-xl shadow-sm border w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-xl mx-auto mb-4">W</div>
          <h1 className="text-2xl font-bold text-slate-800">سامانه انبارداری</h1>
          <p className="text-slate-500 mt-2 text-sm">لطفاً برای ورود اطلاعات خود را وارد کنید.</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">نام کاربری</label>
            <div className="relative">
              <UserIcon className="absolute right-3 top-2.5 text-slate-400" size={18} />
              <input 
                required 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                className="w-full pl-3 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                dir="ltr"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">رمز عبور</label>
            <div className="relative">
              <Lock className="absolute right-3 top-2.5 text-slate-400" size={18} />
              <input 
                required 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full pl-3 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                dir="ltr"
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors mt-4">
            ورود به سیستم
          </button>
        </form>
      </div>
    </div>
  );
}
