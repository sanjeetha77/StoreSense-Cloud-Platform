"""
Response Builder — Final Aggregation Layer

Transforms raw pipeline state (StoreAnalysisState) into the fully structured,
UI-ready JSON response. This is the ONLY place where pipeline data maps to
the response schema.

Design principle:
  Backend returns fully UI-ready data. Frontend only renders — never computes.

Sections built:
  store          → store metadata
  score          → overall + status label + confidence + breakdown
  issues[]       → normalized, grouped, sorted by impact
  action_plan[]  → structured fix list, sorted by score_gain
  perception{}   → formatted AI perception with decision + gaps + llm_status
  what_if{}      → simulation with per-action gain list
  meta{}         → timing, model used, errors
"""

from datetime import datetime, timezone
from app.services.llm import MODELS   # primary model name
from app.utils.scoring_rules import (
    score_completeness,
    score_trust,
    score_perception,
    calculate_total_score,
    COMPLETENESS_WEIGHTS,
)
import copy

# ---------------------------------------------------------------------------
# Simulated buyer query (mirror of perception agent prompt)
# ---------------------------------------------------------------------------

SIMULATED_BUYER_QUERY = (
    "I'm looking to buy products from this store. Can I trust it? "
    "Are the products well-described and professionally presented? "
    "What concerns would I have as a buyer?"
)

# ---------------------------------------------------------------------------
# Issue configuration — type → UI metadata + score impact
# ---------------------------------------------------------------------------

ISSUE_CONFIG: dict[str, dict] = {
    "missing_description": {
        "title": "Missing Product Descriptions",
        "impact": "high",
        "score_impact": 12,
        "description": (
            "Products without descriptions are invisible to AI recommendation engines. "
            "Descriptions are the primary signal used to understand and match products to buyer queries."
        ),
    },
    "missing_images": {
        "title": "Missing Product Images",
        "impact": "high",
        "score_impact": 10,
        "description": (
            "Products without images score lower in AI confidence assessments. "
            "Visual content is critical for buyer trust and conversion decisions."
        ),
    },
    "missing_tags": {
        "title": "Missing Product Tags",
        "impact": "medium",
        "score_impact": 7,
        "description": (
            "Tags help AI systems categorize and surface products in relevant searches. "
            "Untagged products are harder to discover in AI-driven recommendation flows."
        ),
    },
    "short_title": {
        "title": "Short or Generic Product Titles",
        "impact": "medium",
        "score_impact": 5,
        "description": (
            "Titles that are too short reduce AI discoverability. "
            "Use the format: [Brand] [Product Type] [Key Feature] for best results."
        ),
    },
    "no_variants": {
        "title": "Missing Pricing or Variants",
        "impact": "medium",
        "score_impact": 5,
        "description": (
            "Products without variants or pricing cannot be properly evaluated "
            "by AI shopping recommendation systems."
        ),
    },
    # ---- Policy issues (store-level, injected by trust agent) ----
    "missing_return_policy": {
        "title": "Missing Return & Refund Policy",
        "impact": "high",
        "score_impact": 20,
        "description": (
            "Stores without a return policy are rated LOW trust by AI recommendation agents. "
            "Create a clear refund policy page in Shopify Settings → Policies."
        ),
    },
    "weak_return_policy": {
        "title": "Improve Return Policy Clarity",
        "impact": "medium",
        "score_impact": 10,
        "description": (
            "Your return policy page exists but lacks sufficient detail. "
            "Expand it with clear terms — timelines, eligibility, and process steps."
        ),
    },
    "missing_shipping_policy": {
        "title": "Missing Shipping Policy",
        "impact": "medium",
        "score_impact": 10,
        "description": (
            "Buyers expect shipping timelines upfront. Missing shipping information "
            "is a top objection raised by AI shopping assistants and reduces trust scores."
        ),
    },
    "weak_shipping_policy": {
        "title": "Improve Shipping Policy Detail",
        "impact": "medium",
        "score_impact": 5,
        "description": (
            "Your shipping policy page exists but is thin on detail. "
            "Add estimated delivery times, carrier info, and international shipping terms."
        ),
    },
    "missing_privacy_policy": {
        "title": "Missing Privacy Policy",
        "impact": "medium",
        "score_impact": 10,
        "description": (
            "A privacy policy is legally required in many regions and signals professionalism. "
            "AI agents use its presence as a trust indicator during store evaluation."
        ),
    },
    "weak_privacy_policy": {
        "title": "Improve Privacy Policy Coverage",
        "impact": "medium",
        "score_impact": 5,
        "description": (
            "Your privacy policy exists but is too brief. Expand it to cover data collection, "
            "usage, cookies, third-party sharing, and user rights (GDPR/CCPA)."
        ),
    },
    "missing_terms_policy": {
        "title": "Missing Terms of Service",
        "impact": "low",
        "score_impact": 5,
        "description": (
            "Terms of service build buyer confidence and are referenced by AI agents "
            "when assessing store credibility. Add them in Shopify Settings → Policies."
        ),
    },
    "weak_terms_policy": {
        "title": "Improve Terms of Service Detail",
        "impact": "low",
        "score_impact": 3,
        "description": (
            "Your Terms of Service page exists but lacks sufficient coverage. "
            "Expand it to include liability, usage rules, and dispute resolution."
        ),
    },
}

# ---------------------------------------------------------------------------
# Action effort heuristics and guide links
# ---------------------------------------------------------------------------

EFFORT_MAP: dict[str, str] = {
    # Product-level
    "missing_description":  "medium",
    "missing_images":       "medium",
    "missing_tags":         "low",
    "short_title":          "low",
    "no_variants":          "high",
    # Legacy trust action keys
    "add_return_policy":    "low",
    "add_shipping_policy":  "low",
    "add_reviews":          "medium",
    # Policy issue keys
    "missing_return_policy":   "medium",
    "weak_return_policy":      "low",
    "missing_shipping_policy": "low",
    "weak_shipping_policy":    "low",
    "missing_privacy_policy":  "low",
    "weak_privacy_policy":     "low",
    "missing_terms_policy":    "low",
    "weak_terms_policy":       "low",
}

GUIDE_LINKS: dict[str, str] = {
    # Product-level
    "missing_description":  "https://help.shopify.com/en/manual/products/add-update-products",
    "missing_images":       "https://help.shopify.com/en/manual/products/product-media",
    "missing_tags":         "https://help.shopify.com/en/manual/products/organize-your-products-with-tags",
    "short_title":          "https://help.shopify.com/en/manual/products/add-update-products",
    "no_variants":          "https://help.shopify.com/en/manual/products/variants",
    # Legacy trust action keys
    "add_return_policy":    "https://help.shopify.com/en/manual/checkout-settings/refund-privacy-tos",
    "add_shipping_policy":  "https://help.shopify.com/en/manual/shipping/setting-up-and-managing-your-shipping",
    "add_reviews":          "https://apps.shopify.com/product-reviews",
    # Policy issue keys
    "missing_return_policy":   "https://help.shopify.com/en/manual/checkout-settings/refund-privacy-tos",
    "weak_return_policy":      "https://help.shopify.com/en/manual/checkout-settings/refund-privacy-tos",
    "missing_shipping_policy": "https://help.shopify.com/en/manual/shipping/setting-up-and-managing-your-shipping",
    "weak_shipping_policy":    "https://help.shopify.com/en/manual/shipping/setting-up-and-managing-your-shipping",
    "missing_privacy_policy":  "https://help.shopify.com/en/manual/checkout-settings/refund-privacy-tos",
    "weak_privacy_policy":     "https://help.shopify.com/en/manual/checkout-settings/refund-privacy-tos",
    "missing_terms_policy":    "https://help.shopify.com/en/manual/checkout-settings/refund-privacy-tos",
    "weak_terms_policy":       "https://help.shopify.com/en/manual/checkout-settings/refund-privacy-tos",
}

# ---------------------------------------------------------------------------
# Score status label
# ---------------------------------------------------------------------------

def _score_status(score: float) -> str:
    if score >= 80:
        return "Excellent"
    if score >= 55:
        return "Good"
    return "Needs Improvement"


# ---------------------------------------------------------------------------
# Simulation Engine — calculate REAL score gain
# ---------------------------------------------------------------------------

def _simulate_score_delta(state: dict, action_id: str) -> float:
    """
    Deterministically calculate the score gain for an action by re-running
    the scoring logic on a modified copy of the state.
    """
    # 1. Current state components
    products = state.get("products", [])
    total_products = len(products)
    issues = state.get("issues", [])
    trust_signals = state.get("trust_signals", {})
    perception = state.get("perception", {})

    # 2. Calculate baseline score
    c_base = score_completeness(issues, total_products)
    t_base = score_trust(trust_signals)
    p_base = score_perception(perception)
    base_total = calculate_total_score(c_base, t_base, p_base)

    # 3. Simulate fix on a clone
    sim_issues = copy.deepcopy(issues)
    sim_trust = copy.deepcopy(trust_signals)
    sim_perception = copy.deepcopy(perception)

    # --- Completeness Fixes ---
    # Action ID matches issue type
    if action_id in COMPLETENESS_WEIGHTS:
        sim_issues = [i for i in sim_issues if i.get("type") != action_id]
    
    # --- Trust Fixes ---
    # Policy issues
    if action_id == "missing_return_policy" or action_id == "weak_return_policy":
        sim_trust["return_policy"] = {"status": "present", "source": "simulated"}
        # Also remove corresponding issues
        sim_issues = [i for i in sim_issues if i.get("type") not in ["missing_return_policy", "weak_return_policy"]]
    elif action_id == "missing_shipping_policy" or action_id == "weak_shipping_policy":
        sim_trust["shipping_policy"] = {"status": "present", "source": "simulated"}
        sim_issues = [i for i in sim_issues if i.get("type") not in ["missing_shipping_policy", "weak_shipping_policy"]]
    elif action_id == "missing_privacy_policy" or action_id == "weak_privacy_policy":
        sim_trust["privacy_policy"] = {"status": "present", "source": "simulated"}
        sim_issues = [i for i in sim_issues if i.get("type") not in ["missing_privacy_policy", "weak_privacy_policy"]]
    elif action_id == "missing_terms_policy" or action_id == "weak_terms_policy":
        sim_trust["terms_policy"] = {"status": "present", "source": "simulated"}
        sim_issues = [i for i in sim_issues if i.get("type") not in ["missing_terms_policy", "weak_terms_policy"]]
    
    # Boolean trust signals
    elif action_id == "add_reviews":
        sim_trust["has_reviews"] = True

    # --- Perception Fixes ---
    # (Optional: if we ever add specific perception fix actions)
    
    # 4. Re-calculate score
    c_new = score_completeness(sim_issues, total_products)
    t_new = score_trust(sim_trust)
    p_new = score_perception(sim_perception)
    new_total = calculate_total_score(c_new, t_new, p_new)

    # Delta is always positive (or 0)
    delta = round(max(0.0, new_total - base_total), 1)
    return delta


# ---------------------------------------------------------------------------
# Overall analysis confidence (how reliable is the result)
# ---------------------------------------------------------------------------

def _calc_confidence(state: dict, fallback_used: bool) -> float:
    """
    Confidence represents how reliable this analysis is (0–100).

    Rules:
      - No products fetched          → 20  (critical data missing)
      - LLM fallback was used        → 65  (MEDIUM — partial AI output)
      - Full data + LLM success      → 85+ (HIGH)
      - Deductions for missing trust signals (each reduces certainty)
    """
    if not state.get("products"):
        return 20.0

    base = 65.0 if fallback_used else 85.0

    trust = state.get("trust_signals", {})
    if trust.get("return_policy", {}).get("status") not in ("present", "weak"):
        base -= 5
    if trust.get("shipping_policy", {}).get("status") not in ("present", "weak"):
        base -= 5
    if not trust.get("has_reviews"):
        base -= 3

    return round(max(20.0, min(100.0, base)), 1)


# ---------------------------------------------------------------------------
# Issues — group and normalize
# ---------------------------------------------------------------------------

def _build_issues(state: dict) -> list[dict]:
    """
    Convert raw flat issue list into structured, grouped, sorted issue objects.

    Output per issue:
      id            snake_case type identifier
      title         UI-friendly label
      impact        high | medium | low
      score_impact  numeric penalty contribution
      description   explanation of why this matters
      affected_items list of {product_id, title} dicts
      affected_count how many products are affected
      status        always "open" (no resolution tracking yet)
    """
    raw_issues = state.get("issues", [])

    # Group by type
    grouped: dict[str, list] = {}
    for issue in raw_issues:
        itype = issue.get("type", "unknown")
        grouped.setdefault(itype, []).append(issue)

    # Sort by score_impact descending
    sorted_types = sorted(
        grouped.keys(),
        key=lambda t: ISSUE_CONFIG.get(t, {}).get("score_impact", 0),
        reverse=True,
    )

    result = []
    for itype in sorted_types:
        items = grouped[itype]
        config = ISSUE_CONFIG.get(itype, {
            "title": itype.replace("_", " ").title(),
            "impact": "medium",
            "score_impact": 3,
            "description": f"Issue detected: {itype.replace('_', ' ')}.",
        })

        # REAL impact calculation
        real_impact = _simulate_score_delta(state, itype)

        result.append({
            "id": itype,
            "title": config["title"],
            "impact": config["impact"],
            "score_impact": real_impact,
            "description": config["description"],
            "affected_items": [
                {"product_id": i.get("product_id"), "title": i.get("product_title", "")}
                for i in items
            ],
            "affected_count": len(items),
            "status": "open",
        })

    return result


# ---------------------------------------------------------------------------
# Action plan — structured and prioritized
# ---------------------------------------------------------------------------

def _build_action_plan(state: dict, issues_structured: list[dict]) -> list[dict]:
    """
    Generate a structured, prioritized action plan from:
      - Detected issues (product-level completeness + store-level policy issues)
      - Missing trust signals not already covered by policy issues (reviews)

    Policy fixes come through issues_structured (injected by trust agent).
    Sorted by score_gain descending. Priority number assigned after sorting.
    """
    actions: list[dict] = []
    seen: set = set()

    # Track which policy issue types are already in issues
    issue_ids_in_plan = {issue["id"] for issue in issues_structured}

    # Actions from all detected issues (product-level + policy-level)
    for issue in issues_structured:
        itype = issue["id"]
        if itype in seen:
            continue
        seen.add(itype)

        # REAL gain calculation
        gain = _simulate_score_delta(state, itype)
        if gain <= 0.1: # Skip if negligible
            continue

        actions.append({
            "_type":      itype,
            "title":      f"Fix: {issue['title']}",
            "description": issue.get("description", ""),
            "score_gain": gain,
            "effort":     EFFORT_MAP.get(itype, "medium"),
            "guide_link": GUIDE_LINKS.get(itype, "https://help.shopify.com"),
        })

    # Reviews action — not covered by any issue type
    trust = state.get("trust_signals", {})
    if not trust.get("has_reviews") and "add_reviews" not in seen:
        gain = _simulate_score_delta(state, "add_reviews")
        if gain > 0.1:
            actions.append({
                "_type":      "add_reviews",
                "title":      "Enable Product Reviews",
                "description": "Social proof is a top trust signal for AI agents. Install a reviews app and collect reviews from existing customers.",
                "score_gain": gain,
                "effort":     EFFORT_MAP["add_reviews"],
                "guide_link": GUIDE_LINKS["add_reviews"],
            })

    # Sort by score_gain, assign priority, strip internal _type key
    actions.sort(key=lambda x: -x["score_gain"])
    for i, action in enumerate(actions, 1):
        action["priority"] = i
        action["id"] = action.pop("_type", None)

    return actions


# ---------------------------------------------------------------------------
# Perception — structured with decision + llm_status
# ---------------------------------------------------------------------------

def _build_perception(state: dict, fallback_used: bool) -> dict:
    """
    Format raw perception agent output into the structured perception block.

    Adds:
      decision   → "Recommended" | "Not Recommended"  (derived from confidence)
      query      → the simulated buyer query used
      ai_response→ full LLM text (or fallback message)
      gaps       → renamed from objections
      llm_status → "active" | "fallback"
    """
    raw = state.get("perception", {})
    confidence = raw.get("confidence", "LOW").upper()
    if confidence not in ("HIGH", "MEDIUM", "LOW"):
        confidence = "LOW"

    reasoning = raw.get("reasoning", "")
    objections = raw.get("objections", [])

    return {
        "confidence": confidence,
        "confidence_reason": raw.get("confidence_reason", ""),
        "decision": "Recommended" if confidence == "HIGH" else "Not Recommended",
        "query": SIMULATED_BUYER_QUERY,
        "ai_response": reasoning,
        "reasoning": reasoning,
        "gaps": objections,
        "llm_status": "fallback" if fallback_used else "active",
    }


# ---------------------------------------------------------------------------
# What-if simulation — per-action gain breakdown
# ---------------------------------------------------------------------------

def _build_what_if(state: dict) -> dict:
    """
    Build a what-if simulation with individual action gain items.

    Uses the existing what_if data from the recommendation agent for totals,
    then builds the per-action breakdown from issue + trust signal data.
    Policy gains are derived from issue_types so there are no duplicates.
    """
    existing = state.get("what_if", {})
    current   = round(existing.get("current_score",  state.get("score", {}).get("total", 0)), 1)
    potential = round(existing.get("potential_score", current), 1)
    improvement = round(existing.get("improvement", 0), 1)

    trust = state.get("trust_signals", {})
    issues = state.get("issues", [])
    issue_types = {i.get("type") for i in issues}
    issue_counts: dict[str, int] = {}
    for i in issues:
        issue_counts[i["type"]] = issue_counts.get(i["type"], 0) + 1

    # Build per-action gain list (top 8, sorted by gain)
    actions_potential: list[dict] = []

    # Product-level issues
    for itype in ["missing_description", "missing_images", "missing_tags", "short_title", "no_variants"]:
        if itype in issue_types:
            n = issue_counts[itype]
            gain = _simulate_score_delta(state, itype)
            label = ""
            if itype == "missing_description": label = f"Add descriptions to {n} product(s)"
            elif itype == "missing_images": label = f"Upload images for {n} product(s)"
            elif itype == "missing_tags": label = f"Tag {n} untagged product(s)"
            elif itype == "short_title": label = f"Improve titles for {n} product(s)"
            elif itype == "no_variants": label = f"Add variants/pricing to {n} product(s)"
            
            if gain > 0:
                actions_potential.append({"label": label, "gain": gain})

    # Policy issues
    for itype in ["missing_return_policy", "weak_return_policy", "missing_shipping_policy", "weak_shipping_policy", 
                 "missing_privacy_policy", "weak_privacy_policy", "missing_terms_policy", "weak_terms_policy"]:
        if itype in issue_types:
            gain = _simulate_score_delta(state, itype)
            label = ISSUE_CONFIG.get(itype, {}).get("title", itype)
            if "Fix:" not in label and "Improve" not in label and "Add" not in label:
                 label = f"Fix: {label}"
            if gain > 0:
                actions_potential.append({"label": label, "gain": gain})

    if not trust.get("has_reviews"):
        gain = _simulate_score_delta(state, "add_reviews")
        if gain > 0:
            actions_potential.append({"label": "Enable Product Reviews", "gain": gain})

    actions_potential.sort(key=lambda x: -x["gain"])

    return {
        "current_score":   current,
        "potential_score": potential,
        "improvement":     improvement,
        "actions":         actions_potential[:8],
    }


# ---------------------------------------------------------------------------
# Main builder — called by the route after pipeline completes
# ---------------------------------------------------------------------------

def build_response(
    state: dict,
    start_time: datetime,
    fallback_used: bool,
    llm_model_used: str,
) -> dict:
    """
    Build the complete, UI-ready API response from the final pipeline state.

    Args:
        state:          Final StoreAnalysisState after pipeline execution
        start_time:     Request start time (UTC) for analysis_time calculation
        fallback_used:  True if any LLM stage fell back to rule-based output
        llm_model_used: Name of the LLM model that ran (or "rule-based")
    """
    errors = state.get("errors", [])
    products = state.get("products", [])
    score_data = state.get("score", {})
    breakdown = score_data.get("breakdown", {})

    # --- Overall status ---
    has_ingestion_error = any(e.get("agent") == "ingestion" for e in errors)
    if has_ingestion_error and not products:
        status = "failed"
    elif errors:
        status = "partial_success"
    else:
        status = "success"

    # --- Score section ---
    overall = round(score_data.get("total", 0.0), 1)
    confidence = _calc_confidence(state, fallback_used)

    # --- Build structured sections ---
    issues_structured = _build_issues(state)
    action_plan = _build_action_plan(state, issues_structured)
    perception = _build_perception(state, fallback_used)
    what_if = _build_what_if(state)

    # --- Meta ---
    elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()

    return {
        "status": status,

        "store": {
            "url": state.get("store_url", ""),
        },

        "score": {
            "overall": overall,
            "status": _score_status(overall),
            "confidence": confidence,
            "breakdown": {
                "completeness": breakdown.get("completeness", 0),
                "trust": breakdown.get("trust", 0),
                "perception": breakdown.get("perception", 0),
            },
        },

        "issues": issues_structured,

        "deep_analysis": state.get("deep_analysis_products", []),

        "trust_signals": state.get("trust_signals", {}),

        "action_plan": action_plan,

        "perception": perception,

        "what_if": what_if,

        "products": products,

        "meta": {
            "analysis_time": f"{elapsed:.2f}s",
            "llm_used": llm_model_used,
            "fallback_used": fallback_used,
            "products_analyzed": len(products),
            "errors": [
                f"[{e.get('agent', '?')}] {e.get('message', '')}"
                for e in errors
            ],
        },
    }
