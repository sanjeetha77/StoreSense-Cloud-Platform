import { Plus, RefreshCw, Clock, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { runAnalysis } from '../services/api';

export function TopNavbar() {
  const router = useRouter();
  const [storeUrl, setStoreUrl] = useState('');
  const [status, setStatus] = useState<'Success' | 'Running' | 'Error' | null>('Success');
  const [lastAnalyzedTime, setLastAnalyzedTime] = useState<number>(Date.now());
  const [relativeTime, setRelativeTime] = useState<string>('Just now');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Read from localStorage — consistent with index.tsx and dashboard.tsx
    const url = localStorage.getItem('storeUrl');
    if (url) setStoreUrl(url);

    const result = localStorage.getItem('analysis_result');
    if (result) {
      try {
        const parsed = JSON.parse(result);
        if (parsed.status === 'success') setStatus('Success');
        else if (parsed.status === 'failed') setStatus('Error');
        else setStatus('Running');
      } catch (e) {}
    }

    setLastAnalyzedTime(Date.now());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const diffInSeconds = Math.floor((Date.now() - lastAnalyzedTime) / 1000);
      if (diffInSeconds < 60) {
        setRelativeTime('Just now');
      } else if (diffInSeconds < 3600) {
        setRelativeTime(`${Math.floor(diffInSeconds / 60)} mins ago`);
      } else {
        setRelativeTime(`${Math.floor(diffInSeconds / 3600)} hours ago`);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [lastAnalyzedTime]);



  const handleRefresh = async () => {
    setIsRefreshing(true);
    setStatus('Running');
    try {
      const newResult = await runAnalysis(storeUrl);
      sessionStorage.setItem('analysisResult', JSON.stringify(newResult));
      setStatus('Success');
      setLastAnalyzedTime(Date.now());
      setRelativeTime('Just now');
      window.dispatchEvent(new Event('storage')); // Trigger update across tabs if needed
      if (router.pathname === '/dashboard') router.reload();
    } catch {
      setStatus('Error');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm transition-all">
      <div className="flex items-center gap-4">
        <div className="px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 flex items-center gap-2 shadow-inner">
          <span className={clsx(
            "w-2 h-2 rounded-full",
            status === 'Success' ? 'bg-emerald-500' : status === 'Error' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'
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
        
        <div className="hidden md:flex items-center gap-1.5 text-xs font-medium text-gray-500 ml-2">
          <Clock className="w-3.5 h-3.5" /> Last analyzed: {relativeTime}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-gray-500 hover:text-indigo-600 transition-colors p-1.5 rounded-lg hover:bg-indigo-50 flex items-center gap-1.5 text-sm font-medium border border-transparent hover:border-indigo-100 disabled:opacity-50"
        >
          <RefreshCw className={clsx("w-4 h-4", isRefreshing && "animate-spin")} />
          <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
        <Link 
          href="/"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Analysis
        </Link>
        {storeUrl && (
          <button
            onClick={() => window.open(`https://${storeUrl}/admin`, '_blank')}
            className="hidden md:flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors p-1.5 rounded-lg hover:bg-indigo-50"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Admin
          </button>
        )}
      </div>
    </header>
  );
}
