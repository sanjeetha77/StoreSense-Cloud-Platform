import { Bell, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

export function TopNavbar() {
  const router = useRouter();
  const [storeUrl, setStoreUrl] = useState('ai-store-test-2.myshopify.com');
  const [status, setStatus] = useState<'Success' | 'Running' | 'Error' | null>('Success');

  useEffect(() => {
    const url = sessionStorage.getItem('storeUrl');
    if (url) setStoreUrl(url);
    
    // Attempt to infer status
    const result = sessionStorage.getItem('analysisResult');
    if (result) {
      try {
        const parsed = JSON.parse(result);
        if (parsed.status === 'success') setStatus('Success');
        else if (parsed.status === 'failed') setStatus('Error');
        else setStatus('Running'); // Fallback or partial
      } catch (e) {}
    }
  }, []);

  return (
    <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 flex items-center gap-2 shadow-inner">
          <span className={clsx(
            "w-2 h-2 rounded-full",
            status === 'Success' ? 'bg-emerald-500' : status === 'Error' ? 'bg-rose-500' : 'bg-amber-500'
          )}></span>
          <span className="text-sm font-medium text-gray-700 font-mono">{storeUrl}</span>
        </div>
        {status && (
          <div className={clsx(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
            status === 'Success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
            status === 'Error' ? 'bg-rose-50 border-rose-200 text-rose-700' :
            'bg-amber-50 border-amber-200 text-amber-700'
          )}>
            Status: {status}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Link 
          href="/"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Analysis
        </Link>
        <div className="w-px h-6 bg-slate-200"></div>
        <button className="text-gray-400 hover:text-gray-900 transition-colors p-1.5 rounded-full hover:bg-slate-100 relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border-2 border-white shadow-sm ring-1 ring-slate-200"></div>
      </div>
    </header>
  );
}
