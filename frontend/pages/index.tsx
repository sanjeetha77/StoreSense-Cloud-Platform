import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, FormEvent } from 'react';

export default function Home() {
  const router = useRouter();
  const [storeUrl, setStoreUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const cleaned = storeUrl.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!cleaned) {
      setError('Please enter a store URL.');
      return;
    }
    if (!cleaned.includes('.')) {
      setError('Enter a valid domain (e.g. example.myshopify.com)');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_url: cleaned }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || `Server error: ${res.status}`);
      }

      const data = await res.json();

      // Store result in sessionStorage and navigate to dashboard
      sessionStorage.setItem('analysisResult', JSON.stringify(data));
      sessionStorage.setItem('storeUrl', cleaned);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Is the backend running?');
      setLoading(false);
    }
  };

  const features = [
    { icon: '🧠', label: 'AI Perception Simulation' },
    { icon: '📊', label: 'Completeness Scoring' },
    { icon: '🔒', label: 'Trust Signal Analysis' },
    { icon: '🎯', label: 'Prioritized Recommendations' },
    { icon: '✨', label: 'What-If Score Preview' },
    { icon: '⚡', label: 'Gemini 2.0 Powered' },
  ];

  return (
    <>
      <Head>
        <title>AI Store Optimizer — Analyze Your Shopify Store</title>
        <meta
          name="description"
          content="Analyze how AI agents perceive your Shopify store. Get completeness scores, trust signals, and prioritized recommendations powered by Gemini."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="bg-mesh" />

      <main className="page-wrapper">
        <div className="landing">
          {/* Badge */}
          <span className="logo-badge">
            <span>⚡</span> AI Store Representation Optimizer
          </span>

          {/* Hero */}
          <h1 className="landing-title">
            How does AI{' '}
            <span className="gradient-text">see your store?</span>
          </h1>

          <p className="landing-subtitle">
            A 7-stage pipeline analyzes your Shopify store&apos;s completeness,
            trust signals, and AI perception — then generates prioritized,
            actionable recommendations to improve your score.
          </p>

          {/* Input form */}
          <form className="input-group" onSubmit={handleSubmit} noValidate>
            <div className="input-wrapper">
              <span className="input-icon">🔗</span>
              <input
                id="store-url-input"
                className="store-input"
                type="text"
                placeholder="example.myshopify.com"
                value={storeUrl}
                onChange={(e) => {
                  setStoreUrl(e.target.value);
                  if (error) setError('');
                }}
                disabled={loading}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {error && (
              <p className="error-msg" role="alert">
                <span>⚠️</span> {error}
              </p>
            )}

            <button
              id="analyze-btn"
              type="submit"
              className="btn-primary"
              disabled={loading || !storeUrl.trim()}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Running pipeline…
                </>
              ) : (
                <>
                  <span>🚀</span>
                  Analyze Store
                </>
              )}
            </button>
          </form>

          {/* Pipeline stages indicator */}
          {loading && (
            <div style={{ marginTop: '1.5rem', opacity: 0.7 }}>
              <PipelineIndicator />
            </div>
          )}

          {/* Feature pills */}
          <div className="feature-pills">
            {features.map((f) => (
              <span key={f.label} className="pill">
                {f.icon} {f.label}
              </span>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

/** Animated pipeline stage labels shown while loading */
function PipelineIndicator() {
  const stages = [
    'Ingesting products',
    'Checking completeness',
    'Evaluating trust',
    'Simulating AI perception',
    'Calculating score',
    'Summarizing',
    'Generating recommendations',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
        Pipeline running…
      </p>
      {stages.map((stage, i) => (
        <span
          key={stage}
          style={{
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            animation: `fadeInDown 0.4s ease ${i * 0.12}s both`,
          }}
        >
          {i + 1}. {stage}
        </span>
      ))}
    </div>
  );
}
