"""
Stage 1 — Data Ingestion Agent.

Responsibilities:
  - Fetch raw products from Shopify REST API
  - Normalize into a clean structure
  - Populate state["products"]

Failure mode:
  - On ShopifyFetchError → add to errors, set products=[], allow pipeline to short-circuit
"""

import logging
from app.services.shopify import fetch_products, normalize_product, ShopifyFetchError
from app.utils.error_handler import make_error, agent_result
from app.pipeline.state import StoreAnalysisState

logger = logging.getLogger(__name__)


async def ingest_agent(state: StoreAnalysisState) -> StoreAnalysisState:
    """
    Stage 1: Data Ingestion

    Fetches and normalizes Shopify products.
    Returns updated state with products list populated.
    On failure, returns state with empty products and an error entry.
    """
    logger.info(f"[Ingestion] Fetching products for: {state['store_url']}")

    try:
        raw_products = await fetch_products(state["store_url"])
        normalized = [normalize_product(p) for p in raw_products]

        logger.info(f"[Ingestion] ✅ Fetched {len(normalized)} products")
        _ = agent_result("success", {"product_count": len(normalized)})

        return {
            "products": normalized,
            "status": "success",
        }

    except ShopifyFetchError as exc:
        logger.error(f"[Ingestion] ❌ Failed: {exc}")
        err = make_error("ingestion", str(exc))
        _ = agent_result("failed", {"message": str(exc)})

        return {
            "products": [],
            "errors": state.get("errors", []) + [err],
            "status": "partial_success",
        }
