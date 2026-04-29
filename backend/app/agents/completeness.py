"""
Stage 2 — Completeness Analyzer Agent.

Responsibilities:
  - Inspect each product for data quality issues
  - Populate state["issues"] with structured issue objects

Issue types:
  - missing_description  (weight 3)
  - missing_images       (weight 3)
  - missing_tags         (weight 2)
  - short_title          (weight 1)
  - no_variants          (weight 1)
"""

import logging
from app.pipeline.state import StoreAnalysisState
from app.utils.error_handler import agent_result

logger = logging.getLogger(__name__)

MIN_DESCRIPTION_LENGTH = 50   # Characters of plain text required
MIN_TITLE_LENGTH = 10          # Very short titles are usually generic/placeholder


def _check_product(product: dict) -> list:
    """
    Run all completeness checks against a single product.
    Returns a list of issue dicts for that product.
    """
    issues = []
    pid = product.get("id")
    title = product.get("title", "").strip()
    desc = product.get("body_html", "").strip()

    # Strip basic HTML tags for length check
    import re
    plain_desc = re.sub(r"<[^>]+>", "", desc).strip()

    if not plain_desc or len(plain_desc) < MIN_DESCRIPTION_LENGTH:
        issues.append({
            "type": "missing_description",
            "product_id": pid,
            "product_title": title,
            "detail": f"Description is {'missing' if not plain_desc else f'too short ({len(plain_desc)} chars, min {MIN_DESCRIPTION_LENGTH})'}",
        })

    if not product.get("images"):
        issues.append({
            "type": "missing_images",
            "product_id": pid,
            "product_title": title,
            "detail": "No product images found",
        })

    if not product.get("tags"):
        issues.append({
            "type": "missing_tags",
            "product_id": pid,
            "product_title": title,
            "detail": "No tags assigned — hurts AI discoverability",
        })

    if len(title) < MIN_TITLE_LENGTH:
        issues.append({
            "type": "short_title",
            "product_id": pid,
            "product_title": title,
            "detail": f"Title '{title}' is too short ({len(title)} chars, min {MIN_TITLE_LENGTH})",
        })

    if not product.get("variants"):
        issues.append({
            "type": "no_variants",
            "product_id": pid,
            "product_title": title,
            "detail": "No variants or pricing found",
        })

    return issues


from app.utils.deep_analysis import get_products_for_deep_analysis

async def completeness_agent(state: StoreAnalysisState) -> dict:
    """
    Stage 2: Completeness Analyzer

    Checks every product for missing or thin data fields.
    Populates state["issues"] with a flat list of issue objects.
    Also computes products needing deep analysis.
    """
    products = state.get("products", [])
    logger.info(f"[Completeness] Analyzing {len(products)} products")

    all_issues: list = []
    for product in products:
        all_issues.extend(_check_product(product))

    deep_analysis_products = get_products_for_deep_analysis(products)

    logger.info(f"[Completeness] ✅ Found {len(all_issues)} issues across {len(products)} products")
    _ = agent_result("success", {"issue_count": len(all_issues)})

    return {
        "issues": all_issues,
        "deep_analysis_products": deep_analysis_products,
    }
