import { X, Activity, Terminal } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useState, useRef } from 'react';

interface LogEntry {
  id: number;
  level: string;
  message: string;
  timestamp: string;
}

export function LogsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/logs");
      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();
      
      // Sort logs by latest first as requested
      const sortedLogs = data.sort((a: LogEntry, b: LogEntry) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      setLogs(sortedLogs);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetchLogs();
      
      // Polling for real-time updates (Optional Advanced Step 6)
      const interval = setInterval(fetchLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-500" /> System Logs {isLoading && <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse ml-1" />}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div ref={scrollRef} className="p-6 overflow-y-auto flex-1 font-mono text-sm bg-slate-900 text-slate-300 scroll-smooth max-h-[400px]">
          <div className="space-y-3">
            {logs.length === 0 && !isLoading && (
              <div className="text-slate-500 italic">No logs found.</div>
            )}
            
            {logs.map((log) => (
              <div key={log.id} className="flex gap-4 border-b border-slate-800/50 pb-2 last:border-0">
                <span className="text-slate-500 flex-shrink-0 w-32">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span className={clsx(
                  "font-bold uppercase text-[10px] w-12",
                  log.level === 'error' ? 'text-rose-400' : 
                  log.level === 'success' ? 'text-emerald-400' : 
                  'text-sky-400'
                )}>
                  {log.level}
                </span>
                <span className="text-slate-300 flex-1">
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <p className="text-xs text-gray-500 italic">Polling for updates every 3s...</p>
          <button 
            onClick={onClose} 
            className="px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm border bg-white hover:bg-slate-50 text-gray-700 border-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
