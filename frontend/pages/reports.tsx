import Head from 'next/head';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, BarChart, Bar } from 'recharts';
import { Calendar, TrendingUp, AlertCircle, Package } from 'lucide-react';
import { DownloadButton } from '../components/DownloadButton';
import { useEffect, useState } from 'react';

export default function Reports() {
  const [trendData, setTrendData] = useState<any[]>([]);
  const [issueData, setIssueData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ score: 0, products: 0, issues: 0 });
  const [data, setData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('analysis_result');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setData(parsed);
        
        // Dynamic Score
        const actualScore = parsed.score?.overall || 0;
        const totalIssues = parsed.issues?.length || parsed.action_plan?.length || 0;
        const totalProducts = parsed.meta?.products_analyzed || parsed.store?.total_products || 0;
        
        setMetrics({
          score: actualScore,
          products: totalProducts,
          issues: totalIssues
        });

        // Dynamic Trend generation based on history
        const rawHistory = localStorage.getItem('analysis_history');
        if (rawHistory) {
           const parsedHistory = JSON.parse(rawHistory);
           const formattedHistory = parsedHistory.map((item: any) => ({
             name: new Date(item.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
             score: item.score
           }));
           setTrendData(formattedHistory);
        } else {
           // Fallback to just the current point if no history yet
           setTrendData([{ name: new Date().toLocaleString([], { month: 'short', day: 'numeric' }), score: actualScore }]);
        }

        // Dynamic Issue Categories
        const issuesList = parsed.issues || parsed.action_plan || [];
        if (issuesList && issuesList.length > 0) {
          const categories: Record<string, number> = {};
          issuesList.forEach((a: any) => {
             // Depending on if it's an issue or an action plan item
             const title = a.title || a.id || 'Issue';
             categories[title] = (categories[title] || 0) + (a.affected_count || 1);
          });
          const newIssueData = Object.keys(categories).map(k => ({ name: k, count: categories[k] }));
          if (newIssueData.length > 0) {
            setIssueData(newIssueData);
          }
        }
      } catch (e) {}
    }
    setMounted(true);
  }, []);

  return (
    <>
      <Head>
        <title>Reports | AI Store Optimizer</title>
      </Head>

      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Performance Reports</h1>
          <p className="text-gray-500 text-sm">Track your store's AI perception over time and identify trend patterns.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 transition-colors shadow-sm">
            <Calendar className="w-4 h-4 text-gray-500" />
            Last Updated: {mounted ? new Date().toLocaleString() : '--'}
          </button>
          <DownloadButton />
        </div>
      </div>

      {!data ? (
         <div className="p-8 text-center text-gray-500 bg-white rounded-xl shadow-sm">
           No analysis data found. Run an analysis from the dashboard first.
         </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Current Score</p>
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-black text-gray-900">{Math.round(metrics.score)}</span>
              </div>
            </div>
            
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Analyzed Products</p>
                <Package className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-black text-gray-900">{metrics.products.toLocaleString()}</span>
                <span className="text-sm text-gray-500 font-medium mb-1">Total catalog</span>
              </div>
            </div>
            
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Resolved Issues</p>
                <AlertCircle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-black text-emerald-600">{metrics.issues}</span>
                <span className="text-sm text-gray-500 font-medium mb-1">Total detected</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Score Progression</h2>
                <div className="flex items-center gap-4 text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-indigo-600"></span> Overall Score
                  </div>
                </div>
              </div>
              
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} axisLine={false} tickLine={false} dy={10} />
                    <YAxis stroke="#94a3b8" tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#111827', fontWeight: 600 }}
                      labelStyle={{ color: '#64748b', fontWeight: 500, marginBottom: '4px' }}
                    />
                    <Area type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" name="Overall Score" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Issues by Category</h2>
              </div>
              
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={issueData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} axisLine={false} tickLine={false} dy={10} />
                    <YAxis stroke="#94a3b8" tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      cursor={{ fill: '#f8fafc' }}
                    />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Issues Found" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
