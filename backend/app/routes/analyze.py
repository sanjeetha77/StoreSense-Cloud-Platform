"""
POST /api/analyze — Store analysis endpoint.

Orchestrates the 7-stage pipeline and delegates all response
formatting to the aggregation layer (response_builder).

The route is intentionally thin:
  1. Validate input
  2. Run pipeline
  3. Call response_builder.build_response()
  4. Return structured output
"""

import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter
from pydantic import BaseModel, field_validator

from app.pipeline.graph import pipeline
from app.pipeline.state import StoreAnalysisState
from app.utils.response_builder import build_response
from app.services.llm import MODELS
from app.agents.perception import run_perception_simulation

router = APIRouter()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    store_url: str

    @field_validator("store_url")
    @classmethod
    def validate_store_url(cls, v: str) -> str:
        v = v.strip().lower()
        if not v:
            raise ValueError("store_url cannot be empty")
        v = v.replace("https://", "").replace("http://", "").strip("/")
        if "." not in v:
            raise ValueError("store_url must be a valid domain (e.g. example.myshopify.com)")
        return v


class SimulateRequest(BaseModel):
    store_url: str
    query: str


# ---------------------------------------------------------------------------
# Route handler
# ---------------------------------------------------------------------------

@router.post("/analyze")
async def analyze_store(request: AnalyzeRequest):
    """
    Run the full 7-stage analysis pipeline and return a structured,
    UI-ready JSON response.

    Pipeline stages:
      1. ingest        → fetch + normalize products
      2. completeness  → check missing fields
      3. trust         → evaluate trust signals
      4. perception    → AI buyer-proxy simulation (LLM)
      5. scoring       → weighted score calculation
      6. summarizer    → compact state for LLM prompt
      7. recommendation → prioritized fixes + what-if (LLM)

    All response assembly is handled by response_builder.build_response().
    """
    logger.info(f"[Route] 📥 Analyze request: {request.store_url}")
    start_time = datetime.now(timezone.utc)

    # --- Initialize pipeline state ---
    initial_state: StoreAnalysisState = {
        "store_url": request.store_url,
        "products": [],
        "issues": [],
        "trust_signals": {},
        "perception": {},
        "score": {},
        "summary": "",
        "recommendations": "",
        "what_if": {},
        "llm_model_used": MODELS[0],   # Default — overwritten by recommendation agent
        "errors": [],
        "status": "pending",
    }

    # --- Execute pipeline ---
    final_state = await pipeline.ainvoke(initial_state)

    # --- Determine if LLM fallback was used ---
    errors = final_state.get("errors", [])
    llm_agents = {"perception", "recommendation"}
    fallback_used = any(e.get("agent") in llm_agents for e in errors)

    # Model actually used (written by recommendation agent, or default primary)
    llm_model_used = final_state.get("llm_model_used", MODELS[0])

    # --- Build structured, UI-ready response ---
    response = build_response(
        state=final_state,
        start_time=start_time,
        fallback_used=fallback_used,
        llm_model_used=llm_model_used,
    )

    logger.info(
        f"[Route] ✅ Done — status={response['status']} "
        f"score={response['score']['overall']} "
        f"time={response['meta']['analysis_time']}"
    )

    return response


@router.post("/simulate")
async def simulate_perception(request: SimulateRequest):
    """
    Run a specific AI perception simulation query against a store.
    """
    logger.info(f"[Route] 📥 Simulate request for {request.store_url}: {request.query}")
    
    initial_state: StoreAnalysisState = {
        "store_url": request.store_url,
        "products": [],
        "issues": [],
        "trust_signals": {},
        "perception": {},
        "score": {},
        "summary": "",
        "recommendations": "",
        "what_if": {},
        "llm_model_used": MODELS[0],
        "errors": [],
        "status": "pending",
    }
    
    from app.agents.ingestion import ingest_agent
    from app.agents.completeness import completeness_agent
    
    # Run ingestion and completeness to get store info for the prompt
    ingest_result = await ingest_agent(initial_state)
    state = {**initial_state, **ingest_result}
    
    comp_result = await completeness_agent(state)
    state = {**state, **comp_result}
    
    result = await run_perception_simulation(state, request.query)
    return result


# ---------------------------------------------------------------------------
# Logs endpoint
# ---------------------------------------------------------------------------

# Static logs for demonstration to avoid timestamp drift on every refresh
_MOCK_LOGS = [
    {
        "id": 1,
        "level": "info",
        "message": "Analysis requested via web UI",
        "timestamp": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    },
    {
        "id": 2,
        "level": "info",
        "message": "Initializing analysis pipeline engine...",
        "timestamp": (datetime.now(timezone.utc) - timedelta(minutes=4, seconds=55)).isoformat()
    },
    {
        "id": 3,
        "level": "success",
        "message": "Shopify product catalog ingestion complete",
        "timestamp": (datetime.now(timezone.utc) - timedelta(minutes=4, seconds=40)).isoformat()
    },
    {
        "id": 4,
        "level": "info",
        "message": "Simulating AI perception and buyer-proxy simulation...",
        "timestamp": (datetime.now(timezone.utc) - timedelta(minutes=4, seconds=30)).isoformat()
    }
]

@router.get("/logs")
async def get_logs():
    """
    Returns structured system logs.
    Timestamps are now fixed relative to the session start.
    """
    return _MOCK_LOGS

