"""
LangGraph Pipeline Definition.

This module builds the analysis pipeline as a directed graph where each
node is an agent function that reads and mutates the shared StoreAnalysisState.

Pipeline order (as agreed):
  ingest → completeness → trust → perception → scoring → summarizer → recommendation

Conditional routing:
  After ingestion — if it completely failed (no products fetched),
  the pipeline short-circuits to END, skipping all downstream agents.
  This prevents unnecessary LLM calls on bad store URLs.

The compiled pipeline is exported as `pipeline` and used directly
by the FastAPI route handler.
"""

import logging
from langgraph.graph import StateGraph, END
from app.pipeline.state import StoreAnalysisState
from app.agents.ingestion import ingest_agent
from app.agents.completeness import completeness_agent
from app.agents.trust import trust_agent
from app.agents.perception import perception_agent
from app.agents.scoring import scoring_agent
from app.agents.summarizer import summarizer_agent
from app.agents.recommendation import recommendation_agent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Routing logic
# ---------------------------------------------------------------------------

def _route_after_ingest(state: StoreAnalysisState) -> str:
    """
    Decide whether to continue the pipeline or short-circuit after ingestion.

    Conditions for short-circuit (→ END):
      - An ingestion error exists AND no products were fetched
        (means the store URL is wrong, auth failed, or Shopify is unreachable)

    All other cases (partial products, no errors) → continue normally.
    """
    has_ingestion_error = any(
        e.get("agent") == "ingestion" for e in state.get("errors", [])
    )
    products_empty = not state.get("products")

    if has_ingestion_error and products_empty:
        logger.warning("[Graph] ⚠️ Ingestion failed with no products — short-circuiting to END")
        return "end"

    return "completeness"


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------

def build_pipeline():
    """
    Construct and compile the LangGraph StateGraph.

    Returns a compiled runnable that accepts StoreAnalysisState
    and can be invoked with `.ainvoke(initial_state)`.
    """
    workflow = StateGraph(StoreAnalysisState)

    # --- Register nodes ---
    workflow.add_node("ingest", ingest_agent)
    workflow.add_node("completeness", completeness_agent)
    workflow.add_node("trust", trust_agent)
    workflow.add_node("perception", perception_agent)
    workflow.add_node("scoring", scoring_agent)
    workflow.add_node("summarizer", summarizer_agent)
    workflow.add_node("recommendation", recommendation_agent)

    # --- Entry point ---
    workflow.set_entry_point("ingest")

    # --- Conditional edge after ingestion ---
    workflow.add_conditional_edges(
        "ingest",
        _route_after_ingest,
        {
            "completeness": "completeness",   # Normal flow
            "end": END,                        # Short-circuit on total failure
        },
    )

    # --- Linear pipeline to completeness ---
    # completeness now precedes the parallel block
    
    # --- Parallel block ---
    workflow.add_edge("completeness", "trust")
    workflow.add_edge("completeness", "perception")

    # --- Join block into scoring ---
    # We must join BOTH parallel branches before proceeding to scoring
    workflow.add_edge(["trust", "perception"], "scoring")

    # --- Linear tail ---
    workflow.add_edge("scoring", "summarizer")
    workflow.add_edge("summarizer", "recommendation")
    workflow.add_edge("recommendation", END)

    logger.info("[Graph] Pipeline compiled: ingest→completeness→trust→perception→scoring→summarizer→recommendation")
    return workflow.compile()


# Compile once at module load — reused across all requests
pipeline = build_pipeline()
