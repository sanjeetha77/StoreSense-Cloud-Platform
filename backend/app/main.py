"""
FastAPI application entry point.

Registers middleware, routers, and startup behavior.
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.analyze import router as analyze_router
from app.config.settings import validate_config

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
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

# ---------------------------------------------------------------------------
# CORS — allow local Next.js frontend
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
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
