# StoreSense AI - AI Representation Optimizer

**AI Readiness Analyzer for Shopify Stores**

StoreSense AI is an agentic analysis engine that evaluates how well a Shopify store is optimized for AI-driven discovery (LLMs, AI search, recommendation agents).

---

## Problem

Modern e-commerce is shifting from SEO → **AI-driven discovery**.

Merchants:

* Optimize for Google (keywords)
* But ignore AI systems (ChatGPT, Gemini, etc.)

 Result:
Stores become **invisible to AI recommendations**

---

##  Solution

StoreSense AI simulates an **AI buyer agent** and evaluates:

* Can AI understand your products?
* Does your store build trust?
* Will AI recommend your store?

---

##  Core Features

###  1. AI Readiness Score

* Overall score (0–100)
* Based on:

  * Completeness
  * Trust
  * AI Perception

---

###  2. Multi-Agent Analysis Pipeline

* Completeness Agent → Missing product data
* Trust Agent → Policies, reliability signals
* Perception Agent (LLM) → AI understanding simulation

---

###  3. Actionable Fixes

* Prioritized improvements
* Impact simulation (“+X score if fixed”)
* Real improvement roadmap

---

###  4. AI Perception Simulation

Simulates:

> “Would an AI recommend this store?”

Returns:

* Confidence level
* Gaps in understanding
* Recommendation reasoning

---

##  Architecture

```mermaid
graph LR
    Start --> Ingest
    Ingest --> Completeness
    
    Completeness --> Trust
    Completeness --> Perception
    
    Trust --> Scoring
    Perception --> Scoring
    
    Scoring --> Summarizer
    Summarizer --> Recommendation
```

---

## Tech Stack

| Layer         | Technology       |
| ------------- | ---------------- |
| Backend       | FastAPI (Python) |
| Orchestration | LangGraph        |
| AI            | Google Gemini    |
| LLM Framework | LangChain        |
| API Calls     | HTTPX            |
| Frontend      | Next.js + React  |
| UI            | Tailwind CSS     |
| Charts        | Recharts         |

---

##  System Design Principles

* Deterministic where possible (accuracy)
* LLM where necessary (reasoning)
* Graceful degradation (never fail silently)

---

##  Pipeline Flow

1. Ingestion → Fetch Shopify data
2. Completeness → Check missing fields
3. Parallel:

   * Trust analysis
   * AI perception simulation
4. Scoring → Weighted score
5. Summarization → Compact state
6. Recommendation → Action plan

---

##  Failure Handling

| Scenario          | Behavior               |
| ----------------- | ---------------------- |
| Shopify API fails | Stop pipeline          |
| LLM fails         | Retry → fallback       |
| Partial data      | Return partial success |
| Policies missing  | Mark as issue          |

---

##  Scoring Model

```
Score = 
  Completeness (40%) +
  Trust (30%) +
  Perception (30%)
```

---

##  Example Insights

* Missing return policy → trust drop
* Weak descriptions → perception drop
* Missing images → completeness drop

---

##  Limitations

* Samples max 50 products
* No historical tracking
* LLM latency (~2–5s per call)

---

##  Future Improvements

* Redis caching
* Real-time monitoring
* Multi-agent perception
* Deeper content quality scoring

---

##  How to Run

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

##  Environment Variables

Create `.env` inside `backend/` folder:

```env
GEMINI_API_KEY=your_api_key
SHOPIFY_ACCESS_TOKEN=your_token
```

---

## API Endpoint

```http
POST /api/analyze
```

### Body:

```json
{
  "store_url": "your-store.myshopify.com"
}
```

---

##  Contributors

* Sanjaykanth M
* Sanjeetha S

---

## Built For

Kasparro Agentic Commerce Hackathon 2026

---

##  Key Insight

> Fixing surface issues improves structure,
> but AI perception depends on semantic clarity.

---

## 📄 License

MIT License
