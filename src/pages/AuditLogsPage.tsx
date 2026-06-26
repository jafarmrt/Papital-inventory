import React, { useEffect, useState } from 'react';
import { fetchJson } from '../api';
import { Clock, User } from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await fetchJson('/audit-logs');
        setLogs(data);
      } catch (error) {
        console.error('Failed to load audit logs', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'LOGIN': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">ورود</span>;
      case 'CREATE': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium">ایجاد</span>;
      case 'UPDATE': return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs font-medium">ویرایش</span>;
      case 'DELETE': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-medium">حذف</span>;
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium">{action}</span>;
    }
  };

  if (loading) return <div className="p-6">در حال بارگذاری اطلاعات...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-6 h-6 text-slate-700" />
            تاریخچه فعالیت‌ها (Audit Trail)
          </h2>
          <p className="text-slate-500 text-sm mt-1">رهگیری دقیق تمامی تغییرات و فعالیت‌های کاربران در سیستم</p>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-600 border-b">
              <tr>
                <th className="p-4 font-semibold">زمان</th>
                <th className="p-4 font-semibold">کاربر</th>
                <th className="p-4 font-semibold">عملیات</th>
                <th className="p-4 font-semibold">بخش</th>
                <th className="p-4 font-semibold">تغییرات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 whitespace-nowrap text-slate-500" dir="ltr">
                    {new Date(log.timestamp).toLocaleString('fa-IR')}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center">
                        <User className="w-3 h-3 text-slate-500" />
                      </div>
                      <span className="font-medium text-slate-700">{log.username}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    {getActionBadge(log.action)}
                  </td>
                  <td className="p-4 text-slate-600 font-medium">{log.entityType}</td>
                  <td className="p-4">
                    <pre className="text-xs bg-slate-50 p-2 rounded border border-slate-100 text-slate-500 max-w-md overflow-x-auto" dir="ltr">
                      {JSON.stringify(log.changes, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    هیچ فعالیتی ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
