import Head from 'next/head';
import { useState, useEffect } from 'react';
import { Store, Link2, Key, CheckCircle2, Shield, Activity, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { runAnalysis } from '../services/api';

export default function Settings() {
  const [storeUrl, setStoreUrl] = useState('ai-store-test-2.myshopify.com');
  const [apiKey, setApiKey] = useState('************************');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const url = sessionStorage.getItem('storeUrl');
    if (url) setStoreUrl(url);
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await runAnalysis(storeUrl);
      alert('Background sync completed.');
    } catch {
      alert('Sync failed. Please verify API status.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <Head>
        <title>Settings | AI Store Optimizer</title>
      </Head>

      <div className="mb-8 flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Workspace Settings</h1>
          <p className="text-gray-500 text-sm">Manage your Shopify connection and AI analysis preferences.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Connection Settings */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Store className="w-5 h-5 text-indigo-600" /> Shopify Connection
              </h2>
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold border border-emerald-200 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </span>
            </div>
            
            <div className="space-y-5 max-w-lg">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Store URL</label>
                <div className="flex">
                  <input 
                    type="text" 
                    value={storeUrl}
                    onChange={(e) => setStoreUrl(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-l-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm shadow-inner"
                  />
                  <button className="bg-white hover:bg-slate-50 text-gray-700 px-4 py-2.5 rounded-r-lg font-medium transition-colors border border-l-0 border-slate-200">
                    Verify
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">API Access Token <span className="text-gray-400 font-normal">(Optional)</span></label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input 
                    type="password" 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm shadow-inner"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Required for deep product synchronization. Storefront read-only access is sufficient.</p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">Last synchronized</p>
                <p className="text-xs text-gray-500">Today at 10:42 AM</p>
              </div>
              <button 
                onClick={handleManualSync}
                disabled={isSyncing}
                className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors border border-indigo-200"
              >
                <RefreshCw className={clsx("w-4 h-4", isSyncing && "animate-spin")} />
                {isSyncing ? "Syncing..." : "Manual Sync"}
              </button>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" /> Analysis Preferences
            </h2>
            
            <div className="space-y-6">
              <label className="flex items-start gap-4 cursor-pointer group">
                <div className="relative flex items-center mt-0.5">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">Automated Weekly Analysis</p>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">Run the AI analysis pipeline automatically every Monday morning to track improvements.</p>
                </div>
              </label>

              <label className="flex items-start gap-4 cursor-pointer group pt-2">
                <div className="relative flex items-center mt-0.5">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">Deep Product Scanning</p>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">Analyze every single product instead of a representative sample. (May take up to 5 minutes).</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Sidebar Logs */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 h-full shadow-sm">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" /> System Logs
            </h2>
            
            <div className="space-y-5">
              {[
                { time: '10:42 AM', msg: 'Analysis pipeline completed successfully', status: 'success' },
                { time: '10:41 AM', msg: 'Simulating AI perception gaps', status: 'info' },
                { time: '10:41 AM', msg: 'Evaluating trust signals', status: 'info' },
                { time: '10:40 AM', msg: 'Ingesting product metadata', status: 'info' },
                { time: '10:40 AM', msg: 'Analysis requested via web UI', status: 'info' },
              ].map((log, i) => (
                <div key={i} className="flex gap-4">
                  <div className="mt-1 flex flex-col items-center">
                    <div className={clsx(
                      "w-2.5 h-2.5 rounded-full ring-4",
                      log.status === 'success' ? "bg-emerald-500 ring-emerald-50" : "bg-indigo-500 ring-indigo-50"
                    )}></div>
                    {i !== 4 && <div className="w-px h-full bg-slate-200 mt-2 mb-1"></div>}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-wider uppercase text-gray-400 mb-0.5">{log.time}</p>
                    <p className={clsx("text-sm", log.status === 'success' ? "text-emerald-700 font-bold" : "text-gray-700 font-medium")}>{log.msg}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="mt-8 w-full py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors">
              Download Full Logs
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
