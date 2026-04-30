const BASE_URL = "http://localhost:8000";

export async function runAnalysis(storeUrl: string) {
  const res = await fetch(`${BASE_URL}/api/analyze`, {
    method: "POST",
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store_url: storeUrl })
  });
  if (!res.ok) {
    throw new Error('Failed to run analysis');
  }
  return res.json();
}

export async function simulatePerception(storeUrl: string, query: string) {
  const res = await fetch(`${BASE_URL}/api/simulate`, {
    method: "POST",
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store_url: storeUrl, query: query })
  });
  if (!res.ok) {
    throw new Error('Failed to run simulation');
  }
  return res.json();
}
