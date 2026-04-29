"""
Stage 3 — Trust Signal Evaluator Agent.

Policy Detection Strategy (hybrid):
  PRIMARY:  Shopify Admin API via /admin/api/{version}/policies.json
            — Works on password-protected stores, no scraping needed.
  FALLBACK: Async HTTP scraper (_check_policy) used only when API fails
            (wrong token, wrong store URL, network error, etc.)

Policy classification:
  content_length == 0              → "missing"
  0 < content_length < threshold   → "weak"
  content_length >= threshold      → "present"
  detection error                  → "unknown"  (no penalty)
"""

import asyncio
import logging
import httpx

from app.pipeline.state import StoreAnalysisState
from app.utils.error_handler import agent_result
from app.services.shopify_api import fetch_policies, classify_policy

logger = logging.getLogger(__name__)

# Minimum character count (raw HTML from API or scraped text) to be "present"
MIN_POLICY_THRESHOLD: int = 300

# ---------------------------------------------------------------------------
# Policy metadata: URL paths and issue definitions
# ---------------------------------------------------------------------------

POLICY_DEFINITIONS: dict[str, dict] = {
    "return_policy": {
        "path": "/policies/refund-policy",
        "issues": {
            "missing": {"id": "missing_return_policy", "impact": "high", "score_impact": 20},
            "weak":    {"id": "weak_return_policy",    "impact": "medium", "score_impact": 10},
        },
    },
    "shipping_policy": {
        "path": "/policies/shipping-policy",
        "issues": {
            "missing": {"id": "missing_shipping_policy", "impact": "medium", "score_impact": 10},
            "weak":    {"id": "weak_shipping_policy",    "impact": "medium", "score_impact": 5},
        },
    },
    "privacy_policy": {
        "path": "/policies/privacy-policy",
        "issues": {
            "missing": {"id": "missing_privacy_policy", "impact": "medium", "score_impact": 10},
            "weak":    {"id": "weak_privacy_policy",    "impact": "medium", "score_impact": 5},
        },
    },
    "terms_policy": {
        "path": "/policies/terms-of-service",
        "issues": {
            "missing": {"id": "missing_terms_policy", "impact": "low", "score_impact": 5},
            "weak":    {"id": "weak_terms_policy",    "impact": "low",  "score_impact": 3},
        },
    },
}


# ---------------------------------------------------------------------------
# Scraper fallback — used only when Admin API is unavailable
# ---------------------------------------------------------------------------

async def _check_policy(name: str, path: str, base_url: str) -> dict:
    """
    Fallback: scrape a single policy URL via HTTP.
    Handles password-protected stores via redirect and content detection.

    Returns: { status, url, content_length }
    """
    url = f"{base_url}{path}"
    result = {"status": "unknown", "url": url, "content_length": 0}

    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(url)

        final_url = str(resp.url)
        text = resp.text.lower()
        content_len = len(text)
        result["content_length"] = content_len

        logger.info(
            f"[Trust/Scraper] {url} → final={final_url} "
            f"| status={resp.status_code} | len={content_len}"
        )

        # 1. Detect redirect to password page
        if "/password" in final_url:
            result["status"] = "unknown"
            return result

        # 2. Detect password page content
        password_signals = [
            "store is password protected",
            "enter using password",
            "opening soon",
        ]
        if sum(1 for s in password_signals if s in text) >= 1:
            result["status"] = "unknown"
            return result

        # 3. HTTP error → missing
        if resp.status_code != 200:
            result["status"] = "missing"
            return result

        # 4. Classify by content length
        if content_len >= 500:
            result["status"] = "present"
        elif content_len >= MIN_POLICY_THRESHOLD:
            result["status"] = "weak"
        else:
            result["status"] = "missing"

    except Exception as exc:
        logger.warning(f"[Trust/Scraper] Policy check failed for {url}: {exc}")

    return result


# ---------------------------------------------------------------------------
# Policy detection: Admin API primary, scraper fallback
# ---------------------------------------------------------------------------

async def _detect_policies(store_url: str) -> tuple[dict, str]:
    """
    Detect all four policy statuses using the hybrid strategy.

    Returns:
        (policy_results, source)
        policy_results: { key: {status, url, content_length} }
        source: "admin_api" | "scraper"
    """
    # Default: all unknown
    policy_results: dict[str, dict] = {
        key: {"status": "unknown", "url": "", "content_length": 0}
        for key in POLICY_DEFINITIONS
    }

    # --- Primary: Shopify Admin API ---
    try:
        api_data = await fetch_policies(store_url)

        for policy_key in POLICY_DEFINITIONS:
            content = api_data.get(policy_key, "")
            classified = classify_policy(content, threshold=MIN_POLICY_THRESHOLD)
            policy_results[policy_key] = {
                "status":         classified["status"],
                "url":            f"https://{store_url}{POLICY_DEFINITIONS[policy_key]['path']}",
                "content_length": classified["content_length"],
                "source":         "admin_api",
            }

        logger.info(
            "[Trust] Admin API detection complete — "
            + ", ".join(f"{k}={v['status']}" for k, v in policy_results.items())
        )
        return policy_results, "admin_api"

    except Exception as api_exc:
        logger.warning(
            f"[Trust] Admin API failed ({api_exc}), falling back to scraper"
        )

    # --- Fallback: HTTP scraper ---
    base_url = f"https://{store_url}"
    tasks = {
        key: _check_policy(key, defn["path"], base_url)
        for key, defn in POLICY_DEFINITIONS.items()
    }
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)

    for key, result in zip(tasks.keys(), results):
        if not isinstance(result, Exception):
            policy_results[key] = result

    logger.info(
        "[Trust] Scraper fallback complete — "
        + ", ".join(f"{k}={v['status']}" for k, v in policy_results.items())
    )
    return policy_results, "scraper"


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

async def trust_agent(state: StoreAnalysisState) -> StoreAnalysisState:
    """
    Stage 3: Trust Signal Evaluator

    Evaluates store trust signals from product data and policy detection.
    Policy detection uses Shopify Admin API first, scraper as fallback.
    Appends policy-level issues to state["issues"].
    """
    products = state.get("products", [])
    logger.info(f"[Trust] Evaluating trust signals for {len(products)} products")

    # --- Vendor consistency ---
    vendors = {p.get("vendor", "").strip() for p in products if p.get("vendor", "").strip()}
    has_consistent_vendor = 0 < len(vendors) <= 3

    # --- Pricing signals ---
    prices = []
    for p in products:
        for v in p.get("variants", []):
            try:
                price = float(v.get("price", 0))
                if price > 0:
                    prices.append(price)
            except (ValueError, TypeError):
                pass

    has_reasonable_prices = len(prices) > 0
    consistent_pricing = (
        len(prices) >= 2 and (max(prices) / (min(prices) + 0.01)) < 100
    ) if prices else False

    # --- Image coverage ---
    image_ratio = round(
        len([p for p in products if p.get("images")]) / len(products), 2
    ) if products else 0.0

    # --- Product type categorization ---
    typed_products = [p for p in products if p.get("product_type", "").strip()]
    has_product_types = len(typed_products) / len(products) > 0.5 if products else False

    # --- Policy detection (Admin API → scraper fallback) ---
    store_url = state.get("store_url", "").strip("/").replace("https://", "").replace("http://", "")

    policy_results: dict[str, dict] = {
        key: {"status": "unknown", "url": "", "content_length": 0}
        for key in POLICY_DEFINITIONS
    }
    detection_source = "none"

    if store_url:
        policy_results, detection_source = await _detect_policies(store_url)

    logger.info(f"[Trust] Policy detection source: {detection_source}")

    # --- Generate policy issues ---
    policy_issues: list[dict] = []
    for policy_key, defn in POLICY_DEFINITIONS.items():
        status = policy_results[policy_key]["status"]
        if status in ("missing", "weak"):
            issue_def = defn["issues"][status]
            policy_issues.append({
                "type":          issue_def["id"],
                "product_id":    None,
                "product_title": None,
                "detail":        (
                    f"{policy_key} is {status} "
                    f"(detected via {detection_source}, "
                    f"content_length={policy_results[policy_key]['content_length']})"
                ),
                "impact":       issue_def["impact"],
                "score_impact": issue_def["score_impact"],
                "source":       "policy_check",
            })
            logger.info(f"[Trust] Issue: {issue_def['id']} ({status})")

    existing_issues = state.get("issues", [])

    trust_signals = {
        # Policy signals — dict with status / url / content_length / source
        "return_policy":   policy_results["return_policy"],
        "shipping_policy": policy_results["shipping_policy"],
        "privacy_policy":  policy_results["privacy_policy"],
        "terms_policy":    policy_results["terms_policy"],

        # Boolean trust signals
        "has_reviews":        False,
        "consistent_pricing": consistent_pricing,
        "reasonable_prices":  has_reasonable_prices,

        # Informational (not directly scored)
        "has_consistent_vendor":   has_consistent_vendor,
        "has_product_types":       has_product_types,
        "image_coverage_ratio":    image_ratio,
        "total_products_analyzed": len(products),
        "vendors_found":           sorted(vendors)[:5],
        "policy_detection_source": detection_source,
    }

    logger.info(
        f"[Trust] ✅ Complete — "
        f"source={detection_source}, "
        f"policy_issues={len(policy_issues)}"
    )
    _ = agent_result("success", trust_signals)

    return {
        "trust_signals": trust_signals,
        "issues": existing_issues + policy_issues,
    }
