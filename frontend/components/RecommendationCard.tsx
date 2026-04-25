import { CheckCircle2, RotateCw, AlertTriangle, Lightbulb } from 'lucide-react';
import clsx from 'clsx';

export function RecommendationCard({ 
  action, 
  isFixed, 
  currentScore,
  onToggleFix, 
  onRerun 
}: { 
  action: any, 
  isFixed: boolean, 
  currentScore: number,
  onToggleFix: () => void,
  onRerun: () => void
}) {
  const effortColors = {
    high: "bg-rose-50 text-rose-600 border-rose-200",
    medium: "bg-amber-50 text-amber-600 border-amber-200",
    low: "bg-emerald-50 text-emerald-600 border-emerald-200"
  };

  const potentialScore = Math.min(100, Math.round(currentScore + (action.score_gain || 0)));

  return (
    <div className={clsx(
      "bg-white border hover:border-indigo-200 transition-all rounded-xl p-5 flex flex-col h-full relative overflow-hidden shadow-sm",
      isFixed ? "border-emerald-200 bg-emerald-50/30 opacity-75" : "border-slate-200"
    )}>
      {isFixed && (
        <div className="absolute top-0 right-0 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1 border-b border-l border-emerald-200 shadow-sm">
          <CheckCircle2 className="w-3 h-3" /> COMPLETED
        </div>
      )}
      
      <div className="flex justify-between items-start mb-4 pr-16">
        <div className={clsx(
          "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
          effortColors[action.effort as keyof typeof effortColors] || effortColors.medium
        )}>
          {action.effort} Priority
        </div>
        <div className="flex flex-col items-end">
          <span className="text-indigo-600 font-mono text-sm font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 shadow-sm">
            +{action.score_gain} pts
          </span>
        </div>
      </div>
      
      <h3 className={clsx("font-bold text-base mb-2 leading-tight", isFixed ? "text-gray-700 line-through decoration-slate-300" : "text-gray-900")}>
        {action.title}
      </h3>
      
      <div className="mb-4 flex-1">
        <p className="text-sm text-gray-600 leading-relaxed mb-3">
          <span className="font-semibold text-gray-800">Why it matters:</span> {" "}
          {action.description || 'Addressing this significantly improves how AI agents understand your product value and trustworthiness.'}
        </p>

        {!isFixed && (
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-700">
              <span className="font-bold">Simulation:</span> If you fix this &rarr; score improves from <span className="font-mono font-bold text-gray-900">{Math.round(currentScore)}</span> to <span className="font-mono font-bold text-emerald-600">{potentialScore}</span> (+{action.score_gain})
            </p>
          </div>
        )}
      </div>
      
      <div className="mt-auto pt-4 flex items-center justify-between gap-3 border-t border-slate-100">
        <button 
          onClick={onToggleFix}
          className={clsx(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors border",
            isFixed 
              ? "bg-white text-gray-600 hover:bg-gray-50 border-gray-200" 
              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
          )}
        >
          {isFixed ? "Undo Fix" : "Mark as Fixed"}
        </button>
        
        <button 
          onClick={onRerun}
          disabled={!isFixed}
          className={clsx(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors border",
            isFixed 
              ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-sm" 
              : "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
          )}
        >
          <RotateCw className="w-4 h-4" /> Re-run
        </button>
      </div>
    </div>
  );
}
