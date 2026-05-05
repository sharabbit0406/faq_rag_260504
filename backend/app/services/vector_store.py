from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct,
    Filter, FieldCondition, MatchValue,
    PayloadSchemaType, FilterSelector,
)
import uuid
from app.config import get_settings

_client: QdrantClient | None = None


def get_client() -> QdrantClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)
    return _client


def ensure_collection():
    settings = get_settings()
    client = get_client()
    collections = [c.name for c in client.get_collections().collections]
    if settings.qdrant_collection_name not in collections:
        client.create_collection(
            collection_name=settings.qdrant_collection_name,
            vectors_config=VectorParams(size=768, distance=Distance.COSINE),
        )
        client.create_payload_index(
            collection_name=settings.qdrant_collection_name,
            field_name="tenant_id",
            field_schema=PayloadSchemaType.KEYWORD,
        )
        client.create_payload_index(
            collection_name=settings.qdrant_collection_name,
            field_name="document_id",
            field_schema=PayloadSchemaType.KEYWORD,
        )


def _tenant_filter(tenant_id: str) -> Filter:
    return Filter(must=[FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id))])


async def upsert_chunks(chunks: list[dict], tenant_id: str):
    """
    chunks: [{"id": str, "content": str, "embedding": list[float], "document_id": str, "metadata": dict}]
    """
    settings = get_settings()
    client = get_client()
    points = [
        PointStruct(
            id=c["id"],
            vector=c["embedding"],
            payload={
                "tenant_id": tenant_id,
                "document_id": c["document_id"],
                "content": c["content"],
                **c.get("metadata", {}),
            },
        )
        for c in chunks
    ]
    client.upsert(collection_name=settings.qdrant_collection_name, points=points)


async def search_vectors(query_embedding: list[float], tenant_id: str, top_k: int = 20) -> list[dict]:
    settings = get_settings()
    client = get_client()
    response = client.query_points(
        collection_name=settings.qdrant_collection_name,
        query=query_embedding,
        query_filter=_tenant_filter(tenant_id),
        limit=top_k,
        with_payload=True,
    )
    return [
        {
            "id": str(r.id),
            "score": r.score,
            "content": r.payload.get("content", ""),
            "document_id": r.payload.get("document_id", ""),
            "payload": r.payload,
        }
        for r in response.points
    ]


async def delete_document_vectors(document_id: str, tenant_id: str):
    settings = get_settings()
    client = get_client()
    client.delete(
        collection_name=settings.qdrant_collection_name,
        points_selector=FilterSelector(
            filter=Filter(
                must=[
                    FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id)),
                    FieldCondition(key="document_id", match=MatchValue(value=document_id)),
                ]
            )
        ),
    )
