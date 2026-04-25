"""
Stage 4 — AI Perception Simulator Agent.

This agent simulates how an AI shopping assistant would evaluate this
store if a user queried it. It uses an LLM to:

  1. Receive a concise store brief (built from products + issues)
  2. Respond as an AI agent helping a buyer decide

Output schema:
  {
    "confidence": "HIGH" | "MEDIUM" | "LOW",
    "reasoning":  "2-3 sentence overall assessment",
    "objections": ["specific buyer concern 1", ...]   ← max 5
  }

The "objections" list is treated as perception gaps and fed directly
into the scoring engine to penalize the perception sub-score.

Failure mode:
  - LLM unavailable → returns LOW confidence fallback + adds error
  - JSON parse fails → attempts regex extraction, falls back to text extraction
"""

import json
import re
import logging
from app.pipeline.state import StoreAnalysisState
from app.services.llm import call_llm
from app.utils.error_handler import make_error, agent_result

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

PERCEPTION_PROMPT = """\
You are an AI shopping assistant helping a user evaluate a Shopify store before making a purchase.

=== SIMULATED USER QUERY ===
"I'm looking to buy products from this store. Can I trust it? Are the products \
well-described and professionally presented? What concerns would I have as a buyer?"

=== STORE INFORMATION ===
{store_brief}

=== YOUR TASK ===
Evaluate this store from the perspective of an AI agent helping a user make a safe, \
informed purchase decision.

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{{
  "confidence": "HIGH",
  "reasoning": "A 2-3 sentence honest assessment of the store's trustworthiness and presentation.",
  "objections": ["specific buyer concern 1", "specific buyer concern 2"]
}}

Rules:
- confidence = "HIGH"   → you would confidently recommend purchasing
- confidence = "MEDIUM" → notable concerns exist but store is usable
- confidence = "LOW"    → major trust or data quality issues prevent recommendation
- objections must be concrete, specific, buyer-facing concerns (max 5 items)
- Be critical and honest — do not default to HIGH if there are real problems
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_store_brief(state: StoreAnalysisState) -> str:
    """Build a concise store brief from ingested products and completeness issues."""
    products = state.get("products", [])
    issues = state.get("issues", [])

    sample_titles = [p["title"] for p in products[:6] if p.get("title")]
    product_types = list({p.get("product_type", "") for p in products if p.get("product_type")})[:4]

    # Aggregate issue counts by type
    issue_freq: dict[str, int] = {}
    for issue in issues:
        itype = issue.get("type", "unknown")
        issue_freq[itype] = issue_freq.get(itype, 0) + 1

    # Pricing range
    prices: list[float] = []
    for p in products:
        for v in p.get("variants", []):
            try:
                price = float(v.get("price", 0))
                if price > 0:
                    prices.append(price)
            except (ValueError, TypeError):
                pass

    price_range = (
        f"${min(prices):.2f} – ${max(prices):.2f}"
        if prices else "Unknown"
    )

    lines = [
        f"Store URL: {state.get('store_url', 'Unknown')}",
        f"Total Products: {len(products)}",
        f"Sample Product Titles: {', '.join(sample_titles) if sample_titles else 'None'}",
        f"Product Categories: {', '.join(product_types) if product_types else 'Not specified'}",
        f"Price Range: {price_range}",
        "",
        "Data Quality Issues Detected:",
    ]

    if issue_freq:
        for itype, count in issue_freq.items():
            readable = itype.replace("_", " ").title()
            lines.append(f"  - {readable}: {count} product(s) affected")
    else:
        lines.append("  None detected — all products appear complete")

    return "\n".join(lines)


def _parse_llm_output(text: str) -> dict:
    """
    Parse LLM JSON output with fallback strategies.

    Strategy 1: Find and parse a JSON block using regex
    Strategy 2: Keyword-extract confidence from free text
    """
    # Strategy 1: JSON extraction
    json_match = re.search(r'\{[\s\S]*\}', text)
    if json_match:
        try:
            parsed = json.loads(json_match.group())
            confidence = parsed.get("confidence", "LOW").upper()
            if confidence not in ("HIGH", "MEDIUM", "LOW"):
                confidence = "LOW"
            return {
                "confidence": confidence,
                "reasoning": str(parsed.get("reasoning", ""))[:800],
                "objections": [str(o) for o in parsed.get("objections", [])[:5]],
            }
        except json.JSONDecodeError:
            logger.warning("[Perception] JSON parse failed — falling back to keyword extraction")

    # Strategy 2: Keyword extraction from free text
    upper_text = text.upper()
    if any(kw in upper_text for kw in ["HIGH CONFIDENCE", "HIGHLY TRUSTWORTHY", "EXCELLENT", "STRONG TRUST"]):
        confidence = "HIGH"
    elif any(kw in upper_text for kw in ["MODERATE", "MEDIUM", "SOME CONCERNS", "MIXED"]):
        confidence = "MEDIUM"
    else:
        confidence = "LOW"

    return {
        "confidence": confidence,
        "reasoning": text[:600].strip(),
        "objections": [],
    }


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

async def perception_agent(state: StoreAnalysisState) -> StoreAnalysisState:
    """
    Stage 4: AI Perception Simulator

    Simulates an AI agent's evaluation of the store as a buyer proxy.
    Outputs confidence, reasoning, and objections (perception gaps).
    """
    logger.info("[Perception] Running AI perception simulation")

    store_brief = _build_store_brief(state)
    prompt = PERCEPTION_PROMPT.format(store_brief=store_brief)

    llm_result = call_llm(prompt)

    # call_llm always returns a dict: {text, model_used, fallback_used, status}
    is_fallback = llm_result.get("status") == "fallback"
    llm_text = llm_result.get("text", "")

    if is_fallback:
        logger.warning("[Perception] ⚠️ LLM unavailable — using LOW confidence fallback")
        err = make_error("perception", "LLM unavailable — perception skipped, defaulting to LOW confidence")
        _ = agent_result("failed", {"fallback": True})

        fallback = {
            "confidence": "LOW",
            "reasoning": (
                "AI perception analysis could not be completed because the LLM service "
                "is unavailable. Score is based on completeness and trust signals only."
            ),
            "objections": [],
        }

        return {
            **state,
            "perception": fallback,
            "errors": state.get("errors", []) + [err],
        }

    perception = _parse_llm_output(llm_text)

    logger.info(
        f"[Perception] ✅ Confidence: {perception['confidence']} | "
        f"Objections: {len(perception['objections'])}"
    )
    _ = agent_result("success", perception)

    return {
        **state,
        "perception": perception,
    }
