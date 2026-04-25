# AI Store Representation Optimizer — Backend

A FastAPI + LangGraph backend that analyzes Shopify stores and evaluates how AI agents perceive them, then generates prioritized recommendations.

---

## 1. Project Overview

This system answers: **"How does an AI shopping assistant see this Shopify store, and what should be improved?"**

It runs a **7-stage deterministic + LLM hybrid pipeline**:

- **Deterministic** stages check data completeness and trust signals using rules
- **LLM** stages (Gemini) simulate AI buyer perception and generate recommendations
- Failures in LLM stages **degrade gracefully** — partial results are always returned

---

## 2. Architecture

```
FastAPI (app/main.py)
    └── POST /api/analyze  (app/routes/analyze.py)
            └── LangGraph Pipeline  (app/pipeline/graph.py)
                    ├── State  (app/pipeline/state.py)
                    ├── Agent: Ingestion      → app/agents/ingestion.py
                    ├── Agent: Completeness   → app/agents/completeness.py
                    ├── Agent: Trust          → app/agents/trust.py
                    ├── Agent: Perception     → app/agents/perception.py   ← LLM
                    ├── Agent: Scoring        → app/agents/scoring.py
                    ├── Agent: Summarizer     → app/agents/summarizer.py
                    └── Agent: Recommendation → app/agents/recommendation.py ← LLM
                            ├── Services: app/services/shopify.py
                            │            app/services/llm.py
                            └── Utils:    app/utils/scoring_rules.py
                                          app/utils/error_handler.py
```

---

## 3. Pipeline Stages

| # | Stage | Type | Input | Output |
|---|-------|------|-------|--------|
| 1 | **Ingestion** | Deterministic | `store_url` | `products[]` |
| 2 | **Completeness** | Deterministic | `products[]` | `issues[]` |
| 3 | **Trust** | Deterministic | `products[]` | `trust_signals{}` |
| 4 | **Perception** | LLM (Gemini) | `products`, `issues` | `perception{confidence, reasoning, objections}` |
| 5 | **Scoring** | Deterministic | `issues`, `trust_signals`, `perception` | `score{total, breakdown, perception_gaps}` |
| 6 | **Summarizer** | Deterministic | Full state | `summary` (compact text) |
| 7 | **Recommendation** | LLM (Gemini) | `summary` | `recommendations`, `what_if` |

### Scoring Weights (rationale)

| Component | Weight | Reason |
|-----------|--------|--------|
| Completeness | **40%** | Foundational — missing data breaks all downstream AI |
| Trust | **30%** | Critical for AI recommendation confidence |
| Perception | **30%** | Captures semantic AI-level understanding |

### Trust Signal Weights (internal)

| Signal | Weight |
|--------|--------|
| Return Policy | 5 (highest — buyers care most) |
| Shipping Policy | 3 |
| Product Reviews | 2 |
| Consistent Pricing | 2 |
| Reasonable Prices | 2 |

---

## 4. API Endpoint

### `POST /api/analyze`

**Request:**
```json
{
  "store_url": "example.myshopify.com"
}
```

**Response:**
```json
{
  "status": "success | partial_success | failed",
  "score": {
    "total": 68.5,
    "breakdown": {
      "completeness": 72.0,
      "trust": 35.7,
      "perception": 84.0
    },
    "weights": {
      "completeness": "40%",
      "trust": "30%",
      "perception": "30%"
    },
    "perception_gaps": [
      "No return policy visible",
      "Several products lack images"
    ]
  },
  "issues": [
    {
      "type": "missing_description",
      "product_id": 12345,
      "product_title": "Blue Sneaker",
      "detail": "Description is too short (12 chars, min 50)"
    }
  ],
  "perception": {
    "confidence": "LOW",
    "reasoning": "The store has several products missing key details...",
    "objections": [
      "No return policy visible",
      "Several products lack images"
    ]
  },
  "recommendations": "## 🔴 High Priority\n- Add descriptions...",
  "what_if": {
    "current_score": 68.5,
    "potential_score": 91.0,
    "improvement": 22.5,
    "breakdown": {
      "completeness": { "current": 72.0, "potential": 100.0 },
      "trust": { "current": 35.7, "potential": 100.0 },
      "perception": { "current": 84.0, "potential": 92.0 }
    },
    "message": "Implementing all recommendations could improve your score from 68.5 → 91.0 (+22.5 points)"
  },
  "errors": []
}
```

### Status Codes

| Status | Meaning |
|--------|---------|
| `success` | All stages completed without errors |
| `partial_success` | LLM stages failed or skipped; deterministic results still available |
| `failed` | Ingestion failed — invalid store URL or auth error |

### Other Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check + config validation warnings |
| `GET /docs` | Swagger UI (auto-generated) |
| `GET /redoc` | ReDoc API docs |

---

## 5. Setup & Running

### Prerequisites

- Python 3.11+
- A Shopify store with a **private/custom app access token** (`read_products` scope)
- A Google Gemini API key from [aistudio.google.com](https://aistudio.google.com/)

### Installation

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env    # Windows
# cp .env.example .env    # macOS/Linux
# Edit .env and fill in your SHOPIFY_ACCESS_TOKEN and GEMINI_API_KEY
```

### Run the Server

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Server starts at: `http://localhost:8000`

---

## 6. Failure Handling

Every agent follows this pattern:

```python
# On success
return {**state, "field": data}

# On failure — never raises, always returns partial state
err = make_error("agent_name", "description of what failed")
return {**state, "errors": state["errors"] + [err]}
```

| Failure Scenario | Behavior |
|------------------|----------|
| Shopify unreachable | `status: "failed"`, empty products, error in `errors[]` |
| LLM unavailable | `status: "partial_success"`, rule-based recommendations, error in `errors[]` |
| Invalid store URL | `status: "failed"` with descriptive error message |
| Partial product data | Pipeline continues — affected products show in `issues[]` |

---

## 7. Frontend Integration Guide

### How to Call the API

```typescript
// pages/index.tsx or dashboard.tsx
const response = await fetch("http://localhost:8000/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ store_url: storeUrl }),
});

const data = await response.json();
```

### Key Fields to Display

| Field | UI Usage |
|-------|----------|
| `data.score.total` | Large score number (0–100) |
| `data.score.breakdown` | Bar chart or score cards (completeness/trust/perception) |
| `data.perception.confidence` | Badge: 🟢 HIGH / 🟡 MEDIUM / 🔴 LOW |
| `data.perception.objections` | List of AI buyer concerns |
| `data.issues` | Grouped by `type`, count shown per category |
| `data.recommendations` | Rendered as Markdown |
| `data.what_if.message` | Score improvement preview banner |
| `data.errors` | Warning banner when `status === "partial_success"` |

### CORS

The backend allows requests from:
- `http://localhost:3000` (default Next.js)
- `http://localhost:3001`

---

## 8. Extending Trust Signals

To add real return/shipping policy detection:

```python
# In app/services/shopify.py — add:
async def fetch_policies(store_url: str) -> dict:
    url = f"https://{store_url}/admin/api/{SHOPIFY_API_VERSION}/policies.json"
    # ... same pattern as fetch_products
```

Then update `app/agents/trust.py` to call this and set:
```python
has_return_policy = bool(policies.get("refund_policy", {}).get("body"))
has_shipping_policy = bool(policies.get("shipping_policy", {}).get("body"))
```

Required extra Shopify scope: `read_content`

---

## 9. Project Structure

```
backend/
├── app/
│   ├── main.py                    # FastAPI app, CORS, startup
│   ├── config/
│   │   └── settings.py            # Env vars
│   ├── routes/
│   │   └── analyze.py             # POST /api/analyze
│   ├── pipeline/
│   │   ├── state.py               # StoreAnalysisState TypedDict
│   │   └── graph.py               # LangGraph StateGraph
│   ├── agents/
│   │   ├── ingestion.py           # Stage 1
│   │   ├── completeness.py        # Stage 2
│   │   ├── trust.py               # Stage 3
│   │   ├── perception.py          # Stage 4 (LLM)
│   │   ├── scoring.py             # Stage 5
│   │   ├── summarizer.py          # Stage 6
│   │   └── recommendation.py      # Stage 7 (LLM)
│   ├── services/
│   │   ├── shopify.py             # Shopify REST API client
│   │   └── llm.py                 # Gemini wrapper (2.0-flash → 1.5-flash)
│   └── utils/
│       ├── scoring_rules.py       # Weights + scoring functions
│       └── error_handler.py       # make_error(), agent_result()
├── .env.example
├── requirements.txt
└── README.md                      # This file
```
