# Backend Rules

## RAG Pipeline (`services/pipeline.py`)

A chat request flows through these steps in order:

1. Greeting detection → immediate response (no LLM call, no quota deduction)
2. Daily quota check → block if exceeded (`_source: "quota"`)
3. Transfer detection → fixed redirect message (`_source: "transfer"`)
4. Query rewrite (`services/query_rewriter.py`) → cleaner retrieval query
5. Hybrid retrieval (`services/retriever.py`) — BM25 + Qdrant vector search merged via Reciprocal Rank Fusion
6. Reranking (`services/reranker.py`)
7. Answerability check (`services/answerability.py`) → refuse if out-of-scope
8. LLM generation (`services/llm.py`) — Vertex AI Gemini 2.5 Flash

Steps 2 and 3 return early with `was_refused=True` and a `_source` key. The `_source` is saved to `Message.refusal_source` so analytics can distinguish real knowledge-gap refusals from system events.

## API Routers (`routers/`)

`auth.py`, `documents.py`, `chat.py`, `unanswered.py`, `analytics.py`, `handoff.py`

## Document Ingestion Flow

Upload → `tasks/indexing.py` (background task) → parse → chunk → embed via `text-embedding-004` → store in PostgreSQL (chunks table) + Qdrant

## Database Model Relationships

```
Tenant (root entity, identified by Firebase UID)
├── Document  (file metadata, status: pending/processing/done/failed)
│   └── Chunk  (text segments; qdrant_point_id links to vector store)
├── Conversation  (chat sessions; is_playground=True for the test playground)
│   └── Message  (role, content, citations, confidence_score, was_refused,
│                 refusal_source, rewritten_query)
├── UnansweredQuestion  (out-of-scope questions for merchant review)
└── HandoffRequest  (human-handoff summaries submitted from chat widget)
```

## `Message.refusal_source` Values

- `null` — genuine knowledge-gap refusal (counted in dashboard 拒答次數)
- `"transfer"` — user requested human agent (excluded from 拒答次數 and UnansweredQuestion)
- `"quota"` — daily LLM limit hit (excluded from 拒答次數)

## Dashboard Metrics Distinction

- **拒答次數** — today's AI knowledge-gap failures only (`refusal_source IS NULL`); resets daily
- **未解問題** — cumulative deduplicated list of unanswered questions; transfer and quota refusals excluded
- **轉接紀錄** (`HandoffRequest`) — conversation summaries generated when users click the human-agent button

## Handoff Flow (`routers/handoff.py`)

- `POST /api/handoffs/generate-summary` — public; takes `{tenant_id, messages[]}`, calls LLM to produce a structured summary
- `POST /api/handoffs/submit` — public; saves edited summary from chat widget
- `GET /api/handoffs/` — authenticated; merchant lists all handoff requests
- `PATCH /api/handoffs/{id}` — authenticated; update status (`new` → `read` → `resolved`)

## Multi-tenancy & Auth

Every DB model links to a `Tenant` row (identified by Firebase UID). Tenant settings (AI tone, refusal message, greeting, daily LLM limit, contact info) are stored as a JSON column. Qdrant vectors are filtered by `tenant_id` payload field so tenants never see each other's data.

Firebase email/password for merchants → Firebase UID → Tenant lookup. Chat widget uses Firebase anonymous auth for end-users.
