"""
Shopify Admin API — Policy Fetcher

Calls the Shopify REST Admin API to retrieve store policy documents.
This is the PRIMARY method for policy detection; HTML scraping is the fallback.

Endpoint: GET /admin/api/{version}/policies.json

Shopify policy title → internal key mapping:
  "Refund policy"     → return_policy
  "Shipping policy"   → shipping_policy
  "Privacy policy"    → privacy_policy
  "Terms of service"  → terms_policy

Titles "Contact information" and "Legal notice" are ignored.
"""

import logging
import httpx

from app.config.settings import SHOPIFY_ACCESS_TOKEN, SHOPIFY_API_VERSION

logger = logging.getLogger(__name__)

# Maps Shopify policy titles (lowercased) to our internal keys
POLICY_TITLE_MAP: dict[str, str] = {
    "refund policy":     "return_policy",
    "shipping":   "shipping_policy",
    "privacy policy":    "privacy_policy",
    "terms of service":  "terms_policy",
}

# Internal keys we care about — default to empty string if absent from API
ALL_POLICY_KEYS = ["return_policy", "shipping_policy", "privacy_policy", "terms_policy"]


async def fetch_policies(store_url: str) -> dict[str, str]:
    """
    Fetch store policy content via the Shopify Admin API.

    Args:
        store_url: e.g. "example.myshopify.com" (with or without https://)

    Returns:
        Dict mapping internal policy keys to their HTML body strings.
        Empty string means the policy was not found / is empty.

        {
            "return_policy":   "<html>...</html>" | "",
            "shipping_policy": "...",
            "privacy_policy":  "...",
            "terms_policy":    "...",
        }

    Raises:
        Exception: any network/auth failure (caller handles and falls back to scraper)
    """
    # Normalize store URL
    store_url = (
        store_url.strip().strip("/")
        .replace("https://", "")
        .replace("http://", "")
    )

    url = f"https://{store_url}/admin/api/{SHOPIFY_API_VERSION}/policies.json"
    headers = {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
    }

    logger.info(f"[ShopifyAPI] Fetching policies from {url}")

    async with httpx.AsyncClient(timeout=12.0) as client:
        resp = await client.get(url, headers=headers)

    if resp.status_code == 401:
        raise PermissionError(f"[ShopifyAPI] 401 Unauthorized — check SHOPIFY_ACCESS_TOKEN")
    if resp.status_code == 404:
        raise LookupError(f"[ShopifyAPI] 404 — store not found: {store_url}")
    if resp.status_code != 200:
        raise RuntimeError(f"[ShopifyAPI] Unexpected HTTP {resp.status_code} from {url}")

    raw_policies: list[dict] = resp.json().get("policies", [])
    logger.info(f"[ShopifyAPI] Received {len(raw_policies)} policy objects")

    # Start with empty strings for all keys
    result: dict[str, str] = {key: "" for key in ALL_POLICY_KEYS}

    for policy in raw_policies:
        title = (policy.get("title") or "").strip().lower()
        body  = (policy.get("body") or "").strip()

        internal_key = POLICY_TITLE_MAP.get(title)
        if internal_key:
            result[internal_key] = body
            logger.info(
                f"[ShopifyAPI] Mapped '{title}' → {internal_key} "
                f"({len(body)} chars)"
            )
        else:
            logger.debug(f"[ShopifyAPI] Ignored policy title: '{title}'")

    return result


def classify_policy(content: str, threshold: int = 300) -> dict:
    """
    Classify a single policy body string into a result dict.

    Args:
        content:   Raw HTML/text body from the API (empty string = not set).
        threshold: Minimum character count to be considered "present".

    Returns:
        {
            "status":         "present" | "weak" | "missing",
            "content_length": int,
        }
    """
    content_len = len(content)

    if content_len == 0:
        status = "missing"
    elif content_len >= threshold:
        status = "present"
    else:
        status = "weak"

    return {
        "status":         status,
        "content_length": content_len,
    }
