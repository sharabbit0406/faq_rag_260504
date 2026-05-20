import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import init_db
from app.routers import auth, documents, chat, unanswered, analytics, handoff


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.google_application_credentials:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.google_application_credentials
    from app.auth.firebase import init_firebase
    init_firebase(settings.firebase_admin_credentials)
    await init_db()
    yield


app = FastAPI(
    title="FAQ RAG API",
    version="0.1.0",
    lifespan=lifespan,
)

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(unanswered.router, prefix="/api/unanswered", tags=["unanswered"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(handoff.router, prefix="/api/handoffs", tags=["handoffs"])


@app.get("/healthz")
async def health_check():
    return {"status": "ok"}
