import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, FormEvent } from 'react';
import { Sparkles, Link as LinkIcon, Bot, AlertTriangle } from 'lucide-react';
import { ProgressLoader } from '../components/ProgressLoader';
import { runAnalysis } from '../services/api';

export default function Home() {
  const router = useRouter();
  const [storeUrl, setStoreUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const cleaned = storeUrl.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!cleaned) {
      setError('Please enter a store URL.');
      return;
    }

    setLoading(true);

    try {
      const data = await runAnalysis(cleaned);
      sessionStorage.setItem('analysisResult', JSON.stringify(data));
      sessionStorage.setItem('storeUrl', cleaned);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Is the backend running?');
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>AI Store Optimizer</title>
      </Head>

      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-100 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="w-full max-w-xl z-10">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-indigo-600 text-xs font-bold uppercase tracking-widest mb-6 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" /> AI Store Representation Optimizer
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-4 leading-tight">
              How does AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">see your store?</span>
            </h1>
            <p className="text-gray-500 text-lg">
              Analyze your Shopify store's completeness, trust signals, and AI perception to get prioritized recommendations.
            </p>
          </div>

          {!loading ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label htmlFor="storeUrl" className="block text-sm font-bold text-gray-700 mb-2">Shopify Store URL</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <LinkIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="storeUrl"
                      value={storeUrl}
                      onChange={(e) => setStoreUrl(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono text-sm shadow-inner"
                      placeholder="example.myshopify.com"
                    />
                  </div>
                </div>
                
                {error && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5" />
                    <p className="text-rose-700 text-sm font-medium">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!storeUrl}
                  className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2 shadow-sm"
                >
                  <Bot className="w-5 h-5" />
                  Start AI Analysis
                </button>
              </form>
            </div>
          ) : (
            <ProgressLoader 
              message="Analyzing Store Data"
              subMessage="Our agents are reviewing your storefront right now."
            />
          )}
        </div>
      </div>
    </>
  );
}
