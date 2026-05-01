"""
Scoring rules, weights, and calculation functions.

Weights are chosen based on observed importance:
  - Completeness (40%): foundational data availability
  - Trust      (30%): critical for recommendation decisions
  - Perception  (30%): captures semantic understanding

Trust scoring uses a points-based partial-credit system for policy pages:
  - "present" → full points  (content exists and is substantive)
  - "weak"    → partial pts  (page exists but content is thin)
  - "missing" → 0 pts        (HTTP non-200 or page absent)
  - "unknown" → 0 pts        (detection failed — not the store's fault, no penalty)

Boolean signals (reviews, pricing) earn their full points when True.
"""

# ---------------------------------------------------------------------------
# Completeness — per-issue penalty weights (higher = worse to be missing)
# ---------------------------------------------------------------------------
COMPLETENESS_WEIGHTS: dict[str, int] = {
    "missing_description": 3,
    "missing_images": 3,
    "missing_tags": 2,
    "short_title": 1,
    "no_variants": 1,
}

# ---------------------------------------------------------------------------
# Trust — policy partial-credit weights (present / weak / missing / unknown)
# ---------------------------------------------------------------------------
POLICY_WEIGHTS: dict[str, dict[str, int]] = {
    "return_policy":   {"present": 10, "weak": 5, "missing": 0, "unknown": 0},
    "shipping_policy": {"present": 5,  "weak": 2, "missing": 0, "unknown": 0},
    "privacy_policy":  {"present": 5,  "weak": 2, "missing": 0, "unknown": 0},
    "terms_policy":    {"present": 3,  "weak": 1, "missing": 0, "unknown": 0},
}

# Boolean trust signal weights
TRUST_SIGNAL_WEIGHTS: dict[str, int] = {
    "has_reviews":        5,
    "consistent_pricing": 3,
    "reasonable_prices":  3,
}

# Max achievable trust points → used to normalise to 0–100
# 10 + 5 + 5 + 3  (policies)  +  5 + 3 + 3  (boolean signals) = 34
TRUST_MAX_SCORE: int = (
    sum(pw["present"] for pw in POLICY_WEIGHTS.values())
    + sum(TRUST_SIGNAL_WEIGHTS.values())
)

# Legacy alias kept so imports in recommendation.py continue to work
TRUST_WEIGHTS: dict[str, int] = {
    "has_return_policy":  POLICY_WEIGHTS["return_policy"]["present"],
    "has_shipping_policy": POLICY_WEIGHTS["shipping_policy"]["present"],
    "has_reviews":         TRUST_SIGNAL_WEIGHTS["has_reviews"],
    "consistent_pricing":  TRUST_SIGNAL_WEIGHTS["consistent_pricing"],
    "reasonable_prices":   TRUST_SIGNAL_WEIGHTS["reasonable_prices"],
}

# ---------------------------------------------------------------------------
# Perception — graded confidence base scores
# ---------------------------------------------------------------------------
# Deliberately NOT 100/50/0: perception reflects AI _understanding_, not perfection.
# A HIGH-confidence LLM response starts at 90 (not 100) because there is always
# some irreducible uncertainty in AI perception.
PERCEPTION_CONFIDENCE_MAP: dict[str, float] = {
    "HIGH":   90.0,
    "MEDIUM": 65.0,
    "LOW":    45.0,
}

# Graduated objection penalties — early objections cost less than later ones.
# This reflects that the first concern from an AI buyer is significant,
# but additional objections from the same session are incremental.
OBJECTION_PENALTIES: list[float] = [8.0, 7.0, 6.0, 5.0, 4.0]  # per-position cost
MAX_OBJECTION_PENALTY: float = 30.0   # hard cap — objections alone cannot destroy score

# Minimum perception score — even badly incomplete stores have some baseline.
# 30 represents "we found the store, products exist, but quality is poor".
MIN_PERCEPTION_SCORE: float = 30.0

# ---------------------------------------------------------------------------
# Overall scoring weights
# ---------------------------------------------------------------------------
SCORE_WEIGHTS: dict[str, float] = {
    "completeness": 0.40,
    "trust": 0.30,
    "perception": 0.30,
}


# ---------------------------------------------------------------------------
# Scoring functions
# ---------------------------------------------------------------------------

def score_completeness(issues: list, total_products: int) -> float:
    """
    Calculate a completeness score in [0, 100].

    Builds the maximum possible penalty (if every product had every issue)
    and measures what fraction of that penalty was actually incurred.
    Policy issues (source="policy_check") are excluded — they don't count
    against product completeness.
    """
    if total_products == 0:
        return 0.0

    # Only count product-level issues (not store-level policy issues)
    product_issues = [i for i in issues if i.get("source") != "policy_check"]

    total_penalty = sum(
        COMPLETENESS_WEIGHTS.get(issue.get("type", ""), 1)
        for issue in product_issues
    )
    max_penalty = total_products * sum(COMPLETENESS_WEIGHTS.values())

    if max_penalty == 0:
        return 100.0

    ratio = total_penalty / max_penalty
    return round(max(0.0, min(100.0, (1 - ratio) * 100)), 1)


def score_trust(trust_signals: dict) -> float:
    """
    Calculate a trust score in [0, 100] using a points-based partial-credit system.

    For each policy key the signal dict must contain {"status": "present"|"weak"|"missing"|"unknown"}.
    Legacy boolean format is handled as a fallback (True → "present", False → "missing").
    """
    if not trust_signals:
        return 0.0

    earned = 0

    # Policy signals — dict-based with "status" field
    for policy_key, weights in POLICY_WEIGHTS.items():
        policy_data = trust_signals.get(policy_key, {})
        if isinstance(policy_data, dict):
            status = policy_data.get("status", "unknown")
        else:
            # Legacy boolean fallback
            status = "present" if policy_data else "missing"
        earned += weights.get(status, 0)

    # Boolean trust signals
    for signal, weight in TRUST_SIGNAL_WEIGHTS.items():
        if trust_signals.get(signal, False):
            earned += weight

    return round((earned / TRUST_MAX_SCORE) * 100, 1)


def score_perception(perception: dict) -> float:
    """
    Calculate a perception score in [MIN_PERCEPTION_SCORE, 100].

    Scoring approach:
      1. Start from a confidence-level base (HIGH=90, MEDIUM=65, LOW=45).
      2. Deduct graduated penalties for each objection the LLM raised.
         The first objection costs most; subsequent ones taper off.
         This avoids the "5 objections → score collapses" problem.
      3. Apply a hard floor of MIN_PERCEPTION_SCORE (30) so minor-issue
         stores never show an absurdly low AI perception score.

    Severity guidance (approximate outputs):
      Perfect store  (HIGH, 0 objections) → ~90
      Minor issues   (MEDIUM, 1-2 obj)    → ~50–65
      Moderate issues(MEDIUM, 3-4 obj)    → ~40–50
      Major issues   (LOW, 4-5 obj)       → ~30–40
    """
    confidence = perception.get("confidence", "LOW").upper()
    base = PERCEPTION_CONFIDENCE_MAP.get(confidence, PERCEPTION_CONFIDENCE_MAP["LOW"])

    objections = perception.get("objections", [])

    # Apply graduated per-objection deductions (capped at MAX_OBJECTION_PENALTY)
    total_penalty = 0.0
    for i, _ in enumerate(objections):
        # Use position-based cost; beyond the table, use the minimum cost
        cost = OBJECTION_PENALTIES[i] if i < len(OBJECTION_PENALTIES) else OBJECTION_PENALTIES[-1]
        total_penalty += cost
        if total_penalty >= MAX_OBJECTION_PENALTY:
            total_penalty = MAX_OBJECTION_PENALTY
            break

    computed = base - total_penalty
    return round(max(MIN_PERCEPTION_SCORE, min(100.0, computed)), 1)
def calculate_total_score(c_score: float, t_score: float, p_score: float) -> float:
    """
    Calculate the final weighted total score from sub-scores.
    Uses the constants defined in SCORE_WEIGHTS.
    """
    total = (
        c_score * SCORE_WEIGHTS["completeness"]
        + t_score * SCORE_WEIGHTS["trust"]
        + p_score * SCORE_WEIGHTS["perception"]
    )
    return round(total, 1)
