# Port‑forward StoreSense services in Minikube
# Run each command in its own PowerShell tab or as background jobs.
# Backend (FastAPI) -> http://localhost:8000
kubectl port-forward svc/backend-service 8000:8000 -n default

# Frontend (Next.js) -> http://storesense-ai.local:8080
# Ensure the hostname resolves to 127.0.0.1 (add to hosts file if needed)
kubectl port-forward svc/frontend-service 8080:3000 -n default
