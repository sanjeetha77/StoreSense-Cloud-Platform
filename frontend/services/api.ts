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
