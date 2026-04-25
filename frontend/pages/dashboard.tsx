import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AlertCircle, Target, CheckCircle2, AlertTriangle, MessageSquareText, RotateCw, Flame, Award } from 'lucide-react';
import clsx from 'clsx';
import { ScoreCard } from '../components/ScoreCard';
import { RecommendationCard } from '../components/RecommendationCard';
import { ProgressLoader } from '../components/ProgressLoader';
import { runAnalysis } from '../services/api';

export default function Dashboard() {
  const router = useRouter();
  const [result, setResult] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  
  // Interactive state
  const [fixedActions, setFixedActions] = useState<number[]>([]); // indexes of fixed actions
  const [isRerunning, setIsRerunning] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('analysisResult');
    if (!raw) {
      setMounted(true);
      return;
    }
    try {
      setResult(JSON.parse(raw));
      setMounted(true);
    } catch {
      setMounted(true);
    }
  }, []);

  if (!mounted) return null;

  if (isRerunning) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <ProgressLoader 
          message="Re-running Analysis Pipeline" 
          subMessage="Validating your fixes against AI agent benchmarks..."
        />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="w-20 h-20 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center mb-6">
          <Target className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No Analysis Data Found</h2>
        <p className="text-gray-500 max-w-md text-center mb-8">
          Run a new analysis to see how AI agents perceive your store, identify completeness gaps, and get actionable recommendations.
        </p>
        <button 
          onClick={() => router.push('/')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm"
        >
          Start Store Analysis
        </button>
      </div>
    );
  }

  const { score, perception, action_plan } = result;

  // Calculate projected score
  const currentScore = score?.overall || 0;
  const projectedGains = fixedActions.reduce((total, index) => {
    return total + (action_plan[index]?.score_gain || 0);
  }, 0);
  const projectedScore = Math.min(100, currentScore + projectedGains);
  const totalIssues = action_plan?.length || 0;
  const fixedCount = fixedActions.length;
  const progressPercent = totalIssues > 0 ? (fixedCount / totalIssues) * 100 : 0;

  // Extract Top Impact Actions
  const sortedActions = [...(action_plan || [])].map((act, i) => ({ ...act, originalIndex: i })).sort((a, b) => b.score_gain - a.score_gain);
  const topHighImpact = sortedActions.filter(a => a.effort === 'high' || a.score_gain > 5).slice(0, 3);
  const regularActions = sortedActions.filter(a => !topHighImpact.find(hi => hi.originalIndex === a.originalIndex));

  const handleToggleFix = (index: number) => {
    if (fixedActions.includes(index)) {
      setFixedActions(fixedActions.filter(i => i !== index));
    } else {
      setFixedActions([...fixedActions, index]);
    }
  };

  const handleRerun = async () => {
    setIsRerunning(true);
    try {
      const storeUrl = sessionStorage.getItem('storeUrl') || '';
      if (!storeUrl) throw new Error("No store URL found");
      
      const newResult = await runAnalysis(storeUrl);
      sessionStorage.setItem('analysisResult', JSON.stringify(newResult));
      
      // Reset state and show new result
      setResult(newResult);
      setFixedActions([]);
      window.scrollTo(0, 0);
    } catch (err) {
      alert("Failed to re-run analysis. Please check your connection or try again later.");
    } finally {
      setIsRerunning(false);
    }
  };

  return (
    <>
      <Head>
        <title>Dashboard | AI Store Optimizer</title>
      </Head>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Analysis Overview</h1>
        <p className="text-gray-500 text-sm">Comprehensive breakdown of your store's AI readiness and perception metrics.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* LEFT PANEL: Overall AI Score Card Component */}
        <div className="lg:col-span-4">
          <ScoreCard 
            score={score} 
            projectedScore={projectedScore} 
            isProjecting={fixedActions.length > 0} 
          />
        </div>

        {/* RIGHT PANEL: AI Perception Panel & Gaps */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex-1">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <h2 className="text-sm font-bold tracking-wider text-gray-500 uppercase flex items-center gap-2">
                <MessageSquareText className="w-4 h-4 text-indigo-500" /> AI Perception Simulation
              </h2>
              
              <div className="flex gap-3">
                <div className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border",
                  perception?.confidence === 'HIGH' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  perception?.confidence === 'MEDIUM' ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-rose-50 text-rose-700 border-rose-200"
                )}>
                  {perception?.confidence || 'LOW'} CONFIDENCE
                </div>
                
                <div className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5",
                  perception?.decision === 'Recommended' 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                )}>
                  {perception?.decision === 'Recommended' ? 'RECOMMENDED' : 'NOT RECOMMENDED'}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mb-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AI Agent Verdict</h3>
              <p className="text-gray-700 text-sm leading-relaxed font-medium">
                {perception?.reasoning || 'The AI agent reviewed the store and found insufficient trust signals and completeness to formulate a strong recommendation.'}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Perception Gaps
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {perception?.gaps?.map((gap: string, i: number) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 flex items-start gap-3 hover:border-amber-200 transition-colors shadow-sm">
                    <div className="bg-amber-50 rounded-md p-1.5 flex-shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">Context Missing</h4>
                      <p className="text-xs text-gray-600 leading-snug">{gap}</p>
                    </div>
                  </div>
                ))}
                {(!perception?.gaps || perception.gaps.length === 0) && (
                  <div className="text-sm text-gray-500 italic flex items-center gap-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" /> No significant perception gaps identified.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress & Fix Tracking Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-lg">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-1">
              <Award className="w-5 h-5 text-indigo-600" /> Improvement Progress
            </h2>
            <p className="text-sm text-gray-500 mb-3">
              You have successfully marked <span className="font-bold text-gray-900">{fixedCount} out of {totalIssues}</span> issues as fixed.
            </p>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden w-full border border-slate-200">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-700 ease-out" 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
            {fixedActions.length > 0 && (
              <div className="animate-in fade-in slide-in-from-right-8 duration-500 mb-2">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest text-right mb-1">Projected Score After Fixes</p>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 font-mono text-xl line-through">{Math.round(currentScore)}</span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className="text-3xl font-black text-indigo-600 font-mono">{Math.round(projectedScore)}</span>
                  <span className="text-sm font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">+{Math.round(projectedScore - currentScore)}</span>
                </div>
              </div>
            )}
            <button 
              onClick={handleRerun}
              disabled={fixedActions.length === 0}
              className={clsx(
                "px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-sm border",
                fixedActions.length > 0 
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600" 
                  : "bg-slate-50 text-gray-400 border-slate-200 cursor-not-allowed"
              )}
            >
              <RotateCw className={clsx("w-4 h-4", fixedActions.length > 0 && "animate-spin-once")} /> 
              Re-run Analysis Pipeline
            </button>
          </div>
        </div>
      </div>

      {/* Top Priority Recommendations */}
      {topHighImpact.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4 px-2">
            <Flame className="w-5 h-5 text-rose-500" /> High Impact Fixes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topHighImpact.map((action: any) => (
              <RecommendationCard 
                key={`hi-${action.originalIndex}`}
                action={action}
                currentScore={currentScore}
                isFixed={fixedActions.includes(action.originalIndex)}
                onToggleFix={() => handleToggleFix(action.originalIndex)}
                onRerun={handleRerun}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Recommendations */}
      {regularActions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4 px-2">
            <Target className="w-5 h-5 text-indigo-600" /> Standard Recommendations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularActions.map((action: any) => (
              <RecommendationCard 
                key={`reg-${action.originalIndex}`}
                action={action}
                currentScore={currentScore}
                isFixed={fixedActions.includes(action.originalIndex)}
                onToggleFix={() => handleToggleFix(action.originalIndex)}
                onRerun={handleRerun}
              />
            ))}
          </div>
        </div>
      )}
      
      {totalIssues === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">Perfect Score!</h3>
          <p className="text-gray-500">All clear. You have no pending recommendations.</p>
        </div>
      )}
    </>
  );
}
