import { useEffect, useState } from 'react';
import { fetchJson } from '../api';
import { Changelog } from '../types';
import { FileCode2 } from 'lucide-react';

export default function ChangelogPage() {
  const [logs, setLogs] = useState<Changelog[]>([]);

  useEffect(() => {
    fetchJson('/changelogs').then(setLogs).catch(console.error);
  }, []);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
          <FileCode2 size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">گزارش تغییرات نسخه‌ها (Changelog)</h1>
          <p className="text-slate-500 text-sm mt-1">تغییرات و امکانات جدید اضافه‌شده به سامانه</p>
        </div>
      </div>

      <div className="space-y-8 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
        {logs.map((log) => (
          <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-200 group-[.is-active]:bg-blue-600 text-white group-[.is-active]:text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 font-bold text-sm">
              v{log.version}
            </div>
            
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between space-x-2 space-x-reverse mb-3">
                <div className="font-bold text-slate-900 border-b pb-1">نسخه {log.version}</div>
                <time className="font-mono text-xs text-slate-500" dir="ltr">{new Date(log.date).toLocaleDateString('fa-IR')}</time>
              </div>
              
              <div className="space-y-3 text-sm">
                {log.features && (
                  <div>
                    <strong className="text-emerald-600 text-xs uppercase tracking-wider block mb-1">امکانات جدید:</strong>
                    <ul className="list-disc list-inside space-y-1 text-slate-700">
                      {log.features.split('\n').filter(Boolean).map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {log.fixes && (
                  <div>
                    <strong className="text-amber-600 text-xs uppercase tracking-wider block mb-1">اصلاحات و باگ‌فیکس:</strong>
                    <ul className="list-disc list-inside space-y-1 text-slate-700">
                      {log.fixes.split('\n').filter(Boolean).map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
