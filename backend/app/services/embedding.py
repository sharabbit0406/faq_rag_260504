from vertexai.language_models import TextEmbeddingModel
import vertexai
from app.config import get_settings

_model = None


def _get_model() -> TextEmbeddingModel:
    global _model
    if _model is None:
        settings = get_settings()
        vertexai.init(project=settings.gcp_project_id, location=settings.vertex_ai_location)
        _model = TextEmbeddingModel.from_pretrained(settings.embedding_model)
    return _model


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Vertex AI limit: 250 per request."""
    model = _get_model()
    results = []
    batch_size = 100
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        embeddings = model.get_embeddings(batch)
        results.extend([e.values for e in embeddings])
    return results


async def embed_query(text: str) -> list[float]:
    embeddings = await embed_texts([text])
    return embeddings[0]
