from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_env: str = "development"
    app_secret_key: str = "change-me-in-production"

    # Database (Cloud SQL PostgreSQL)
    database_url: str  # postgresql+asyncpg://user:pass@host/dbname

    # Google Cloud
    gcp_project_id: str
    gcp_region: str = "us-central1"
    google_application_credentials: str = ""  # path to gcp-key.json; empty = use Workload Identity on Cloud Run

    # Vertex AI
    vertex_ai_location: str = "us-central1"
    embedding_model: str = "text-embedding-004"
    llm_model: str = "gemini-2.5-flash-preview-05-20"

    # Firebase Admin
    firebase_admin_credentials: str  # path to firebase-admin-key.json OR inline JSON string

    # CORS
    cors_origins: str = "http://localhost:3000"  # comma-separated list

    # Qdrant
    qdrant_url: str
    qdrant_api_key: str
    qdrant_collection_name: str = "faq_chunks"

    # GCS
    gcs_bucket_name: str

    # RAG settings
    retrieval_top_k: int = 20
    rerank_top_n: int = 8
    bm25_weight: float = 0.3
    vector_weight: float = 0.7

    # Cost control
    default_daily_llm_limit: int = 100


@lru_cache
def get_settings() -> Settings:
    return Settings()
