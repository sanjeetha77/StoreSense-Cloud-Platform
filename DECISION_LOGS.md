# StoreSense-AI: Engineering Decision Log

This log captures the architectural and implementation decisions made during the development of the StoreSense-AI backend. These decisions prioritize latency, reliability, cost-efficiency, and explainability while ensuring the system remains robust under failure conditions.

---

## Decision 1: Hybrid Analysis Architecture (LLM + Deterministic)

**We considered:**
- Pure LLM: Passing raw data to an LLM for scoring
- Pure Rule-Based: Using only validation rules

**We chose:**
- Hybrid System: Deterministic agents for structure + LLM for semantic reasoning

**Why:**
Pure LLM scoring is non-deterministic and expensive. Pure rule-based systems miss subjective trust and perception signals. The hybrid approach balances accuracy with reasoning.

**Evidence:**
- `scoring_rules.py` → deterministic scoring
- `perception.py` → LLM-based reasoning

---

## Decision 2: Stateless Architecture (No Database)

**We considered:**
- Persisted State (PostgreSQL)
- Stateless Execution

**We chose:**
- Stateless Design

**Why:**
Reduces complexity, avoids data privacy concerns, and ensures every analysis reflects the latest store state.

**Evidence:**
- `analyze.py` initializes fresh `initial_state`
- No DB dependencies in `requirements.txt`

---

## Decision 3: LangGraph for Pipeline Orchestration

**We considered:**
- Linear script (async/await)
- LangGraph (graph-based orchestration)

**We chose:**
- LangGraph

**Why:**
Supports conditional routing, structured state management, and parallel execution. Makes pipeline modular and scalable.

**Evidence:**
- `graph.py` uses `StateGraph`
- Conditional edges implemented

---

## Decision 4: Parallel Execution (Trust + Perception)

**We considered:**
- Sequential execution
- Parallel execution

**We chose:**
- Parallel execution

**Why:**
LLM calls and API requests are the slowest operations. Running them in parallel reduces latency significantly (~25s → ~12s).

**Evidence:**
- `graph.py` branches from completeness → trust & perception

---

## Decision 5: Admin API Primary with Scraper Fallback

**We considered:**
- Scraping only
- Admin API only

**We chose:**
- Hybrid approach (Admin API → Scraper fallback)

**Why:**
Scrapers fail on password-protected stores. Admin API works with tokens. Fallback ensures robustness.

**Evidence:**
- `trust.py` → `_detect_policies` uses API first, scraper second

---

## Decision 6: Summarization Layer Before Recommendation

**We considered:**
- Sending full product data to LLM
- Summarizing before LLM

**We chose:**
- Summarization Agent

**Why:**
Reduces token cost and improves LLM focus. Prevents noisy prompts.

**Evidence:**
- `summarizer.py` builds compact summary
- `recommendation.py` uses `{summary}` only

---

## Decision 7: Scoring Prior to Recommendations

**We considered:**
- Simultaneous scoring + recommendations
- Sequential (score → recommend)

**We chose:**
- Sequential pipeline

**Why:**
The recommendation agent needs quantitative signals to prioritize actions effectively.

**Additional Reasoning:**
This mirrors real-world systems where quantitative signals guide qualitative reasoning, improving interpretability.

**Evidence:**
- `graph.py` ensures scoring precedes recommendation

---

## Decision 8: Limiting Product Sampling to 50

**We considered:**
- Full catalog analysis
- Limited sampling

**We chose:**
- Limit to 50 products

**Why:**
Balances latency, API rate limits, and LLM context constraints while still capturing systemic issues.

**Evidence:**
- `shopify.py` → `limit=50`

---

## Decision 9: Exclusion of Real-Time Monitoring

**We considered:**
- Real-time monitoring via webhooks
- On-demand analysis

**We chose:**
- On-demand analysis

**Why:**
Real-time monitoring requires persistent storage and complex infrastructure.

**Additional Reasoning:**
We intentionally scoped this out to prioritize depth of analysis over infrastructure complexity within hackathon constraints.

**Evidence:**
- Single POST `/analyze` endpoint
- No background workers/webhooks

---

## Decision 10: Graceful Degradation as a Core Design Principle

**We considered:**
- Fail-fast (stop on errors)
- Graceful degradation

**We chose:**
- Graceful degradation

**Why:**
Returning partial insights is better than returning nothing after long computation.

**Evidence:**
- LLM fallback logic
- Partial success states
- Response flags in output

---

# High Impact Decisions

- **Parallel Execution via LangGraph**
→ Reduced latency significantly and enabled real-time usability
- **Admin API Priority**
→ Solved critical failure in password-protected stores

---

# Design Philosophy

The system is built on three core principles:

1. Deterministic where possible (accuracy + speed)
2. LLM where necessary (semantic reasoning)
3. Never fail silently (graceful degradation)

These principles guided all architectural decisions.