import os
from dotenv import load_dotenv

load_dotenv()

SHOPIFY_ACCESS_TOKEN: str = os.getenv("SHOPIFY_ACCESS_TOKEN", "")
SHOPIFY_API_VERSION: str = os.getenv("SHOPIFY_API_VERSION", "2024-01")
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

# Validate critical config on startup
def validate_config() -> list[str]:
    """Return list of missing required config keys."""
    missing = []
    if not SHOPIFY_ACCESS_TOKEN:
        missing.append("SHOPIFY_ACCESS_TOKEN")
    if not GEMINI_API_KEY:
        missing.append("GEMINI_API_KEY")
    return missing
