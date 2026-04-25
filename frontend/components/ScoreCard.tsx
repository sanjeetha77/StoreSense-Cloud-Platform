import { Target, ShieldCheck, TrendingUp } from 'lucide-react';
import clsx from 'clsx';

export function ScoreCard({ score, projectedScore, isProjecting }: { score: any, projectedScore: number, isProjecting: boolean }) {
  const getScoreColor = (val: number) => {
    if (val >= 80) return 'text-emerald-600';
    if (val >= 55) return 'text-amber-500';
    return 'text-rose-500';
  };
  
  const getScoreBg = (val: number) => {
    if (val >= 80) return 'bg-emerald-500';
    if (val >= 55) return 'bg-amber-400';
    return 'bg-rose-400';
  };

  const getScoreStroke = (val: number) => {
    if (val >= 80) return '#059669'; // emerald-600
    if (val >= 55) return '#f59e0b'; // amber-500
    return '#e11d48'; // rose-600
  };

  const currentScore = score?.overall || 0;
  const displayScore = isProjecting ? projectedScore : currentScore;
  const strokeColor = getScoreStroke(displayScore);
  
  const r = 58;
  const circ = 2 * Math.PI * r;
  const offset = circ - (displayScore / 100) * circ;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-sm font-bold tracking-wider text-gray-500 uppercase">Overall AI Score</h2>
        <div className={clsx(
          "px-3 py-1 rounded-full text-xs font-bold border transition-colors",
          displayScore >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
          displayScore >= 55 ? "bg-amber-50 text-amber-700 border-amber-200" :
          "bg-rose-50 text-rose-700 border-rose-200"
        )}>
          {displayScore >= 80 ? 'Excellent' : displayScore >= 55 ? 'Good' : 'Needs Improvement'}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center mb-10 relative">
        <svg width="160" height="160" className="transform -rotate-90">
          <circle cx="80" cy="80" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
          <circle 
            cx="80" cy="80" r={r} fill="none" 
            stroke={strokeColor} strokeWidth="12" 
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={clsx("text-4xl font-black tracking-tighter transition-colors duration-500", getScoreColor(displayScore))}>
            {Math.round(displayScore)}
          </span>
          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mt-1">out of 100</span>
        </div>
      </div>

      {isProjecting && projectedScore > currentScore && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-6 text-center animate-in fade-in zoom-in duration-300">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">Projected Improvement</p>
          <p className="text-lg font-bold text-indigo-700">+{Math.round(projectedScore - currentScore)} Points</p>
        </div>
      )}

      <div className="space-y-5">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 font-medium flex items-center gap-2"><Target className="w-4 h-4 text-indigo-500"/> Completeness</span>
            <span className="font-mono text-gray-900 font-medium">{score?.breakdown?.completeness || 0}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={clsx("h-full rounded-full transition-all duration-1000", getScoreBg(score?.breakdown?.completeness || 0))} style={{ width: `${score?.breakdown?.completeness || 0}%` }}></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 font-medium flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-indigo-500"/> Trust</span>
            <span className="font-mono text-gray-900 font-medium">{score?.breakdown?.trust || 0}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={clsx("h-full rounded-full transition-all duration-1000", getScoreBg(score?.breakdown?.trust || 0))} style={{ width: `${score?.breakdown?.trust || 0}%` }}></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 font-medium flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-500"/> Perception</span>
            <span className="font-mono text-gray-900 font-medium">{score?.breakdown?.perception || 0}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={clsx("h-full rounded-full transition-all duration-1000", getScoreBg(score?.breakdown?.perception || 0))} style={{ width: `${score?.breakdown?.perception || 0}%` }}></div>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-indigo-600 font-bold uppercase tracking-wider">Analysis Confidence</span>
          <span className="text-indigo-700 font-mono font-bold">{score?.confidence || 0}%</span>
        </div>
        <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-600 rounded-full transition-all duration-1000" style={{ width: `${score?.confidence || 0}%` }}></div>
        </div>
      </div>
    </div>
  );
}
