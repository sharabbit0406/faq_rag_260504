# Infrastructure & Environment Variables

## Services

- **PostgreSQL 16** — host port **5830**, container port 5432 (via Docker Compose)
- **Qdrant** — port 6333 (via Docker Compose)
- **Google Cloud Storage** — uploaded document storage
- **Vertex AI** — embeddings (`text-embedding-004`, 768-dim, batch max 100) and generation (`gemini-2.5-flash`, temperature=0.1)

> **Windows port note:** Port 5432 falls inside Windows/Hyper-V reserved ranges on this machine. `docker-compose.yml` maps PostgreSQL to **port 5830** (`5830:5432`). `backend/.env` `DATABASE_URL` uses `localhost:5830`. Do not change this back to 5432.

## Environment Variables Setup

Copy `.env.example` → `backend/.env`  
Copy `frontend/.env.local.example` → `frontend/.env.local`

Key backend variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql+asyncpg://faqrag:faqrag_local@localhost:5830/faqrag` |
| `GOOGLE_APPLICATION_CREDENTIALS` | path to GCP service account JSON |
| `FIREBASE_ADMIN_CREDENTIALS` | path to Firebase service account JSON |
| `QDRANT_URL` | Qdrant connection URL |
| `QDRANT_COLLECTION_NAME` | collection name |
| `RETRIEVAL_TOP_K` | `20` |
| `RERANK_TOP_N` | `5` |
| `DEFAULT_DAILY_LLM_LIMIT` | `100` |
