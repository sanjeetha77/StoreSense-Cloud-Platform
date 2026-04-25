import { Bell, Plus, RefreshCw, Clock, LogOut, Settings as SettingsIcon, User, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import clsx from 'clsx';
import { runAnalysis } from '../services/api';

export function TopNavbar() {
  const router = useRouter();
  const [storeUrl, setStoreUrl] = useState('ai-store-test-2.myshopify.com');
  const [status, setStatus] = useState<'Success' | 'Running' | 'Error' | null>('Success');
  const [lastAnalyzedTime, setLastAnalyzedTime] = useState<number>(Date.now());
  const [relativeTime, setRelativeTime] = useState<string>('Just now');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Dropdown state
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

      <div className="flex items-center gap-4">
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
        <div className="w-px h-6 bg-slate-200"></div>
        <button className="text-gray-400 hover:text-gray-900 transition-colors p-1.5 rounded-full hover:bg-slate-100 relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
        </button>
        
        {/* Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border-2 border-white shadow-sm ring-1 ring-slate-200 hover:ring-indigo-300 transition-all flex items-center justify-center cursor-pointer"
          >
             <span className="text-xs text-white font-bold tracking-wider">JD</span>
          </button>
          
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              <div className="px-4 py-2 border-b border-slate-100 mb-1">
                <p className="text-sm font-bold text-gray-900">John Doe</p>
                <p className="text-xs text-gray-500 font-mono truncate">{storeUrl}</p>
              </div>
              <button onClick={() => router.push('/settings')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-slate-50 flex items-center gap-2 transition-colors">
                <SettingsIcon className="w-4 h-4 text-gray-400" /> Settings
              </button>
              <button onClick={() => window.open(`https://${storeUrl}/admin`, "_blank")} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-slate-50 flex items-center gap-2 transition-colors">
                <ExternalLink className="w-4 h-4 text-gray-400" /> Shopify Admin
              </button>
              <div className="border-t border-slate-100 my-1"></div>
              <button className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors">
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
