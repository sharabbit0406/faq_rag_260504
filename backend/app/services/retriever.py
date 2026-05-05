from rank_bm25 import BM25Okapi
from app.services.embedding import embed_query
from app.services.vector_store import search_vectors


def _tokenize(text: str) -> list[str]:
    return text.lower().split()


def _rrf_merge(vector_results: list[dict], bm25_results: list[dict], k: int = 60) -> list[dict]:
    """Reciprocal Rank Fusion of two ranked lists."""
    scores: dict[str, float] = {}
    payloads: dict[str, dict] = {}

    for rank, item in enumerate(vector_results):
        cid = item["id"]
        scores[cid] = scores.get(cid, 0) + 1 / (k + rank + 1)
        payloads[cid] = item

    for rank, item in enumerate(bm25_results):
        cid = item["id"]
        scores[cid] = scores.get(cid, 0) + 1 / (k + rank + 1)
        payloads[cid] = item

    merged = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [
        {**payloads[cid], "rrf_score": score}
        for cid, score in merged
    ]


async def hybrid_retrieve(query: str, tenant_id: str, all_chunks: list[dict], top_k: int = 20) -> list[dict]:
    """
    all_chunks: [{"id", "content", ...}] — the tenant's full chunk list for BM25.
    For demo scale this is loaded from DB. For larger scale, use PG full-text search.
    """
    query_embedding = await embed_query(query)

    # Vector search
    vector_results = await search_vectors(query_embedding, tenant_id, top_k=top_k)

    # BM25 search
    corpus = [_tokenize(c["content"]) for c in all_chunks]
    if corpus:
        bm25 = BM25Okapi(corpus)
        scores = bm25.get_scores(_tokenize(query))
        indexed = sorted(
            [{"id": c["id"], "content": c["content"], "document_id": c.get("document_id", ""), "score": float(s)}
             for c, s in zip(all_chunks, scores)],
            key=lambda x: x["score"],
            reverse=True,
        )[:top_k]
    else:
        indexed = []

    return _rrf_merge(vector_results, indexed)[:top_k]
