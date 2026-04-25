import { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import clsx from 'clsx';

export function ProgressLoader({ 
  message = "Running pipeline...", 
  subMessage = "This usually takes about 15-30 seconds." 
}) {
  const stages = [
    'Ingesting products',
    'Checking completeness',
    'Evaluating trust',
    'Simulating AI perception',
    'Calculating score',
    'Summarizing',
    'Generating recommendations',
  ];

  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    // Simulate progression
    const interval = setInterval(() => {
      setCurrentStage(prev => {
        if (prev < stages.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [stages.length]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center max-w-md mx-auto w-full">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-6" />
      <h3 className="text-xl font-bold text-gray-900 mb-2">{message}</h3>
      <p className="text-gray-500 text-sm mb-8">{subMessage}</p>
      
      <div className="flex flex-col gap-3 max-w-sm mx-auto text-left">
        {stages.map((stage, i) => {
          const isPast = i < currentStage;
          const isCurrent = i === currentStage;
          
          return (
            <div key={stage} className={clsx(
              "flex items-center gap-3 transition-all duration-500",
              isPast ? "opacity-100" : isCurrent ? "opacity-100 scale-105 transform" : "opacity-40"
            )}>
              <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                {isPast ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : isCurrent ? (
                  <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                )}
              </div>
              <span className={clsx(
                "text-sm",
                isPast ? "text-gray-600 font-medium" : isCurrent ? "text-indigo-600 font-bold" : "text-gray-400 font-medium"
              )}>
                {stage}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
