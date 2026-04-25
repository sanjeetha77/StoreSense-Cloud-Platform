"""
Scoring rules, weights, and calculation functions.

Weights are chosen based on observed importance:
  - Completeness (40%): foundational data availability
  - Trust      (30%): critical for recommendation decisions
  - Perception  (30%): captures semantic understanding

Trust signals are internally weighted so high-value signals
(e.g. return policy) contribute more to the trust sub-score.
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
# Trust signal weights (return policy is highest — foundational trust signal)
# ---------------------------------------------------------------------------
TRUST_WEIGHTS: dict[str, int] = {
    "has_return_policy": 5,       # Highest: buyers care most about returns
    "has_shipping_policy": 3,     # Important: shipping clarity drives conversion
    "has_reviews": 2,             # Social proof
    "consistent_pricing": 2,      # No extreme price jumps
    "reasonable_prices": 2,       # Products have priced variants
}

TRUST_MAX_SCORE: int = sum(TRUST_WEIGHTS.values())  # 14

# ---------------------------------------------------------------------------
# Perception — confidence → base score mapping
# ---------------------------------------------------------------------------
PERCEPTION_CONFIDENCE_MAP: dict[str, float] = {
    "HIGH": 100.0,
    "MEDIUM": 60.0,
    "LOW": 20.0,
}
OBJECTION_PENALTY: float = 8.0    # Points deducted per objection raised by LLM
MAX_OBJECTION_PENALTY: float = 40.0  # Cap so score never hits absolute zero from objections alone

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
    """
    if total_products == 0:
        return 0.0

    total_penalty = sum(COMPLETENESS_WEIGHTS.get(issue.get("type", ""), 1) for issue in issues)
    max_penalty = total_products * sum(COMPLETENESS_WEIGHTS.values())

    if max_penalty == 0:
        return 100.0

    ratio = total_penalty / max_penalty
    return round(max(0.0, min(100.0, (1 - ratio) * 100)), 1)


def score_trust(trust_signals: dict) -> float:
    """
    Calculate a trust score in [0, 100] using internally-weighted signals.
    """
    if not trust_signals:
        return 0.0

    earned = sum(
        weight
        for signal, weight in TRUST_WEIGHTS.items()
        if trust_signals.get(signal, False)
    )

    return round((earned / TRUST_MAX_SCORE) * 100, 1)


def score_perception(perception: dict) -> float:
    """
    Calculate a perception score in [0, 100].

    Base score comes from confidence level.
    Each objection the LLM raised deducts OBJECTION_PENALTY points.
    Total objection deduction is capped at MAX_OBJECTION_PENALTY.
    """
    confidence = perception.get("confidence", "LOW").upper()
    base = PERCEPTION_CONFIDENCE_MAP.get(confidence, PERCEPTION_CONFIDENCE_MAP["LOW"])

    objections = perception.get("objections", [])
    penalty = min(len(objections) * OBJECTION_PENALTY, MAX_OBJECTION_PENALTY)

    return round(max(0.0, min(100.0, base - penalty)), 1)
