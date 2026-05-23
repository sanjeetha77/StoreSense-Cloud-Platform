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
from app.observability.metrics import (
    GEMINI_LATENCY,
    LLM_FALLBACK_COUNT,
    LLM_PROMPT_TOKENS,
    LLM_COMPLETION_TOKENS,
    LLM_COST_USD
)
from app.observability.tracing import tracer
from opentelemetry import trace
import logging

logger = logging.getLogger(__name__)

# -----------------------------
# Model Priority Order
# -----------------------------
MODELS = [
    "models/gemini-2.5-flash-lite",
    "models/gemini-2.0-flash-lite",

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
        LLM_FALLBACK_COUNT.labels(from_model="primary", to_model="deterministic", type="no_api_key").inc()
        return deterministic_fallback(prompt)

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        logger.error(f"[LLM] Client init failed: {e}")
        LLM_FALLBACK_COUNT.labels(from_model="primary", to_model="deterministic", type="client_init_failed").inc()
        return deterministic_fallback(prompt)

    # -----------------------------
    # Try Models in Order
    # -----------------------------
    for model_name in MODELS:
        for attempt in range(MAX_RETRIES):
            start_time = time.time()
            with tracer.start_as_current_span(f"Gemini Call: {model_name}") as span:
                span.set_attribute("llm.model", model_name)
                span.set_attribute("llm.attempt", attempt + 1)
                try:
                    logger.info(f"[LLM] Calling {model_name} (attempt {attempt+1})")

                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt
                    )

                    text = getattr(response, "text", None)

                    if not text:
                        raise ValueError("Empty response")

                    duration = time.time() - start_time
                    GEMINI_LATENCY.labels(model=model_name, status="success").observe(duration)

                    # Token usage tracking
                    prompt_tokens = 0
                    completion_tokens = 0
                    cost = 0.0
                    if hasattr(response, "usage_metadata") and response.usage_metadata is not None:
                        prompt_tokens = getattr(response.usage_metadata, "prompt_token_count", 0) or 0
                        completion_tokens = getattr(response.usage_metadata, "candidates_token_count", 0) or 0
                        
                        # Calculate cost: Gemini 2.5/2.0 flash-lite vs others (pro)
                        if "pro" in model_name:
                            input_rate = 1.25 / 1_000_000
                            output_rate = 5.00 / 1_000_000
                        else:
                            input_rate = 0.075 / 1_000_000
                            output_rate = 0.30 / 1_000_000
                        cost = (prompt_tokens * input_rate) + (completion_tokens * output_rate)

                        # Record metrics
                        LLM_PROMPT_TOKENS.labels(model=model_name).inc(prompt_tokens)
                        LLM_COMPLETION_TOKENS.labels(model=model_name).inc(completion_tokens)
                        LLM_COST_USD.labels(model=model_name).inc(cost)
                        
                        logger.info(
                            f"[LLM] Model {model_name} used {prompt_tokens} input tokens and "
                            f"{completion_tokens} output tokens. Estimated cost: ${cost:.6f} USD"
                        )

                    # Record trace span attributes
                    span.set_attribute("llm.prompt_tokens", prompt_tokens)
                    span.set_attribute("llm.completion_tokens", completion_tokens)
                    span.set_attribute("llm.cost_usd", cost)

                    if model_name != MODELS[0]:
                        LLM_FALLBACK_COUNT.labels(from_model=MODELS[0], to_model=model_name, type="model_fallback").inc()

                    return {
                        "text": text,
                        "model_used": model_name,
                        "fallback_used": (model_name != MODELS[0]),
                        "status": "success",
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens,
                        "cost_usd": cost
                    }

                except Exception as e:
                    error_msg = str(e)
                    duration = time.time() - start_time
                    GEMINI_LATENCY.labels(model=model_name, status="error").observe(duration)
                    span.record_exception(e)
                    span.set_status(trace.StatusCode.ERROR, error_msg)

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
    LLM_FALLBACK_COUNT.labels(from_model=MODELS[0], to_model="deterministic", type="all_models_failed").inc()
    return deterministic_fallback(prompt)