const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    // If we are running in the browser and the host is localhost, use the local backend port.
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:8000";
    }
    // In production or k8s, Ingress routes /api to the backend. We can use relative path.
    return "";
  }
  return "http://localhost:8000";
};

const BASE_URL = getBaseUrl();

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
