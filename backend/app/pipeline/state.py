"""
Pipeline state definition.

StoreAnalysisState is the single shared object that flows through
every node in the LangGraph pipeline. Each agent reads from it and
returns an updated copy.
"""

from typing import TypedDict


class StoreAnalysisState(TypedDict):
    # Input
    store_url: str

    # Stage 1 — Ingestion
    products: list           # Normalized product dicts

    # Stage 2 — Completeness
    issues: list             # List of {type, product_id, product_title, detail}
    deep_analysis_products: list # Products needing deep inspection

    # Stage 3 — Trust
    trust_signals: dict      # {signal_name: bool | value | dict}

    # Stage 4 — Perception
    perception: dict         # {confidence: str, confidence_reason: str, reasoning: str, objections: list}

    # Stage 5 — Scoring
    score: dict              # {total: float, breakdown: {...}, perception_gaps: [...]}

    # Stage 6 — Summarizer
    summary: str             # Compact text summary for recommendation prompt

    # Stage 7 — Recommendation
    recommendations: str     # Markdown-formatted prioritized recommendations
    what_if: dict            # {current_score, potential_score, improvement, message, breakdown}
    llm_model_used: str      # Which LLM model actually ran (set by recommendation agent)

    # Cross-cutting
    errors: list             # List of {agent: str, message: str}
    status: str              # "pending" | "success" | "partial_success" | "failed"

