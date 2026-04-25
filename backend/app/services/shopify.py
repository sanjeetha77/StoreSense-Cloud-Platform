"""
Shopify API service.

Handles all communication with Shopify's REST API.
Only fetches data — no side effects or writes.
"""

import httpx
from app.config.settings import SHOPIFY_ACCESS_TOKEN, SHOPIFY_API_VERSION


class ShopifyFetchError(Exception):
    """Raised when Shopify data cannot be retrieved for any reason."""
    pass


async def fetch_products(store_url: str) -> list:
    """
    Fetch the first 50 products from a Shopify store via REST API.

    Args:
        store_url: e.g. "example.myshopify.com" (with or without https://)

    Returns:
        List of raw product dicts from Shopify.

    Raises:
        ShopifyFetchError: on auth failure, timeout, store-not-found, or HTTP error.
    """
    # Normalize URL
    store_url = (
        store_url
        .strip()
        .strip("/")
        .replace("https://", "")
        .replace("http://", "")
    )

    url = (
        f"https://{store_url}/admin/api/{SHOPIFY_API_VERSION}"
        f"/products.json?limit=50&status=active"
    )

    headers = {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(url, headers=headers)

            if resp.status_code == 401:
                raise ShopifyFetchError(
                    "Unauthorized: Check your SHOPIFY_ACCESS_TOKEN in .env"
                )
            if resp.status_code == 404:
                raise ShopifyFetchError(
                    f"Store not found: '{store_url}'. Verify the URL is correct."
                )
            if resp.status_code == 429:
                raise ShopifyFetchError(
                    "Rate limited by Shopify API. Please retry in a moment."
                )

            resp.raise_for_status()
            return resp.json().get("products", [])

        except httpx.TimeoutException:
            raise ShopifyFetchError(
                "Timeout: Shopify API did not respond within 15 seconds."
            )
        except httpx.HTTPStatusError as exc:
            raise ShopifyFetchError(
                f"HTTP {exc.response.status_code} from Shopify: {exc.response.text[:200]}"
            )
        except ShopifyFetchError:
            raise
        except Exception as exc:
            raise ShopifyFetchError(f"Unexpected error fetching Shopify data: {exc}")


def normalize_product(product: dict) -> dict:
    """
    Normalize a raw Shopify product dict into a clean, consistent structure.

    Strips HTML from description, splits tags into a list, etc.
    """
    raw_tags = product.get("tags", "") or ""
    tags = [t.strip() for t in raw_tags.split(",") if t.strip()]

    return {
        "id": product.get("id"),
        "title": product.get("title", "").strip(),
        "body_html": (product.get("body_html") or "").strip(),
        "tags": tags,
        "images": product.get("images", []),
        "variants": product.get("variants", []),
        "product_type": (product.get("product_type") or "").strip(),
        "vendor": (product.get("vendor") or "").strip(),
        "status": product.get("status", ""),
        "created_at": product.get("created_at", ""),
        "updated_at": product.get("updated_at", ""),
    }
