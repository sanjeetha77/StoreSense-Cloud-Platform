"""
Stage 3 — Trust Signal Evaluator Agent.

Responsibilities:
  - Evaluate store-level trust indicators from product data
  - Populate state["trust_signals"]

Note on policies:
  Return policy and shipping policy truth values require the Shopify
  /policies REST endpoint, which needs extra scopes. We set them to False
  by default; the frontend/README documents how to extend this.

Signal weights (from scoring_rules.py):
  has_return_policy   → 5  (highest — most critical for buyer trust)
  has_shipping_policy → 3
  has_reviews         → 2
  consistent_pricing  → 2
  reasonable_prices   → 2
"""

import logging
from app.pipeline.state import StoreAnalysisState
from app.utils.error_handler import agent_result

logger = logging.getLogger(__name__)


async def trust_agent(state: StoreAnalysisState) -> StoreAnalysisState:
    """
    Stage 3: Trust Signal Evaluator

    Derives trust indicators from the normalized product list.
    Signals flagged False here will deduct from the trust sub-score.
    """
    products = state.get("products", [])
    logger.info(f"[Trust] Evaluating trust signals for {len(products)} products")

    # --- Vendor consistency ---
    vendors = {p.get("vendor", "").strip() for p in products if p.get("vendor", "").strip()}
    # ≤3 distinct vendors = consistent brand identity
    has_consistent_vendor = 0 < len(vendors) <= 3

    # --- Pricing signals ---
    prices: list[float] = []
    for p in products:
        for v in p.get("variants", []):
            try:
                price = float(v.get("price", 0))
                if price > 0:
                    prices.append(price)
            except (ValueError, TypeError):
                pass

    has_reasonable_prices = len(prices) > 0
    # Flag inconsistent pricing: max is >100× the min (e.g., $1 and $500 in same store)
    consistent_pricing = (
        len(prices) >= 2
        and (max(prices) / (min(prices) + 0.01)) < 100
    ) if prices else False

    # --- Image coverage ---
    products_with_images = [p for p in products if p.get("images")]
    image_ratio = round(len(products_with_images) / len(products), 2) if products else 0.0

    # --- Product type categorization ---
    typed_products = [p for p in products if p.get("product_type", "").strip()]
    has_product_types = (
        len(typed_products) / len(products) > 0.5
        if products else False
    )

    # --- Policy signals (require /policies endpoint — False until extended) ---
    # To enable: fetch GET /admin/api/{version}/policies.json and check for
    # refund_policy and shipping_policy non-empty bodies.
    has_return_policy = False    # Extend: call /policies endpoint
    has_shipping_policy = False  # Extend: call /policies endpoint
    has_reviews = False          # Extend: call Reviews API or app integration

    trust_signals = {
        # Weighted signals (used directly in score_trust())
        "has_return_policy": has_return_policy,
        "has_shipping_policy": has_shipping_policy,
        "has_reviews": has_reviews,
        "consistent_pricing": consistent_pricing,
        "reasonable_prices": has_reasonable_prices,

        # Informational signals (not directly weighted but shown in dashboard)
        "has_consistent_vendor": has_consistent_vendor,
        "has_product_types": has_product_types,
        "image_coverage_ratio": image_ratio,
        "total_products_analyzed": len(products),
        "vendors_found": sorted(vendors)[:5],
    }

    logger.info(f"[Trust] ✅ Trust signals evaluated — consistent_vendor={has_consistent_vendor}, pricing_ok={consistent_pricing}")
    _ = agent_result("success", trust_signals)

    return {
        **state,
        "trust_signals": trust_signals,
    }
