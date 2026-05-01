import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { 
  AlertCircle, CheckCircle2, ChevronDown, Filter, HelpCircle, 
  Play, MessageSquare, ArrowRight, Settings, Check, ChevronUp, AlertTriangle, RefreshCw
} from 'lucide-react';
import clsx from 'clsx';
import { ProgressLoader } from '../components/ProgressLoader';
import { runAnalysis, simulatePerception } from '../services/api';

export default function Dashboard() {
  const router = useRouter();
  const [result, setResult] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  
  // Interactive state
  const [resolvedIssues, setResolvedIssues] = useState<string[]>([]);
  const [actionPlanIssues, setActionPlanIssues] = useState<string[]>([]);
  const [simulationIssues, setSimulationIssues] = useState<string[]>([]);
  const [expandedIssues, setExpandedIssues] = useState<string[]>([]);
  const [expandedWhy, setExpandedWhy] = useState<string[]>([]);
  const [isRerunning, setIsRerunning] = useState(false);
  
  // AI Perception state
  const [simQuery, setSimQuery] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<boolean>(true); // true = show result

  useEffect(() => {
    const raw = localStorage.getItem('analysis_result');
    if (!raw) {
      setMounted(true);
      return;
    }
    try {
      const data = JSON.parse(raw);
      setResult(data);
      if (data.perception?.query) {
        setSimQuery(data.perception.query);
      }
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
          <AlertCircle className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No Analysis Data Found</h2>
        <p className="text-gray-500 max-w-md text-center mb-8">
          Run a new analysis to see how AI agents perceive your store.
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

  const { score, perception, action_plan, store, issues: rawIssues } = result;

  // Map Real Issues
  const issues = [...(rawIssues || [])].map((issue) => ({ 
    ...issue, 
    impactLabel: issue.impact === 'high' ? 'High Impact' : issue.impact === 'medium' ? 'Medium Impact' : 'Low Impact',
    pts: issue.score_impact || 5
  })).sort((a, b) => b.pts - a.pts);

  // Map Action Plan Items
  const actions = [...(action_plan || [])].map((act) => ({
    ...act,
    pts: act.score_gain || 5
  }));

  // Calculations
  const currentScore = score?.overall || 0;
  
  // Real progress gains (updates main score)
  // We use a Set to ensure unique IDs across both Top Issues and Action Plan
  const allResolvedIds = Array.from(new Set([...resolvedIssues, ...actionPlanIssues]));
  const realGains = allResolvedIds.reduce((total, id) => {
    const issue = issues.find(i => i.id === id);
    const action = actions.find(a => a.id === id);
    return total + (issue?.pts || action?.pts || 0);
  }, 0);
  const mainScore = Math.min(100, currentScore + realGains);

  // Simulation gains (updates what-if projected score)
  const simulationGains = simulationIssues.reduce((total, id) => {
    const issue = issues.find(i => i.id === id);
    const action = actions.find(a => a.id === id);
    return total + (issue?.pts || action?.pts || 0);
  }, 0);
  const projectedScore = Math.min(100, currentScore + simulationGains);
  
  const totalPotential = actions.reduce((tot, a) => tot + a.pts, 0);

  const toggleResolve = (id: string) => {
    if (resolvedIssues.includes(id)) {
      setResolvedIssues(resolvedIssues.filter(i => i !== id));
    } else {
      setResolvedIssues([...resolvedIssues, id]);
    }
  };

  const toggleActionPlan = (id: string) => {
    if (actionPlanIssues.includes(id)) {
      setActionPlanIssues(actionPlanIssues.filter(i => i !== id));
    } else {
      setActionPlanIssues([...actionPlanIssues, id]);
    }
  };

  const toggleSimulation = (id: string) => {
    if (simulationIssues.includes(id)) {
      setSimulationIssues(simulationIssues.filter(i => i !== id));
    } else {
      setSimulationIssues([...simulationIssues, id]);
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedIssues.includes(id)) {
      setExpandedIssues(expandedIssues.filter(i => i !== id));
    } else {
      setExpandedIssues([...expandedIssues, id]);
    }
  };

  const toggleWhy = (id: string) => {
    if (expandedWhy.includes(id)) {
      setExpandedWhy(expandedWhy.filter(i => i !== id));
    } else {
      setExpandedWhy([...expandedWhy, id]);
    }
  };

  const handleRerun = async () => {
    setIsRerunning(true);
    try {
      const storeUrl = localStorage.getItem('storeUrl') || '';
      const newResult = await runAnalysis(storeUrl);
      localStorage.setItem('analysis_result', JSON.stringify(newResult));
      setResult(newResult);
      setResolvedIssues([]);
      window.scrollTo(0, 0);
    } catch (err) {
      alert("Failed to re-run analysis.");
    } finally {
      setIsRerunning(false);
    }
  };

  const handleSimulate = async () => {
    if (!simQuery.trim()) return;
    
    setIsSimulating(true);
    try {
      const storeUrl = localStorage.getItem('storeUrl') || '';
      const simulationResult = await simulatePerception(storeUrl, simQuery);
      
      // Update the perception part of the result state
      setResult((prev: any) => ({
        ...prev,
        perception: simulationResult
      }));
      
      setSimResult(true);
    } catch (err) {
      alert("Failed to run simulation.");
    } finally {
      setIsSimulating(false);
    }
  };

  const completenessScore = score?.completeness || 72;
  const trustScore = score?.trust || 58;
  const perceptionScore = score?.perception || 74;

  const scoreStatus = currentScore >= 80 ? 'Good' : currentScore >= 60 ? 'Needs Improvement' : 'Poor';
  const projScoreStatus = projectedScore >= 80 ? 'Good' : projectedScore >= 60 ? 'Needs Improvement' : 'Poor';

  return (
    <div className="max-w-[1400px] mx-auto pb-4">
      <Head>
        <title>Dashboard | AI Store Optimizer</title>
      </Head>



      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard</h1>
        <p className="text-gray-500 text-sm">Overview of your store's AI readiness and actionable insights</p>
      </div>

      {/* Top Cards: Score & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Left Card: AI Readiness Score */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-sm font-bold text-gray-900">AI Readiness Score</h2>
              <p className="text-xs text-gray-500">Overall store optimization level</p>
            </div>
            <HelpCircle className="w-5 h-5 text-gray-400 cursor-pointer" />
          </div>

          <div className="flex items-end gap-3 mb-6">
            <span className="text-6xl font-normal text-gray-900 tracking-tight transition-all duration-500">
              {Math.round(mainScore)}
            </span>
            <div className="flex flex-col mb-1.5">
              <span className="text-xl text-gray-400 font-medium">/100</span>
              {realGains > 0 && (
                <span className="text-sm font-bold text-emerald-500 animate-bounce">
                  +{realGains} points gain
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <div className="flex-shrink-0 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> {scoreStatus}
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Confidence: 92%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full w-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${mainScore}%` }}></div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-6 border-t border-slate-100">
            <p className="text-sm text-gray-600 max-w-md">
              Your store {currentScore < 80 ? "needs improvement" : "is well optimized"} for AI recommendations. Addressing the top issues could increase your score significantly.
            </p>
          </div>
        </div>

        {/* Right Card: Score Breakdown */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-6">Score Breakdown</h2>
          
          <div className="space-y-6">
            {/* Completeness Score */}
            <div className="relative group cursor-help pb-1">
              <div className="flex justify-between text-sm font-medium text-gray-700 mb-2 transition-colors group-hover:text-blue-600">
                <span>Completeness Score</span>
                <span className="text-gray-700 group-hover:text-gray-900">{Math.round(completenessScore)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full w-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${completenessScore}%` }}></div>
              </div>
              {/* Tooltip */}
              <div className="absolute top-full left-0 mt-2 w-[320px] bg-[#111827] text-white text-xs leading-relaxed rounded-lg p-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <div className="absolute -top-1 left-6 w-3 h-3 bg-[#111827] rotate-45 rounded-sm"></div>
                Measures the presence of essential product descriptions, tags, and store policies required by AI agents.
              </div>
            </div>
            
            {/* Trust Score */}
            <div className="relative group cursor-help pb-1">
              <div className="flex justify-between text-sm font-medium text-gray-700 mb-2 transition-colors group-hover:text-blue-600">
                <span>Trust Score</span>
                <span className="text-gray-700 group-hover:text-gray-900">{Math.round(trustScore)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full w-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full" style={{ width: `${trustScore}%` }}></div>
              </div>
              {/* Tooltip */}
              <div className="absolute top-full left-0 mt-2 w-[320px] bg-[#111827] text-white text-xs leading-relaxed rounded-lg p-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <div className="absolute -top-1 left-6 w-3 h-3 bg-[#111827] rotate-45 rounded-sm"></div>
                Evaluates trust signals like reviews, return policies, and customer service information.
              </div>
            </div>

            {/* AI Perception Score */}
            <div className="relative group cursor-help pb-1">
              <div className="flex justify-between text-sm font-medium text-gray-700 mb-2 transition-colors group-hover:text-blue-600">
                <span>AI Perception Score</span>
                <span className="text-gray-700 group-hover:text-gray-900">{Math.round(perceptionScore)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full w-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${perceptionScore}%` }}></div>
              </div>
              {/* Tooltip */}
              <div className="absolute top-full left-0 mt-2 w-[320px] bg-[#111827] text-white text-xs leading-relaxed rounded-lg p-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <div className="absolute -top-1 left-6 w-3 h-3 bg-[#111827] rotate-45 rounded-sm"></div>
                Assesses how AI agents perceive your store based on performance and user experience.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Top Issues & Action Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        
        {/* Left: Top Issues List */}
        <div className="lg:col-span-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold text-gray-900">Top Issues</h2>
          </div>

          <div className="space-y-4">
            {issues.map((issue) => {
              const isResolved = resolvedIssues.includes(issue.id);
              const isExpanded = expandedIssues.includes(issue.id);
              
              return (
                <div key={issue.id} className={clsx(
                  "bg-white border rounded-xl p-5 shadow-sm transition-all",
                  isResolved ? "border-emerald-200 bg-emerald-50/30 opacity-70" : "border-slate-200"
                )}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {isResolved ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <h3 className={clsx("text-sm font-bold mb-2", isResolved ? "text-gray-500 line-through" : "text-gray-900")}>
                          {issue.title || "Issue Detected"}
                        </h3>
                        <div className={clsx(
                          "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-3 border",
                          issue.impact === 'high' ? "bg-rose-50 text-rose-600 border-rose-100" :
                          issue.impact === 'medium' ? "bg-orange-50 text-orange-600 border-orange-100" :
                          "bg-amber-50 text-amber-600 border-amber-100"
                        )}>
                          {issue.impactLabel}
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs font-medium">
                          {issue.description && (
                            <button 
                              onClick={() => toggleWhy(issue.id)}
                              className="flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors"
                            >
                              {expandedWhy.includes(issue.id) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              Why it matters
                            </button>
                          )}
                          
                          <button 
                            onClick={() => toggleExpand(issue.id)}
                            className="flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            View Affected Products
                          </button>
                          
                          <button 
                            onClick={() => toggleResolve(issue.id)}
                            className={clsx(
                              "flex items-center gap-1 transition-colors",
                              isResolved ? "text-emerald-600" : "text-blue-600 hover:text-blue-700"
                            )}
                          >
                            <Check className="w-3.5 h-3.5" /> 
                            {isResolved ? "Resolved" : "Mark as Resolved"}
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <span className={clsx(
                        "text-sm font-bold",
                        isResolved ? "text-gray-400" : "text-emerald-500"
                      )}>+{issue.pts}</span>
                      <span className="text-[10px] text-gray-400 block -mt-1 uppercase">pts</span>
                    </div>
                  </div>
                  
                  {expandedWhy.includes(issue.id) && issue.description && (
                    <div className="mt-4 pt-4 border-t border-slate-100 pl-8">
                      <p className="text-xs text-gray-600 leading-relaxed max-w-xl">
                        <strong className="text-gray-900 font-medium">Why it matters:</strong> {issue.description}
                      </p>
                    </div>
                  )}
                  
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100 pl-8">
                      <p className="text-xs text-gray-500 font-medium mb-2">Affected Items:</p>
                      <ul className="text-sm text-gray-700 space-y-1 list-disc pl-4">
                        {issue.affected_items && issue.affected_items.filter((i: any) => typeof i === 'string' || (i.title || i.product_id)).length > 0 ? (
                          issue.affected_items
                            .filter((i: any) => typeof i === 'string' || (i.title || i.product_id))
                            .map((item: any, idx: number) => (
                              <li key={idx}>
                                {typeof item === 'string' ? item : (item.title || item.product_id)}
                              </li>
                            ))
                        ) : (
                          <li>Store Policy Settings</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Prioritized Action Plan */}
        <div className="lg:col-span-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900 mb-1">Prioritized Action Plan</h2>
                  <p className="text-xs text-gray-500">Complete tasks in order for maximum impact</p>
                </div>
                <button 
                  onClick={handleRerun}
                  disabled={isRerunning}
                  className="flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 shadow-sm transition-colors"
                >
                  <RefreshCw className={clsx("w-3.5 h-3.5", isRerunning && "animate-spin")} /> Re-run to Validate Changes
                </button>
              </div>
              
              <div className="flex justify-between items-center text-xs text-gray-500 font-medium mb-1.5">
                <span>Progress</span>
                <span>{actionPlanIssues.length} of {actions.length} completed</span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full w-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                  style={{ width: `${(actionPlanIssues.length / Math.max(1, actions.length)) * 100}%` }}
                ></div>
              </div>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto space-y-5">
              {actions.map((action) => {
                const isResolved = actionPlanIssues.includes(action.id);
                return (
                  <div key={`plan-${action.id}`} className="flex items-start gap-3 group">
                    <button 
                      onClick={() => toggleActionPlan(action.id)}
                      className={clsx(
                        "mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors",
                        isResolved ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 hover:border-blue-500"
                      )}
                    >
                      {isResolved && <Check className="w-2.5 h-2.5" />}
                    </button>
                    <div className="flex-1">
                      <p className={clsx(
                        "text-sm font-medium leading-tight mb-1 cursor-pointer hover:text-blue-600 transition-colors",
                        isResolved ? "text-gray-400 line-through" : "text-gray-800"
                      )} onClick={() => toggleActionPlan(action.id)}>
                        {action.title}
                      </p>
                      <a 
                        href={action.guide_link || "#"} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1 inline-block"
                      >
                         View Fix Guide
                      </a>
                    </div>
                    <div className={clsx(
                      "text-xs font-bold",
                      isResolved ? "text-gray-300" : "text-emerald-500"
                    )}>
                      +{action.pts} pts
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="text-xs text-gray-500 font-medium">Total potential improvement</span>
              <span className="text-sm font-bold text-emerald-500">+{totalPotential} points</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: AI Perception & What-If */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: AI Perception Preview */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-500" />
              <h2 className="text-base font-bold text-gray-900 uppercase tracking-widest">AI Perception Simulation</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-bold uppercase rounded">
                {perception?.confidence === 'HIGH' ? 'HIGH CONFIDENCE' : 'LOW CONFIDENCE'}
              </span>
              <span className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-bold uppercase rounded">
                {perception?.decision === 'Recommended' ? 'RECOMMENDED' : 'NOT RECOMMENDED'}
              </span>
            </div>
          </div>

          <div className="bg-[#f8f9fc] rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <MessageSquare className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <label className="block text-sm text-gray-500 mb-2">User Query</label>
                <input 
                  type="text" 
                  className="w-full text-sm font-medium text-gray-800 bg-transparent border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                  value={simQuery}
                  onChange={(e) => setSimQuery(e.target.value)}
                />
                <button 
                  onClick={handleSimulate}
                  disabled={isSimulating}
                  className={clsx(
                    "px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-sm",
                    isSimulating ? "bg-gray-400 cursor-not-allowed" : "bg-[#1d4ed8] hover:bg-[#1e40af] text-white hover:shadow-md active:scale-95"
                  )}
                >
                  <RefreshCw className={clsx("w-4 h-4", isSimulating && "animate-spin")} />
                  {isSimulating ? "Analyzing Query..." : "Run Simulation"}
                </button>
              </div>
            </div>
          </div>

          <div className={clsx(
            "bg-[#f8f9fc] border border-slate-200 rounded-xl p-5 relative overflow-hidden mb-8 shadow-sm transition-all duration-500",
            isSimulating ? "opacity-50 blur-[1px]" : "opacity-100"
          )}>
            <div className="absolute left-0 top-0 w-1.5 h-full bg-indigo-500"></div>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">AI Agent Verdict</h3>
            <p className="text-sm text-gray-800 leading-relaxed font-medium">
              {perception?.ai_response || "Enter a buyer query and run the simulation to see how AI agents perceive your store's trustworthiness and presentation."}
            </p>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Perception Gaps</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {perception?.gaps && perception.gaps.length > 0 ? (
              perception.gaps.map((gap: string, i: number) => (
                <div key={i} className="border border-slate-200 rounded-xl p-4 flex items-start gap-3 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-1">Context Missing</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">{gap}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 border border-slate-200 rounded-xl p-4 flex items-start gap-3 bg-white shadow-sm">
                 <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                 <div>
                   <h4 className="text-sm font-bold text-gray-900 mb-1">Context Missing</h4>
                   <p className="text-xs text-gray-600 leading-relaxed">AI agent deprioritized your store due to missing trust signals, despite having relevant products.</p>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: What-If Simulation */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col">
          <div className="mb-6">
            <h2 className="text-base font-bold text-gray-900">What-If Simulation</h2>
            <p className="text-xs text-gray-500">Toggle fixes to see projected score</p>
          </div>

          <div className="space-y-4 mb-8">
            {actions.slice(0, 5).map((action) => {
              const isSimulated = simulationIssues.includes(action.id);
              return (
                <div 
                  key={`whatif-${action.id}`} 
                  onClick={() => toggleSimulation(action.id)}
                  className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 p-2 -mx-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      "w-4 h-4 rounded-sm border flex items-center justify-center transition-colors",
                      isSimulated ? "bg-gray-800 border-gray-800" : "border-gray-300 bg-white"
                    )}>
                      {isSimulated && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className={clsx(
                      "text-sm font-medium select-none transition-colors",
                      isSimulated ? "text-gray-400 line-through" : "text-gray-700 group-hover:text-gray-900"
                    )}>
                      {action.title}
                    </span>
                  </div>
                  <span className={clsx(
                    "text-xs font-bold transition-colors",
                    isSimulated ? "text-gray-300" : "text-emerald-500"
                  )}>
                    +{action.pts}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <div className="text-center w-[40%]">
              <span className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Current</span>
              <span className="block text-3xl font-normal text-gray-900">{Math.round(currentScore)}</span>
              <span className="inline-block mt-2 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded">{scoreStatus}</span>
            </div>
            
            <ArrowRight className="w-5 h-5 text-gray-300" />
            
            <div className="text-center w-[40%]">
              <span className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Projected</span>
              <span className="block text-3xl font-normal text-gray-900">{Math.round(projectedScore)}</span>
              <span className={clsx(
                "inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded border",
                projScoreStatus === 'Good' ? "text-emerald-600 bg-emerald-50 border-emerald-100" :
                projScoreStatus === 'Needs Improvement' ? "text-amber-600 bg-amber-50 border-amber-100" :
                "text-rose-600 bg-rose-50 border-rose-100"
              )}>{projScoreStatus}</span>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
