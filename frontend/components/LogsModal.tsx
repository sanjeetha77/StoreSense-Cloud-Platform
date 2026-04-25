import { X, Activity, Terminal } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useState, useRef } from 'react';

const LOG_MESSAGES = [
  "Initializing analysis pipeline engine...",
  "Fetching store metadata and configuration...",
  "Ingesting product catalog data (Batch 1/1)...",
  "Evaluating trust signals and social proof...",
  "Simulating AI perception and contextual gaps...",
  "Cross-referencing representation against agent benchmarks...",
  "Generating actionable recommendations...",
  "Analysis pipeline completed successfully."
];

export function LogsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [logs, setLogs] = useState<{time: string, msg: string, status: string}[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLogs([]);
      setIsSimulating(true);
      
      let index = 0;
      const interval = setInterval(() => {
        if (index < LOG_MESSAGES.length) {
          const msg = LOG_MESSAGES[index];
          const isLast = index === LOG_MESSAGES.length - 1;
          
          setLogs(prev => [...prev, {
            time: new Date().toLocaleTimeString(),
            msg: msg,
            status: isLast ? 'success' : 'info'
          }]);
          index++;
        } else {
          setIsSimulating(false);
          clearInterval(interval);
        }
      }, 1200); // 1.2s delay between logs

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
            <Terminal className="w-4 h-4 text-indigo-500" /> System Logs {isSimulating && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ml-1" />}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div ref={scrollRef} className="p-6 overflow-y-auto flex-1 font-mono text-sm bg-slate-900 text-slate-300 scroll-smooth">
          <div className="space-y-3">
            {logs.length === 0 && (
              <div className="flex gap-4 animate-pulse">
                <span className="text-slate-500 flex-shrink-0 w-24">[{new Date().toLocaleTimeString()}]</span>
                <span className="text-indigo-400">Connecting to analysis server...</span>
              </div>
            )}
            
            {logs.map((log, i) => (
              <div key={i} className="flex gap-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
                <span className="text-slate-500 flex-shrink-0 w-24">[{log.time}]</span>
                <span className={clsx(
                  log.status === 'success' ? 'text-emerald-400 font-bold' : 'text-slate-300'
                )}>
                  {log.msg}
                </span>
              </div>
            ))}
            
            {isSimulating && logs.length > 0 && (
              <div className="flex gap-4 animate-pulse">
                <span className="text-slate-500 flex-shrink-0 w-24">[{new Date().toLocaleTimeString()}]</span>
                <span className="text-amber-400 flex items-center gap-2">Processing<span className="flex gap-0.5"><span className="animate-bounce">.</span><span className="animate-bounce delay-75">.</span><span className="animate-bounce delay-150">.</span></span></span>
              </div>
            )}
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button 
            onClick={onClose} 
            className={clsx(
              "px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm border",
              isSimulating ? "bg-slate-100 text-gray-400 border-slate-200 cursor-not-allowed" : "bg-white hover:bg-slate-50 text-gray-700 border-slate-200"
            )}
            disabled={isSimulating}
          >
            {isSimulating ? 'Running...' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
