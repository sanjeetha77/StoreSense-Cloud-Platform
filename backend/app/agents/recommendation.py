"""
Stage 7 — Recommendation Engine Agent.

Two responsibilities:
  1. Generate prioritized, actionable recommendations (LLM or rule-based fallback)
  2. Calculate a what-if score simulation showing potential score improvement

What-if simulation:
  Calculates the hypothetical score if the store addressed ALL issues:
    - Completeness → 100 (all data fields filled)
    - Trust → score with all policies and reviews enabled
    - Perception → bumped one level up (LOW→MEDIUM, MEDIUM→HIGH, HIGH→HIGH)
                   with objections cleared

Failure mode:
  - LLM unavailable → rule-based recommendations (never returns empty)
"""

import logging
from app.pipeline.state import StoreAnalysisState
from app.services.llm import call_llm
from app.utils.error_handler import make_error, agent_result
from app.utils.scoring_rules import score_trust, score_perception, SCORE_WEIGHTS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LLM Prompt
# ---------------------------------------------------------------------------

RECOMMENDATION_PROMPT = """\
You are a senior e-commerce optimization consultant specializing in AI search visibility.

A Shopify store has been analyzed. Here is the full analysis:

{summary}

=== YOUR TASK ===
Generate prioritized, concrete, actionable recommendations to improve this store's \
AI representation score and overall buyer trust.

Use this exact format:

## 🔴 High Priority (Fix Immediately)
[2-3 critical actions with specific steps. Reference the actual issues found.]

## 🟡 Medium Priority (Fix This Week)
[2-3 important improvements that build long-term trust.]

## 🟢 Low Priority (Nice to Have)
[1-2 optional enhancements for polish and discoverability.]

## ⚡ Quick Wins (Under 30 Minutes)
[1-2 things that can be done immediately with high impact.]

Rules:
- Be specific — reference actual data from the analysis above
- Explain WHY each fix matters for AI agent perception and buyer trust
- Do not repeat the analysis — focus only on forward-looking improvements
- Keep each bullet to 2-3 sentences max
"""


# ---------------------------------------------------------------------------
# Rule-based fallback
# ---------------------------------------------------------------------------

def _rule_based_recommendations(state: StoreAnalysisState) -> str:
    """
    Generate structured recommendations from rules when LLM is unavailable.
    Never returns empty — always has content based on the actual issues found.
    """
    issues = state.get("issues", [])
    trust = state.get("trust_signals", {})
    score = state.get("score", {}).get("total", 0)

    issue_types = {i["type"] for i in issues}
    issue_counts = {}
    for i in issues:
        issue_counts[i["type"]] = issue_counts.get(i["type"], 0) + 1

    lines = ["## 🔴 High Priority (Fix Immediately)\n"]

    if "missing_description" in issue_types:
        n = issue_counts["missing_description"]
        lines.append(
            f"- **Write product descriptions** ({n} product(s) affected): "
            "AI agents rely on description text to understand and recommend products. "
            "Add at least 50+ words per product describing features, use cases, and materials."
        )

    if "missing_images" in issue_types:
        n = issue_counts["missing_images"]
        lines.append(
            f"- **Upload product images** ({n} product(s) affected): "
            "Products without images are invisible to visual AI systems and dramatically "
            "reduce buyer confidence. Add at least 3 images per product."
        )

    if "missing_tags" in issue_types:
        n = issue_counts["missing_tags"]
        lines.append(
            f"- **Add descriptive tags** ({n} product(s) affected): "
            "Tags are the primary signal AI uses to categorize and surface products. "
            "Add 5–10 relevant tags per product (material, use case, audience, style)."
        )

    lines.append("\n## 🟡 Medium Priority (Fix This Week)\n")

    if not trust.get("has_return_policy"):
        lines.append(
            "- **Add a Return Policy**: Stores without a return policy are flagged LOW trust "
            "by AI agents. Add a clear return policy in Shopify Settings → Policies."
        )

    if not trust.get("has_shipping_policy"):
        lines.append(
            "- **Add a Shipping Policy**: Buyers expect shipping timelines upfront. "
            "Missing shipping information is a top objection raised by AI shopping assistants."
        )

    if "short_title" in issue_types:
        lines.append(
            "- **Improve product titles**: Short or generic titles reduce AI discoverability. "
            "Use the format: [Brand] [Product Type] [Key Feature/Variant] — e.g., 'Acme Wireless Earbuds — Noise Cancelling'."
        )

    lines.append("\n## 🟢 Low Priority (Nice to Have)\n")
    lines.append(
        "- **Enable product reviews**: Social proof is a top trust signal for AI agents. "
        "Install a reviews app (e.g., Judge.me) and collect reviews from existing customers."
    )
    lines.append(
        "- **Organize products by type**: Consistent product_type categorization helps "
        "AI recommendation engines route customers to the right products."
    )

    lines.append("\n## ⚡ Quick Wins (Under 30 Minutes)\n")
    lines.append(
        "- **Add vendor name to all products**: A consistent vendor name signals brand identity "
        "and professionalism to AI agents. Set this in bulk via Shopify Admin."
    )

    if score < 50:
        lines.append(
            f"- **Current score is {score}/100** — the biggest single improvement is adding "
            "descriptions and images to products. These two fixes alone can raise the score by 20–30 points."
        )

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# What-if simulation
# ---------------------------------------------------------------------------

def _calculate_what_if(state: StoreAnalysisState) -> dict:
    """
    Simulate the potential score if all issues were addressed.

    Assumptions:
      - Completeness: fixed to 100 (all fields complete)
      - Trust: re-scored with return policy + shipping + reviews all enabled
      - Perception: confidence bumped one level up, objections cleared
    """
    current_score_data = state.get("score", {})
    current_total = current_score_data.get("total", 0.0)
    current_breakdown = current_score_data.get("breakdown", {})

    # Potential completeness → perfect
    potential_completeness = 100.0

    # Potential trust → all policies and reviews enabled
    boosted_trust = {
        **state.get("trust_signals", {}),
        "has_return_policy": True,
        "has_shipping_policy": True,
        "has_reviews": True,
        "consistent_pricing": True,
        "reasonable_prices": True,
    }
    potential_trust = score_trust(boosted_trust)

    # Potential perception → bump confidence one level, clear objections
    current_confidence = state.get("perception", {}).get("confidence", "LOW").upper()
    confidence_ladder = {"LOW": "MEDIUM", "MEDIUM": "HIGH", "HIGH": "HIGH"}
    boosted_confidence = confidence_ladder.get(current_confidence, "MEDIUM")
    potential_perception = score_perception({"confidence": boosted_confidence, "objections": []})

    # Weighted potential total
    potential_total = round(
        potential_completeness * SCORE_WEIGHTS["completeness"]
        + potential_trust * SCORE_WEIGHTS["trust"]
        + potential_perception * SCORE_WEIGHTS["perception"],
        1,
    )

    improvement = round(potential_total - current_total, 1)

    return {
        "current_score": current_total,
        "potential_score": potential_total,
        "improvement": improvement,
        "breakdown": {
            "completeness": {
                "current": current_breakdown.get("completeness", 0),
                "potential": potential_completeness,
            },
            "trust": {
                "current": current_breakdown.get("trust", 0),
                "potential": potential_trust,
            },
            "perception": {
                "current": current_breakdown.get("perception", 0),
                "potential": potential_perception,
            },
        },
        "message": (
            f"Implementing all recommendations could improve your score from "
            f"{current_total} → {potential_total} (+{improvement} points)"
        ),
    }


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

async def recommendation_agent(state: StoreAnalysisState) -> StoreAnalysisState:
    """
    Stage 7: Recommendation Engine

    Generates prioritized recommendations and a what-if score simulation.
    Falls back gracefully to rule-based output if LLM is unavailable.
    """
    logger.info("[Recommendation] Generating recommendations")

    # Always calculate what-if (no LLM needed)
    what_if = _calculate_what_if(state)

    # Try LLM recommendations
    prompt = RECOMMENDATION_PROMPT.format(summary=state.get("summary", "No summary available."))
    llm_result = call_llm(prompt)

    # call_llm always returns a dict: {text, model_used, fallback_used, status}
    is_fallback = llm_result.get("status") == "fallback"
    llm_text = llm_result.get("text", "")
    model_used = llm_result.get("model_used", "rule-based")

    if is_fallback:
        logger.warning("[Recommendation] ⚠️ LLM unavailable — using rule-based fallback")
        err = make_error("recommendation", "LLM unavailable — rule-based recommendations used")
        _ = agent_result("partial", {"source": "rule_based"})

        return {
            **state,
            "recommendations": _rule_based_recommendations(state),
            "what_if": what_if,
            "llm_model_used": "rule-based",
            "errors": state.get("errors", []) + [err],
        }

    logger.info("[Recommendation] ✅ LLM recommendations generated")
    _ = agent_result("success", {"source": "llm"})

    return {
        **state,
        "recommendations": llm_text.strip(),
        "what_if": what_if,
        "llm_model_used": model_used,
    }
