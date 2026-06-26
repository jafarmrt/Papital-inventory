import React, { useEffect, useState } from 'react';
import { fetchJson } from '../api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, Package, AlertTriangle } from 'lucide-react';

export default function AnalyticsPage() {
  const [trends, setTrends] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [trendsData, topItemsData, lowStockData] = await Promise.all([
          fetchJson('/analytics/trends'),
          fetchJson('/analytics/top-items'),
          fetchJson('/analytics/low-stock')
        ]);
        setTrends(trendsData);
        setTopItems(topItemsData);
        setLowStock(lowStockData);
      } catch (error) {
        console.error('Failed to load analytics', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return <div className="p-6">در حال بارگذاری اطلاعات...</div>;

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold mb-6">داشبورد هوش تجاری (BI)</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trends Chart */}
        <div className="bg-white p-4 rounded-xl shadow-sm border h-96">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            روند ورود و خروج ۳۰ روز گذشته
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total_in" name="ورودی" stroke="#16a34a" />
              <Line type="monotone" dataKey="total_out" name="خروجی" stroke="#dc2626" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Items Chart */}
        <div className="bg-white p-4 rounded-xl shadow-sm border h-96">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            ۵ کالای پرمصرف/پرفروش
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topItems} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total_moved" name="تعداد جابجا شده" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Low Stock Alerts */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-orange-200 mt-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-orange-600">
          <AlertTriangle className="w-5 h-5" />
          هشدارهای نقطه سفارش
        </h3>
        {lowStock.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-orange-50 text-orange-700">
                <tr>
                  <th className="p-3">کد کالا</th>
                  <th className="p-3">نام کالا</th>
                  <th className="p-3">موجودی فعلی</th>
                  <th className="p-3">نقطه سفارش</th>
                  <th className="p-3 text-left">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStock.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-500 font-mono">{item.code}</td>
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3 font-bold text-red-600">{item.current_stock} {item.unit}</td>
                    <td className="p-3 text-slate-500">{item.reorder_point} {item.unit}</td>
                    <td className="p-3 text-left">
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-medium">
                        نیاز به سفارش
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 text-sm py-4">همه کالاها در وضعیت مطلوب قرار دارند.</p>
        )}
      </div>
    </div>
  );
}
