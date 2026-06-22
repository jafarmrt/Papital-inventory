import { useEffect, useState } from 'react';
import { fetchJson } from '../api';
import { StatInfo } from '../types';
import { 
  Package, Box, AlertTriangle, TrendingUp, DollarSign, 
  Warehouse, Flame, AlertCircle, RefreshCw, BarChart2, Calendar
} from 'lucide-react';

interface BIFastMoving {
  id: number;
  name: string;
  code: string;
  unit: string;
  total_qty: number;
  current_stock: number;
}

interface BIDeadStock {
  id: number;
  name: string;
  code: string;
  unit: string;
  current_stock: number;
  weighted_average_cost: number;
}

interface BIAlarm {
  id: number;
  name: string;
  code: string;
  current_stock: number;
  reorder_point: number;
  unit: string;
  type: string;
}

interface BITrend {
  month: string;
  type: 'in' | 'out';
  total: number;
}

interface BIDashboardStats {
  reorderAlarms: BIAlarm[];
  fastMoving: BIFastMoving[];
  slowMoving: BIDeadStock[];
  deadStock: BIDeadStock[];
  totalValuation: number;
  locations: Record<string, number>;
  warehouses: { id: number; name: string; code: string; is_active: number }[];
  monthlyTrends: BITrend[];
  fastDays?: number;
  slowDays?: number;
  deadDays?: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<StatInfo | null>(null);
  const [biStats, setBiStats] = useState<BIDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetchJson('/stats'),
      fetchJson('/dashboard-bi-stats')
    ])
      .then(([general, bi]) => {
        setStats(general);
        setBiStats(bi);
        setError(null);
      })
      .catch((err) => {
        console.error('Error fetching dashboard stats:', err);
        setError('خطا در دریافت اطلاعات داشبورد تحلیلی');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString() + ' ریال';
  };

  // Process monthly trends into formatted charts
  const processTrendChart = () => {
    if (!biStats || !biStats.monthlyTrends.length) return { labels: [], ins: [], outs: [], maxVal: 10 };
    
    const monthMap: { [key: string]: { in: number; out: number } } = {};
    biStats.monthlyTrends.forEach(t => {
      if (!monthMap[t.month]) {
        monthMap[t.month] = { in: 0, out: 0 };
      }
      if (t.type === 'in') {
        monthMap[t.month].in += t.total;
      } else {
        monthMap[t.month].out += t.total;
      }
    });

    const sortedMonths = Object.keys(monthMap).sort();
    const ins = sortedMonths.map(m => monthMap[m].in);
    const outs = sortedMonths.map(m => monthMap[m].out);
    const maxVal = Math.max(...ins, ...outs, 10) * 1.15; // padding for chart height

    // Format months to Persian month name if possible or keep as yyyy-mm
    const fLabels = sortedMonths.map(m => {
      const parts = m.split('-');
      if (parts.length === 2) {
        const mm = parseInt(parts[1], 10);
        const monthsFa = ['', 'ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];
        return `${parts[0]}/${parts[1]}`;
      }
      return m;
    });

    return { labels: fLabels, ins, outs, maxVal };
  };

  const chartData = processTrendChart();
  let locationTotal: number = 0;
  if (biStats && biStats.locations) {
    locationTotal = Object.values(biStats.locations).reduce<number>((sum, val) => sum + Number(val || 0), 0);
  }

  const getLocationPercentage = (val: number) => {
    if (!locationTotal) return 0;
    return Math.round((val / locationTotal) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 border rounded-xl shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800">پیشخوان مدیریت و تحلیل عملکرد انبار</h1>
          <p className="text-slate-500 text-xs mt-1">نمایی خلاصه از موجودی، جابجایی بار، ارزش مالی و هشدارهای انبار پاپیتال</p>
        </div>
        <button 
          onClick={loadData}
          className="p-2 border rounded-lg text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors flex items-center gap-1.5 text-xs font-semibold"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          بروزرسانی گزارشات
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="bg-white p-6 border rounded-xl h-28 space-y-3">
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              <div className="h-6 bg-slate-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Main Financial & Analytical KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* KPI 1: Value */}
            <div className="bg-white p-5 border rounded-xl shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">ارزش کل موجودی انبار</p>
                <h3 className="text-xl font-extrabold text-blue-600 mt-2 font-mono">
                  {biStats ? formatCurrency(biStats.totalValuation) : '-'}
                </h3>
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between items-center text-xs text-slate-400">
                <span className="flex items-center gap-1"><DollarSign size={13} /> میانگین متحرک (WAC)</span>
                <span className="text-blue-500 font-bold bg-blue-50 px-1.5 py-0.5 rounded">ریال</span>
              </div>
            </div>

            {/* KPI 2: Reorder alerts */}
            <div className={`bg-white p-5 border rounded-xl shadow-sm flex flex-col justify-between ${biStats && biStats.reorderAlarms.length > 0 ? "border-r-4 border-r-rose-500 bg-rose-50/10" : ""}`}>
              <div>
                <p className="text-xs text-slate-500 font-medium">مواد اولیه با آلارم نقطه سفارش</p>
                <div className="flex items-end justify-between mt-2">
                  <span className={`text-2xl font-extrabold ${biStats && biStats.reorderAlarms.length > 0 ? "text-rose-600" : "text-slate-800"}`}>
                    {biStats ? biStats.reorderAlarms.length : '0'} Line
                  </span>
                  {biStats && biStats.reorderAlarms.length > 0 && (
                    <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                      <AlertTriangle size={10} /> اقدام فوری
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between items-center text-xs text-slate-400">
                <span>حد آستانه سفارش بحرانی</span>
                <span>کمتر از حد مجاز</span>
              </div>
            </div>

            {/* KPI 3: Products & Materials */}
            <div className="bg-white p-5 border rounded-xl shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">تنوع اقلام انبار</p>
                <h3 className="text-xl font-extrabold text-slate-800 mt-2">
                  {stats ? `${stats.totalProducts} کالا / ${stats.totalMaterials} متریال` : '-'}
                </h3>
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between items-center text-xs text-slate-400">
                <span className="flex items-center gap-1"><Package size={13} /> ثبت شده در سیستم</span>
                <span>بایگانی زنده</span>
              </div>
            </div>

            {/* KPI 4: 7 Days Output Flow */}
            <div className="bg-white p-5 border rounded-xl shadow-sm bg-slate-900 text-slate-100 flex flex-col justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium opacity-80">گردش کل اسناد (۷ روز اخیر)</p>
                <div className="flex items-end justify-between mt-2">
                  <span className="text-2xl font-extrabold text-white font-mono">
                    {stats ? stats.recentTx : '0'} Sand
                  </span>
                  <span className="text-xs text-blue-400 bg-blue-900/50 px-2 py-0.5 rounded flex items-center gap-1">
                    <TrendingUp size={12} /> پایش سیستم
                  </span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
                <span>تراکنش‌های ثبت شده اخیر</span>
                <span className="text-emerald-400 font-mono">برخط</span>
              </div>
            </div>
          </div>

          {/* Section: Charts and Multi-Location stocks */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart Column (2 cols) */}
            <div className="lg:col-span-2 bg-white p-6 border rounded-xl shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <BarChart2 className="text-blue-500" size={18} />
                  نمودار گردش کالا (ماه‌های اخیر)
                </h3>
                <div className="flex gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1 text-emerald-600">
                    <span className="w-3 h-3 bg-emerald-500 rounded-full inline-block"></span> ورود به انبار
                  </span>
                  <span className="flex items-center gap-1 text-amber-500">
                    <span className="w-3 h-3 bg-amber-500 rounded-full inline-block"></span> خروج از انبار
                  </span>
                </div>
              </div>

              {/* Custom SVG-Based Visual Chart for 100% Stability & Speed */}
              <div className="flex-1 min-h-[220px] flex items-end justify-between px-4 pb-2 pt-6 border-b border-r relative mt-4">
                {chartData.labels.length > 0 ? (
                  chartData.labels.map((lbl, idx) => {
                    const inVal = chartData.ins[idx] || 0;
                    const outVal = chartData.outs[idx] || 0;
                    
                    const inHeight = chartData.maxVal > 0 ? (inVal / chartData.maxVal) * 100 : 0;
                    const outHeight = chartData.maxVal > 0 ? (outVal / chartData.maxVal) * 100 : 0;

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center group relative px-2">
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 flex flex-col gap-1 text-center w-28 font-mono">
                          <span className="font-sans border-b border-slate-700 pb-0.5">{lbl}</span>
                          <span className="text-emerald-400">ورودی: {inVal}</span>
                          <span className="text-amber-400">خروجی: {outVal}</span>
                        </div>

                        {/* Bars Container */}
                        <div className="w-full flex justify-center items-end h-36 gap-1">
                          {/* In Bar */}
                          <div 
                            style={{ height: `${Math.max(3, inHeight)}%` }} 
                            className="w-4 bg-emerald-500 hover:bg-emerald-600 rounded-t transition-all duration-500"
                          ></div>
                          {/* Out Bar */}
                          <div 
                            style={{ height: `${Math.max(3, outHeight)}%` }} 
                            className="w-4 bg-amber-400 hover:bg-amber-500 rounded-t transition-all duration-500"
                          ></div>
                        </div>

                        {/* Label */}
                        <span className="text-[10px] text-slate-500 mt-2 font-mono" dir="ltr">{lbl}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
                    داده‌ای برای نمایش نمودار فعلاً وجود ندارد.
                  </div>
                )}
              </div>
            </div>

            {/* Storage Distribution Column (1 col) */}
            <div className="bg-white p-6 border rounded-xl shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Warehouse className="text-blue-500" size={18} />
                  انبارها و تفکیک موجودی
                </h3>
                <p className="text-slate-400 text-[10px] mb-4 border-b pb-2">تفکیک فیزیکی کالاهای موجود در انبارها</p>

                {biStats ? (
                  <div className="space-y-4">
                    {biStats.warehouses?.map((w, index) => {
                      const qty = biStats.locations[w.code] || 0;
                      const percentage = getLocationPercentage(qty);
                      const emojis = ["🔒", "⚒️", "💎", "📦", "🏪", "🏬", "🏢", "🏭"];
                      const bgColors = ["bg-indigo-600", "bg-orange-500", "bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-cyan-500", "bg-violet-500", "bg-rose-500"];
                      
                      const emoji = w.code === 'safe' ? "🔒" : w.code === 'workshop' ? "⚒️" : w.code === 'showroom' ? "💎" : emojis[index % emojis.length];
                      const bgColor = w.code === 'safe' ? "bg-indigo-600" : w.code === 'workshop' ? "bg-orange-500" : w.code === 'showroom' ? "bg-emerald-500" : bgColors[index % bgColors.length];

                      return (
                        <div key={w.code}>
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-slate-700">{emoji} {w.name} ({w.code.toUpperCase()})</span>
                            <span className="text-slate-500">{qty.toLocaleString()} قلم ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div 
                              style={{ width: `${percentage}%` }}
                              className={`${bgColor} h-full rounded-full transition-all duration-500`}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-slate-400 text-xs text-center py-10">در حال محاسبه تفکیک انبار...</div>
                )}
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-dashed mt-4">
                <span className="text-[10px] text-slate-500 leading-relaxed block">
                  💡 تخصیص و انتقال فیزیکی کالاها بین گاوصندوق، ویترین و کارگاه به صورت پویا با هماهنگی دقیق در رسید انبار و صدور اسناد انجام می‌پذیرد.
                </span>
              </div>
            </div>
          </div>

          {/* Heatmaps, Fast-Moving (Fast), Slow-Moving, and Dead Stock highlights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Fast Moving Items Block */}
            <div className="bg-white p-6 border rounded-xl shadow-sm">
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <Flame className="text-red-500 flex-shrink-0" size={18} />
                  کالاهای تند گردش
                </h3>
                <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded font-bold">کمتر از {biStats?.fastDays ?? 30} روز اخیر</span>
              </div>

              {biStats && biStats.fastMoving.length > 0 ? (
                <div className="divide-y text-right">
                  {biStats.fastMoving.map((item, idx) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors rounded px-1.5">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="w-5 h-5 bg-red-100 text-red-600 flex items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                          <span className="text-[9px] text-slate-400 font-mono block">کد: {item.code}</span>
                        </div>
                      </div>
                      <div className="text-left font-mono flex-shrink-0">
                        <p className="text-xs font-bold text-slate-700">{item.total_qty} {item.unit}</p>
                        <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded-full justify-center">تندمصرف</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-400 text-xs text-center py-6 font-medium">کالای پرگردشی یافت نشد.</div>
              )}
            </div>

            {/* Slow Moving Items Block */}
            <div className="bg-white p-6 border rounded-xl shadow-sm">
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <RefreshCw className="text-amber-500 flex-shrink-0" size={18} />
                  کالاهای کند گردش
                </h3>
                <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-bold">بین {biStats?.slowDays ?? 90} تا {biStats?.deadDays ?? 180} روز</span>
              </div>

              {biStats && biStats.slowMoving && biStats.slowMoving.length > 0 ? (
                <div className="divide-y text-right">
                  {biStats.slowMoving.map((item, idx) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors rounded px-1.5">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="w-5 h-5 bg-amber-100 text-amber-600 flex items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                          <span className="text-[9px] text-slate-400 font-mono block">کد: {item.code}</span>
                        </div>
                      </div>
                      <div className="text-left font-mono flex-shrink-0">
                        <p className="text-xs font-bold text-slate-700">{item.current_stock} {item.unit}</p>
                        <span className="text-[9px] text-amber-600 bg-amber-50 px-1 py-0.2 rounded-full justify-center">کم‌گردش</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-400 text-xs text-center py-6 font-medium">کالای کند گردش با موجودی مثبت یافت نشد.</div>
              )}
            </div>

            {/* Dead Stock Block */}
            <div className="bg-white p-6 border rounded-xl shadow-sm">
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <AlertCircle className="text-rose-500 flex-shrink-0" size={18} />
                  کالاهای راکد
                </h3>
                <span className="text-[10px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded font-bold">بیشتر از {biStats?.deadDays ?? 180} روز</span>
              </div>

              {biStats && biStats.deadStock.length > 0 ? (
                <div className="divide-y text-right">
                  {biStats.deadStock.map((item, idx) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors rounded px-1.5">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="w-5 h-5 bg-rose-100 text-rose-600 flex items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-700 truncate">{item.name}</p>
                          <span className="text-[9px] text-slate-400 font-mono block">کد: {item.code}</span>
                        </div>
                      </div>
                      <div className="text-left font-mono flex-shrink-0">
                        <p className="text-xs font-bold text-rose-600">راکد: {item.current_stock} {item.unit}</p>
                        <span className="text-[9px] text-rose-600 bg-rose-50 px-1 py-0.2 rounded-full justify-center">فاقد خروج</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-400 text-xs text-center py-6 font-medium">کالای راکد با موجودی مثبت یافت نشد.</div>
              )}
            </div>
          </div>

          {/* Section: Reorder point active warning banner */}
          {biStats && biStats.reorderAlarms.length > 0 && (
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 bg-rose-500 text-white flex items-center justify-between">
                <span className="font-bold text-sm flex items-center gap-2">
                  <AlertTriangle size={18} className="animate-bounce" />
                  بروزرسانی انبار: {biStats.reorderAlarms.length} کالا به زیر نقطه خطر سفارش رسیده‌اند
                </span>
                <span className="text-xs bg-rose-700 px-2 py-1 rounded font-mono">⚠️ آلارم کسری موجودی کالا</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 text-slate-500 border-b">
                    <tr>
                      <th className="p-3 font-medium">کد کالا</th>
                      <th className="p-3 font-medium">نام کالا</th>
                      <th className="p-3 font-medium text-center">نوع</th>
                      <th className="p-3 font-medium text-center">موجودی فعلی</th>
                      <th className="p-3 font-medium text-center">آستانه مجاز (Reorder Point)</th>
                      <th className="p-3 font-medium text-center">واحد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {biStats.reorderAlarms.map(item => (
                      <tr key={item.id} className="hover:bg-rose-50/20">
                        <td className="p-3 font-mono">{item.code}</td>
                        <td className="p-3 font-bold text-slate-800">{item.name}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${item.type === 'product' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                            {item.type === 'product' ? 'محصول' : 'ماده اولیه'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold text-red-600">{item.current_stock.toLocaleString()}</td>
                        <td className="p-3 text-center font-bold text-slate-500">{item.reorder_point.toLocaleString()}</td>
                        <td className="p-3 text-center text-slate-400">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
