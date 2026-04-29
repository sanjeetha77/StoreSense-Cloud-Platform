"""
Stage 5 — Scoring Engine Agent.

Combines completeness, trust, and perception sub-scores into
a single weighted total using rules defined in scoring_rules.py.

Perception objections are treated as "perception gaps" — concrete
issues an AI agent raised when evaluating the store. They:
  1. Penalize the perception sub-score
  2. Are surfaced separately in the API response as perception_gaps

Weights:
  Completeness  40%  — foundational data availability
  Trust         30%  — critical for recommendation decisions
  Perception    30%  — captures semantic AI understanding
"""

import logging
from app.pipeline.state import StoreAnalysisState
from app.utils.scoring_rules import (
    score_completeness,
    score_trust,
    score_perception,
    SCORE_WEIGHTS,
)
from app.utils.error_handler import agent_result

logger = logging.getLogger(__name__)


async def scoring_agent(state: StoreAnalysisState) -> StoreAnalysisState:
    """
    Stage 5: Scoring Engine

    Reads completeness issues, trust signals, and perception output.
    Produces a weighted total score with a full breakdown.
    """
    logger.info("[Scoring] Calculating weighted scores")

    total_products = len(state.get("products", []))
    issues = state.get("issues", [])
    trust_signals = state.get("trust_signals", {})
    perception = state.get("perception", {})

    # --- Calculate sub-scores ---
    c_score = score_completeness(issues, total_products)
    t_score = score_trust(trust_signals)
    p_score = score_perception(perception)

    # --- Weighted total ---
    total = round(
        c_score * SCORE_WEIGHTS["completeness"]
        + t_score * SCORE_WEIGHTS["trust"]
        + p_score * SCORE_WEIGHTS["perception"],
        1,
    )

    # --- Perception gaps: objections raised by the LLM ---
    perception_gaps = perception.get("objections", [])

    score = {
        "total": total,
        "breakdown": {
            "completeness": c_score,
            "trust": t_score,
            "perception": p_score,
        },
        "weights": {
            "completeness": f"{int(SCORE_WEIGHTS['completeness'] * 100)}%",
            "trust": f"{int(SCORE_WEIGHTS['trust'] * 100)}%",
            "perception": f"{int(SCORE_WEIGHTS['perception'] * 100)}%",
        },
        "perception_gaps": perception_gaps,
    }

    logger.info(
        f"[Scoring] ✅ Total: {total} | "
        f"Completeness: {c_score} | Trust: {t_score} | Perception: {p_score}"
    )
    _ = agent_result("success", score)

    return {
        "score": score,
    }
