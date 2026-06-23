/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Box, FileOutput, FileInput, History, Users, FileCode2, LogOut, Settings, ClipboardList, Image, DollarSign, UsersRound } from 'lucide-react';
import { cn } from './utils';
import { useState, useEffect } from 'react';
import { useSearch } from './SearchContext';

// Pages
import Dashboard from './pages/Dashboard';
import ItemsPage from './pages/ItemsPage';
import DocumentsPage from './pages/DocumentsPage';
import TransactionsPage from './pages/TransactionsPage';
import LoginPage from './pages/LoginPage';
import UsersPage from './pages/UsersPage';
import ChangelogPage from './pages/ChangelogPage';
import SettingsPage from './pages/SettingsPage';
import InventoryAuditPage from './pages/InventoryAuditPage';
import CreateInvoicePage from './pages/CreateInvoicePage';
import CustomersPage from './pages/CustomersPage';
import PricingPage from './pages/PricingPage';
import GalleryPage from './pages/GalleryPage';
import { User } from './types';

function Sidebar({ user, onLogout }: { user: User, onLogout: () => void }) {
  const location = useLocation();
  const menuItems = [
    { name: 'داشبورد', path: '/', icon: LayoutDashboard },
    { name: 'محصولات', path: '/products', icon: Package },
    { name: 'مواد اولیه', path: '/materials', icon: Box },
    { name: 'گالری اقلام', path: '/gallery', icon: Image },
    { name: 'قیمت‌گذاری', path: '/pricing', icon: DollarSign },
    { name: 'مشتریان', path: '/customers', icon: UsersRound },
    { name: 'رسید انبار (ورود)', path: '/receipts', icon: FileInput },
    { name: 'صدور فاکتور / حواله', path: '/remittances', icon: FileOutput },
    { name: 'انبارگردانی دوره‌ای', path: '/audit', icon: ClipboardList },
  ];

  if (user.role === 'admin') {
    menuItems.push({ name: 'گزارش تراکنش‌ها', path: '/transactions', icon: History });
    menuItems.push({ name: 'تنظیمات', path: '/settings', icon: Settings });
    menuItems.push({ name: 'مدیریت کاربران', path: '/users', icon: Users });
    menuItems.push({ name: 'تغییرات نسخه‌ها', path: '/changelog', icon: FileCode2 });
  }

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 h-screen print:hidden">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3 text-white">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-lg">P</div>
          <h1 className="text-base font-bold tracking-tight">سامانه انبار پاپیتال</h1>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map(item => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-2 rounded-md transition-colors",
                active ? "bg-slate-800 text-white" : "hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon size={18} />
              <span className="text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 bg-slate-950 text-xs flex flex-col gap-3 border-t border-slate-800">
        <button onClick={onLogout} className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors">
          <LogOut size={16} /> خروج از حساب کاربری
        </button>
        <div className="flex flex-col gap-1 border-t border-slate-800 pt-3">
          <div className="flex justify-between"><span>وضعیت سرور:</span> <span className="text-green-500">● آنلاین</span></div>
        </div>
      </div>
    </aside>
  );
}

import CreateInvoicePage from './pages/CreateInvoicePage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const { searchQuery, setSearchQuery } = useSearch();

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      setUser(JSON.parse(saved));
    }
  }, []);

  const handleLogin = (u: User) => {
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <Router>
      <div className="flex bg-slate-50 min-h-screen text-slate-800 font-sans overflow-hidden" dir="rtl">
        <Sidebar user={user} onLogout={handleLogout} />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-16 bg-white border-b flex items-center justify-between px-6 shrink-0 print:hidden">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative w-96 font-sans">
                <span className="absolute right-3 top-2.5 text-slate-400 text-sm">🔍</span>
                <input 
                  type="text" 
                  placeholder="جستجو کالا یا مواد اولیه..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 border rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-left">
                <p className="text-xs text-slate-500 uppercase">{user.role === 'admin' ? 'مدیر سیستم' : user.role === 'manager' ? 'سرپرست انبار' : 'کاربر تماشاگر'}</p>
                <p className="text-sm font-bold">{user.full_name}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 flex flex-col items-center justify-center font-bold text-slate-500">
                {user.full_name.charAt(0)}
              </div>
            </div>
          </header>
          <div className="p-6 print:p-0 overflow-auto flex-1 print:overflow-visible">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<ItemsPage type="product" title="مدیریت محصولات" user={user} />} />
              <Route path="/materials" element={<ItemsPage type="raw_material" title="مدیریت مواد اولیه" user={user} />} />
              <Route path="/gallery" element={<GalleryPage user={user} />} />
              <Route path="/pricing" element={<PricingPage user={user} />} />
              <Route path="/customers" element={<CustomersPage user={user} />} />
              <Route path="/receipts" element={<DocumentsPage actionType="in" title="رسید ورود به انبار" user={user} />} />
              <Route path="/remittances" element={<CreateInvoicePage user={user} />} />
              <Route path="/audit" element={<InventoryAuditPage user={user} />} />
              {user.role === 'admin' && (
                <>
                  <Route path="/transactions" element={<TransactionsPage />} />
                  <Route path="/settings" element={<SettingsPage currentUser={user} />} />
                  <Route path="/users" element={<UsersPage currentUser={user} />} />
                  <Route path="/changelog" element={<ChangelogPage />} />
                </>
              )}
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}
