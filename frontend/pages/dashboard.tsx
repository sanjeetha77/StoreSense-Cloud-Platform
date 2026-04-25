import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types — mirrors backend response_builder.build_response() exactly
// ---------------------------------------------------------------------------

interface Store { url: string; }

interface ScoreBreakdown { completeness: number; trust: number; perception: number; }

interface Score {
  overall: number;
  status: 'Needs Improvement' | 'Good' | 'Excellent';
  confidence: number;
  breakdown: ScoreBreakdown;
}

interface AffectedItem { product_id: number; title: string; }

interface Issue {
  id: string;
  title: string;
  impact: 'high' | 'medium' | 'low';
  score_impact: number;
  description: string;
  affected_items: AffectedItem[];
  affected_count: number;
  status: 'open' | 'resolved';
}

interface ActionPlanItem {
  priority: number;
  title: string;
  score_gain: number;
  effort: 'low' | 'medium' | 'high';
  guide_link: string;
}

interface Perception {
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  decision: 'Recommended' | 'Not Recommended';
  query: string;
  ai_response: string;
  reasoning: string;
  gaps: string[];
  llm_status: 'active' | 'fallback';
}

interface WhatIfAction { label: string; gain: number; }

interface WhatIf {
  current_score: number;
  potential_score: number;
  improvement: number;
  actions: WhatIfAction[];
}

interface Meta {
  analysis_time: string;
  llm_used: string;
  fallback_used: boolean;
  products_analyzed: number;
  errors: string[];
}

interface AnalysisResult {
  status: 'success' | 'partial_success' | 'failed';
  store: Store;
  score: Score;
  issues: Issue[];
  action_plan: ActionPlanItem[];
  perception: Perception;
  what_if: WhatIf;
  meta: Meta;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 55) return '#f59e0b';
  return '#f43f5e';
}

function getBarGradient(score: number): string {
  if (score >= 80) return 'linear-gradient(90deg,#10b981,#34d399)';
  if (score >= 55) return 'linear-gradient(90deg,#f59e0b,#fbbf24)';
  return 'linear-gradient(90deg,#f43f5e,#fb7185)';
}

const IMPACT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  high:   { bg: 'rgba(244,63,94,0.08)',  text: '#fb7185', border: 'rgba(244,63,94,0.2)'  },
  medium: { bg: 'rgba(245,158,11,0.08)', text: '#fbbf24', border: 'rgba(245,158,11,0.2)' },
  low:    { bg: 'rgba(59,130,246,0.08)', text: '#60a5fa', border: 'rgba(59,130,246,0.2)' },
};

const EFFORT_COLORS: Record<string, string> = {
  low:    '#10b981',
  medium: '#f59e0b',
  high:   '#f43f5e',
};

const CONF_CLASS: Record<string, string> = {
  HIGH:   'conf-high',
  MEDIUM: 'conf-medium',
  LOW:    'conf-low',
};

const CONF_ICON: Record<string, string> = { HIGH: '🟢', MEDIUM: '🟡', LOW: '🔴' };

// ---------------------------------------------------------------------------
// Score Ring
// ---------------------------------------------------------------------------

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 68;
  const circ = 2 * Math.PI * r;
  const [val, setVal] = useState(0);
  useEffect(() => { const t = setTimeout(() => setVal(score), 200); return () => clearTimeout(t); }, [score]);
  const offset = circ - (val / 100) * circ;

  return (
    <div className="score-ring-wrap">
      <svg className="score-ring-svg" viewBox="0 0 160 160">
        <circle className="score-ring-bg" cx="80" cy="80" r={r} />
        <circle
          className="score-ring-fill"
          cx="80" cy="80" r={r}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ stroke: color, filter: `drop-shadow(0 0 8px ${color}55)` }}
        />
      </svg>
      <div className="score-number">
        <span className="score-value" style={{ color }}>{Math.round(val)}</span>
        <span className="score-label">/ 100</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline sub-components
// ---------------------------------------------------------------------------

function SubScoreBar({ label, weight, value }: { label: string; weight: string; value: number }) {
  return (
    <div className="sub-score-row">
      <div className="sub-score-header">
        <span className="sub-score-name">
          {label} <span style={{ opacity: 0.45, fontSize: '0.7rem' }}>({weight})</span>
        </span>
        <span className="sub-score-val">{value}</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${value}%`, background: getBarGradient(value) }} />
      </div>
    </div>
  );
}

function ImpactBadge({ impact }: { impact: string }) {
  const c = IMPACT_COLORS[impact] ?? IMPACT_COLORS.low;
  return (
    <span style={{
      display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: '999px',
      fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>
      {impact}
    </span>
  );
}

function EffortBadge({ effort }: { effort: string }) {
  const color = EFFORT_COLORS[effort] ?? '#94a3b8';
  return (
    <span style={{
      display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: '999px',
      fontSize: '0.7rem', fontWeight: 600, color,
      background: `${color}18`, border: `1px solid ${color}35`,
    }}>
      {effort} effort
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const router = useRouter();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('analysisResult');
    if (!raw) { router.replace('/'); return; }
    try {
      setResult(JSON.parse(raw) as AnalysisResult);
      setMounted(true);
    } catch {
      router.replace('/');
    }
  }, [router]);

  if (!mounted || !result) {
    return (
      <div className="page-wrapper" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const { status, store, score, issues, action_plan, perception, what_if, meta } = result;
  const scoreColor = getScoreColor(score.overall);

  const statusClass = status === 'success' ? 'status-success'
    : status === 'partial_success' ? 'status-partial' : 'status-failed';
  const statusLabel = status === 'success' ? '✅ Success'
    : status === 'partial_success' ? '⚠️ Partial Success' : '❌ Failed';

  return (
    <>
      <Head>
        <title>Analysis — {store.url} | AI Store Optimizer</title>
        <meta name="description" content={`AI store analysis for ${store.url}`} />
      </Head>

      <div className="bg-mesh" />

      <main className="page-wrapper">
        <div className="dashboard container fade-in">

          {/* ── Header ── */}
          <div className="dash-header">
            <div>
              <h1 className="dash-title">Store Analysis Report</h1>
              <p className="store-tag">🔗 {store.url}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
              <button
                id="new-analysis-btn"
                className="btn-primary"
                style={{ padding: '0.5rem 1.1rem', fontSize: '0.82rem' }}
                onClick={() => router.push('/')}
              >
                ← New Analysis
              </button>
            </div>
          </div>

          {/* ── Error banner (partial_success) ── */}
          {meta.errors.length > 0 && (
            <div className="error-banner">
              <p className="error-banner-title">⚠️ Some pipeline stages encountered errors</p>
              <ul className="error-banner-list">
                {meta.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {/* ── Row 1: Score + Perception ── */}
          <div className="grid-2 mb">

            {/* Score card */}
            <div className="card score-card">
              <p className="card-title">📊 Overall AI Score</p>

              <ScoreRing score={score.overall} color={scoreColor} />

              {/* Score status label */}
              <span style={{
                display: 'inline-block', marginBottom: '1.25rem',
                padding: '0.3rem 1rem', borderRadius: '999px', fontSize: '0.78rem',
                fontWeight: 700, background: `${scoreColor}18`,
                color: scoreColor, border: `1px solid ${scoreColor}35`,
              }}>
                {score.status}
              </span>

              <div className="sub-score-list">
                <SubScoreBar label="Completeness" weight="40%" value={score.breakdown.completeness} />
                <SubScoreBar label="Trust"         weight="30%" value={score.breakdown.trust} />
                <SubScoreBar label="Perception"    weight="30%" value={score.breakdown.perception} />
              </div>

              {/* Analysis confidence */}
              <div style={{ marginTop: '1.25rem', padding: '0.6rem 0.85rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Analysis Confidence</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'JetBrains Mono,monospace' }}>{score.confidence}%</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${score.confidence}%`, background: getBarGradient(score.confidence) }} />
                </div>
              </div>
            </div>

            {/* Perception card */}
            <div className="card">
              <p className="card-title">🧠 AI Perception Simulation</p>

              <span className={`confidence-badge ${CONF_CLASS[perception.confidence] ?? 'conf-low'}`}>
                {CONF_ICON[perception.confidence]} {perception.confidence} Confidence
              </span>

              {/* Decision badge */}
              <div style={{ marginBottom: '1rem' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.8rem',
                  fontWeight: 700, border: '1px solid',
                  ...(perception.decision === 'Recommended'
                    ? { background: 'rgba(16,185,129,0.1)', color: '#34d399', borderColor: 'rgba(16,185,129,0.3)' }
                    : { background: 'rgba(244,63,94,0.1)',  color: '#fb7185', borderColor: 'rgba(244,63,94,0.3)'  }),
                }}>
                  {perception.decision === 'Recommended' ? '✅' : '❌'} {perception.decision}
                </span>
              </div>

              {/* LLM status chip */}
              <div style={{ marginBottom: '0.85rem' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem',
                  fontWeight: 600,
                  ...(perception.llm_status === 'active'
                    ? { background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }
                    : { background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }),
                }}>
                  ⚡ LLM {perception.llm_status}
                </span>
              </div>

              <p className="card-heading">AI Buyer Verdict</p>
              <p className="card-body">{perception.reasoning || 'No reasoning available.'}</p>

              {perception.gaps.length > 0 && (
                <>
                  <p style={{ fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginTop: '1rem', marginBottom: '0.5rem' }}>
                    Perception Gaps
                  </p>
                  <div className="tag-list">
                    {perception.gaps.map((g, i) => (
                      <span key={i} className="tag tag-rose">⚠ {g}</span>
                    ))}
                  </div>
                </>
              )}

              <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '1rem', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Simulated Query</span>
                {perception.query}
              </p>
            </div>
          </div>

          {/* ── What-If Banner ── */}
          {what_if.improvement > 0 && (
            <div className="whatif-card mb">
              <div>
                <p className="card-title" style={{ marginBottom: '0.4rem' }}>✨ What-If Simulation</p>
                <p className="whatif-improvement">+{what_if.improvement} points potential</p>
              </div>

              <div className="whatif-arrow">
                <div className="whatif-score">
                  <span className="whatif-num" style={{ color: getScoreColor(what_if.current_score) }}>
                    {Math.round(what_if.current_score)}
                  </span>
                  <span className="whatif-lbl">Current</span>
                </div>
                <span className="arrow-icon">→</span>
                <div className="whatif-score">
                  <span className="whatif-num" style={{ color: '#10b981' }}>
                    {Math.round(what_if.potential_score)}
                  </span>
                  <span className="whatif-lbl">Potential</span>
                </div>
              </div>

              {/* Per-action gains */}
              <div style={{ flex: 1, minWidth: '220px' }}>
                <p style={{ fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Top actions
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {what_if.actions.slice(0, 4).map((a, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{a.label}</span>
                      <span style={{ color: '#10b981', fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', marginLeft: '0.75rem', flexShrink: 0 }}>+{a.gain}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Row 2: Issues + Action Plan ── */}
          <div className="grid-2 mb">

            {/* Issues */}
            <div className="card">
              <p className="card-title">
                🔍 Completeness Issues
                <span style={{ marginLeft: 'auto', background: 'rgba(244,63,94,0.12)', color: '#fb7185', padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800 }}>
                  {issues.length} types
                </span>
              </p>

              {issues.length === 0 ? (
                <p className="empty-state">🎉 No issues found — all products look great!</p>
              ) : (
                <div className="issue-list">
                  {issues.slice(0, 6).map((issue) => (
                    <div key={issue.id} className="issue-row">
                      <span className="issue-icon">⚠️</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                          <p className="issue-type">{issue.title}</p>
                          <ImpactBadge impact={issue.impact} />
                          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono,monospace', flexShrink: 0 }}>
                            -{issue.score_impact}pts
                          </span>
                        </div>
                        <p className="issue-detail">{issue.description}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {issue.affected_count} product{issue.affected_count !== 1 ? 's' : ''} affected
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Plan */}
            <div className="card">
              <p className="card-title">
                🎯 Action Plan
                <span style={{ marginLeft: 'auto', background: 'rgba(99,102,241,0.12)', color: '#818cf8', padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800 }}>
                  {action_plan.length} actions
                </span>
              </p>

              {action_plan.length === 0 ? (
                <p className="empty-state">✅ Nothing to fix — store looks great!</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {action_plan.slice(0, 6).map((item) => (
                    <div key={item.priority} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                      padding: '0.7rem 0.85rem', borderRadius: '8px',
                      background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)',
                    }}>
                      <span style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                        fontSize: '0.72rem', fontWeight: 800,
                      }}>
                        {item.priority}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</span>
                          <EffortBadge effort={item.effort} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700, fontFamily: 'JetBrains Mono,monospace' }}>
                            +{item.score_gain} pts
                          </span>
                          <a
                            href={item.guide_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.75rem', color: 'var(--accent-indigo)', textDecoration: 'none' }}
                          >
                            📖 Guide →
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Meta strip ── */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center',
            padding: '1rem 1.25rem', borderRadius: '12px',
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
            marginBottom: '1.25rem',
          }}>
            {[
              { icon: '⏱', label: 'Analysis Time', value: meta.analysis_time },
              { icon: '🤖', label: 'LLM Used',      value: meta.llm_used.replace('models/', '') },
              { icon: '📦', label: 'Products',      value: `${meta.products_analyzed} analyzed` },
              { icon: meta.fallback_used ? '⚠️' : '✅', label: 'LLM Status', value: meta.fallback_used ? 'Fallback used' : 'Full AI' },
            ].map((m) => (
              <div key={m.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 1.25rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.2rem' }}>
                  {m.icon} {m.label}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono,monospace' }}>
                  {m.value}
                </span>
              </div>
            ))}
          </div>

          {/* ── Footer ── */}
          <div style={{ textAlign: 'center', padding: '0.5rem 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Powered by Gemini 2.5 Flash · LangGraph Pipeline · FastAPI
          </div>

        </div>
      </main>
    </>
  );
}
