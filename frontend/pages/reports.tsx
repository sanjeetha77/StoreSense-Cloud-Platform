import Head from 'next/head';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, BarChart, Bar } from 'recharts';
import { Calendar, TrendingUp, AlertCircle, Package } from 'lucide-react';
import { DownloadButton } from '../components/DownloadButton';

const trendData = [
  { name: 'Week 1', score: 65, perception: 50 },
  { name: 'Week 2', score: 68, perception: 55 },
  { name: 'Week 3', score: 74, perception: 65 },
  { name: 'Week 4', score: 82, perception: 80 },
  { name: 'Week 5', score: 88, perception: 90 },
];

const issueData = [
  { name: 'Missing Images', count: 42 },
  { name: 'Vague Descriptions', count: 28 },
  { name: 'No Reviews', count: 15 },
  { name: 'Formatting', count: 8 },
  { name: 'Pricing Errors', count: 2 },
];

export default function Reports() {
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
            Last 30 Days
          </button>
          <DownloadButton />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Current Score</p>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-black text-gray-900">88</span>
            <span className="text-sm text-emerald-600 font-bold flex items-center mb-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">+6.0%</span>
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Analyzed Products</p>
            <Package className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-black text-gray-900">1,204</span>
            <span className="text-sm text-gray-500 font-medium mb-1">Total catalog</span>
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Resolved Issues</p>
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-black text-emerald-600">42</span>
            <span className="text-sm text-gray-500 font-medium mb-1">This month</span>
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
  );
}
