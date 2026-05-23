import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '15s', target: 5 },  // ramp-up to 5 VUs
    { duration: '30s', target: 5 },  // stay at 5 VUs
    { duration: '15s', target: 20 }, // ramp-up to 20 VUs
    { duration: '30s', target: 20 }, // stay at 20 VUs
    { duration: '15s', target: 50 }, // spike to 50 VUs
    { duration: '30s', target: 50 }, // stay at 50 VUs
    { duration: '15s', target: 0 },  // ramp-down to 0 VUs
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'], // Less than 10% errors allowed under heavy load
    http_req_duration: ['p(95)<8000'], // 95% of requests should complete within 8s
  },
};

export default function () {
  const url = 'http://storesense-ai.local:8080/api/analyze';
  const payload = JSON.stringify({
    store_url: 'loadtest-mock-store.myshopify.com'
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': `k6-test-${__VU}-${__ITER}`,
      'X-Analysis-ID': `k6-analysis-${__VU}-${__ITER}`
    },
  };

  // 1. Hit healthcheck to verify container health
  const healthRes = http.get('http://storesense-ai.local:8080/health');
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  sleep(1);

  // 2. Perform store analysis
  const analyzeRes = http.post(url, payload, params);
  check(analyzeRes, {
    'analyze status is 200': (r) => r.status === 200,
    'contains recommendations': (r) => r.body && r.body.includes('recommendations'),
  });

  sleep(2);
}
