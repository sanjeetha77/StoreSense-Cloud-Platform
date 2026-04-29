"""
Stage 6 — Summarization Layer Agent.

Runs AFTER scoring. Condenses the full analysis state into a
compact, structured text block used as input to the recommendation
LLM prompt. This prevents token bloat and keeps the recommendation
prompt focused and deterministic.

The summary includes:
  - Store metadata
  - Score breakdown
  - Issue frequency table
  - Trust signal status
  - Perception output (confidence + objections)
"""

import logging
from app.pipeline.state import StoreAnalysisState
from app.utils.error_handler import agent_result

logger = logging.getLogger(__name__)


async def summarizer_agent(state: StoreAnalysisState) -> StoreAnalysisState:
    """
    Stage 6: Summarization Layer

    Builds a compact analysis summary from the full pipeline state.
    Output is stored in state["summary"] for use by the recommendation engine.
    """
    logger.info("[Summarizer] Building analysis summary")

    products = state.get("products", [])
    issues = state.get("issues", [])
    trust = state.get("trust_signals", {})
    score = state.get("score", {})
    breakdown = score.get("breakdown", {})
    perception = state.get("perception", {})

    # --- Issue frequency table ---
    issue_freq: dict[str, int] = {}
    for issue in issues:
        itype = issue.get("type", "unknown")
        issue_freq[itype] = issue_freq.get(itype, 0) + 1

    issue_lines = [
        f"  - {itype.replace('_', ' ').title()}: affects {count} product(s)"
        for itype, count in sorted(issue_freq.items(), key=lambda x: -x[1])
    ] or ["  None — all products appear complete"]

    # --- Trust status ---
    trust_lines = [
        f"  - Return Policy Present:   {'✅ Yes' if trust.get('has_return_policy') else '❌ No'}",
        f"  - Shipping Policy Present: {'✅ Yes' if trust.get('has_shipping_policy') else '❌ No'}",
        f"  - Product Reviews Enabled: {'✅ Yes' if trust.get('has_reviews') else '❌ No'}",
        f"  - Consistent Pricing:      {'✅ Yes' if trust.get('consistent_pricing') else '❌ No'}",
        f"  - Image Coverage:          {int(trust.get('image_coverage_ratio', 0) * 100)}% of products",
    ]

    # --- Objections ---
    objections = perception.get("objections", [])
    objection_lines = [f"  - {o}" for o in objections] or ["  None raised"]

    summary_sections = [
        "===== STORE ANALYSIS SUMMARY =====",
        f"Store URL:        {state.get('store_url', 'Unknown')}",
        f"Products Scanned: {len(products)}",
        f"Total Issues:     {len(issues)}",
        "",
        "--- SCORE BREAKDOWN ---",
        f"  Overall Score:  {score.get('total', 'N/A')} / 100",
        f"  Completeness:   {breakdown.get('completeness', 'N/A')} / 100  (weight 40%)",
        f"  Trust:          {breakdown.get('trust', 'N/A')} / 100  (weight 30%)",
        f"  Perception:     {breakdown.get('perception', 'N/A')} / 100  (weight 30%)",
        "",
        "--- DATA QUALITY ISSUES ---",
        *issue_lines,
        "",
        "--- TRUST SIGNALS ---",
        *trust_lines,
        "",
        "--- AI PERCEPTION ---",
        f"  Confidence:  {perception.get('confidence', 'N/A')}",
        f"  Reasoning:   {perception.get('reasoning', 'N/A')[:400]}",
        "  Objections (Perception Gaps):",
        *objection_lines,
        "",
        "===================================",
    ]

    summary = "\n".join(summary_sections)

    logger.info(f"[Summarizer] ✅ Summary built ({len(summary)} chars)")
    _ = agent_result("success", {"char_count": len(summary)})

    return {
        "summary": summary,
    }
