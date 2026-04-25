"""
LLM Service — Gemini + Fallback + Deterministic Backup

Features:
- Primary + multiple model fallback
- Retry on rate-limit (429)
- Graceful degradation (never crashes)
- Deterministic fallback when LLM unavailable
- Structured output for downstream agents
"""

import logging
import time
from typing import Dict, Any, Optional

from google import genai
from app.config.settings import GEMINI_API_KEY

logger = logging.getLogger(__name__)

# -----------------------------
# Model Priority Order
# -----------------------------
MODELS = [
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash",
    "models/gemini-flash-latest",
]

MAX_RETRIES = 2
RETRY_DELAY = 3  # seconds


# -----------------------------
# Deterministic Fallback
# -----------------------------
def deterministic_fallback(prompt: str) -> Dict[str, Any]:
    """
    Rule-based fallback when LLM fails.
    Keeps system functional even without AI.
    """

    logger.warning("[LLM] Using deterministic fallback")

    # Very simple heuristic (you can improve later)
    if "description" in prompt.lower():
        recommendation = "Improve product descriptions by adding features, specifications, and usage details."
    elif "tags" in prompt.lower():
        recommendation = "Add relevant product tags for better categorization and discoverability."
    else:
        recommendation = "Improve store completeness by adding missing information and trust signals."

    return {
        "text": f"[Fallback Recommendation] {recommendation}",
        "model_used": "deterministic",
        "fallback_used": True,
        "status": "fallback"
    }


# -----------------------------
# LLM Call Function
# -----------------------------
def call_llm(prompt: str) -> Dict[str, Any]:
    """
    Main LLM function with:
    - retry
    - model fallback
    - deterministic fallback
    """

    if not GEMINI_API_KEY:
        logger.warning("[LLM] No API key — using fallback")
        return deterministic_fallback(prompt)

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        logger.error(f"[LLM] Client init failed: {e}")
        return deterministic_fallback(prompt)

    # -----------------------------
    # Try Models in Order
    # -----------------------------
    for model_name in MODELS:
        for attempt in range(MAX_RETRIES):

            try:
                logger.info(f"[LLM] Calling {model_name} (attempt {attempt+1})")

                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )

                text = getattr(response, "text", None)

                if not text:
                    raise ValueError("Empty response")

                return {
                    "text": text,
                    "model_used": model_name,
                    "fallback_used": (model_name != MODELS[0]),
                    "status": "success"
                }

            except Exception as e:
                error_msg = str(e)

                # -----------------------------
                # Handle Rate Limit (429)
                # -----------------------------
                if "429" in error_msg:
                    logger.warning(f"[LLM] Rate limited on {model_name}, retrying...")
                    time.sleep(RETRY_DELAY)
                    continue

                # -----------------------------
                # Other Errors → break retry
                # -----------------------------
                logger.warning(f"[LLM] {model_name} failed: {e}")
                break

    # -----------------------------
    # Final fallback
    # -----------------------------
    logger.error("[LLM] All models failed — using deterministic fallback")
    return deterministic_fallback(prompt)