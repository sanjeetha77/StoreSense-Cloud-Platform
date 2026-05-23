"""
FastAPI application entry point.

Registers middleware, routers, and startup behavior.
"""

import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.routes.analyze import router as analyze_router
from app.config.settings import validate_config

import uuid
from opentelemetry import trace
from app.observability.logging import setup_logging, request_id_var, analysis_id_var
from app.observability.tracing import setup_tracing
from app.observability.metrics import REQUESTS_TOTAL
from app.utils.rate_limiter import RateLimitMiddleware

# Configure structured JSON logging
setup_logging()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AI Store Representation Optimizer",
    description=(
        "Multi-stage pipeline that analyzes a Shopify store's AI readiness. "
        "Uses deterministic rules + Gemini LLM to score completeness, trust, "
        "and AI perception, then generates prioritized recommendations."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Custom middleware to track HTTP throughput
class RequestThroughputMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        method = request.method
        endpoint = request.url.path
        
        response = await call_next(request)
        
        status_code = str(response.status_code)
        REQUESTS_TOTAL.labels(method=method, endpoint=endpoint, http_status=status_code).inc()
        return response

class CorrelationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Extract or generate request_id
        req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        
        # Extract or generate analysis_id
        ana_id = request.headers.get("x-analysis-id") or request.query_params.get("analysis_id")
        if not ana_id and request.url.path.endswith("/analyze"):
            ana_id = str(uuid.uuid4())
            
        # Bind to Context Variables
        token_req = request_id_var.set(req_id)
        token_ana = None
        if ana_id:
            token_ana = analysis_id_var.set(ana_id)
            
        # Propagate to active OTel tracing span
        current_span = trace.get_current_span()
        if current_span and current_span.get_span_context().is_valid:
            current_span.set_attribute("request_id", req_id)
            if ana_id:
                current_span.set_attribute("analysis_id", ana_id)
                
        try:
            response = await call_next(request)
            # Attach to response headers
            response.headers["X-Request-ID"] = req_id
            if ana_id:
                response.headers["X-Analysis-ID"] = ana_id
            return response
        finally:
            request_id_var.reset(token_req)
            if token_ana:
                analysis_id_var.reset(token_ana)

app.add_middleware(RequestThroughputMiddleware)
app.add_middleware(CorrelationMiddleware)
app.add_middleware(RateLimitMiddleware)

# ---------------------------------------------------------------------------
# Instrument FastAPI (Metrics & Tracing)
# ---------------------------------------------------------------------------

Instrumentator().instrument(app).expose(app)
setup_tracing(app)

# ---------------------------------------------------------------------------
# CORS — allow local Next.js frontend
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://localhost:3005",
        "http://127.0.0.1:3005",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

app.include_router(analyze_router, prefix="/api")


# ---------------------------------------------------------------------------
# Startup / health
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup():
    missing = validate_config()
    if missing:
        logger.warning(f"⚠️  Missing environment variables: {', '.join(missing)}")
        logger.warning("   Some pipeline stages may be skipped. Check your .env file.")
    else:
        logger.info("✅ Configuration validated — all env vars present")


@app.get("/health", tags=["System"])
async def health():
    """Health check endpoint."""
    missing = validate_config()
    return {
        "status": "ok",
        "service": "AI Store Representation Optimizer",
        "config_warnings": [f"Missing: {k}" for k in missing],
    }
