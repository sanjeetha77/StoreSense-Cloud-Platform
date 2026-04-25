import { X, Activity, Terminal } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

export function LogsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      setLogs([
        { time: new Date(Date.now() - 50000).toLocaleTimeString(), msg: 'Analysis pipeline completed successfully', status: 'success' },
        { time: new Date(Date.now() - 55000).toLocaleTimeString(), msg: 'Simulating AI perception gaps', status: 'info' },
        { time: new Date(Date.now() - 60000).toLocaleTimeString(), msg: 'Evaluating trust signals', status: 'info' },
        { time: new Date(Date.now() - 65000).toLocaleTimeString(), msg: 'Ingesting product metadata', status: 'info' },
        { time: new Date(Date.now() - 70000).toLocaleTimeString(), msg: 'Analysis requested via web UI', status: 'info' },
      ]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-500" /> System Logs
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 font-mono text-sm bg-slate-900 text-slate-300">
          <div className="space-y-3">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-4">
                <span className="text-slate-500 flex-shrink-0 w-24">[{log.time}]</span>
                <span className={clsx(
                  log.status === 'success' ? 'text-emerald-400' : 'text-slate-300'
                )}>
                  {log.msg}
                </span>
              </div>
            ))}
            <div className="flex gap-4 animate-pulse">
              <span className="text-slate-500 flex-shrink-0 w-24">[{new Date().toLocaleTimeString()}]</span>
              <span className="text-indigo-400">System idle. Waiting for next run...</span>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="bg-white border border-slate-200 hover:bg-slate-100 text-gray-700 px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
