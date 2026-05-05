import json
from app.services.llm import call_llm

RERANK_PROMPT = """你的任務是評估每個知識片段對回答用戶問題的相關程度。

用戶問題：{question}

以下是候選片段，請對每個片段給予 0-10 分（10 分最相關）：

{chunks}

請以 JSON 格式回答，只回傳分數陣列，順序與上方片段一致：
{{"scores": [8, 2, 9, ...]}}"""


async def rerank(question: str, chunks: list[dict], top_n: int = 5) -> list[dict]:
    if not chunks:
        return []

    chunks_text = "\n\n".join(
        f"[{i}] chunk_id: {c['id']}\n{c['content'][:400]}"
        for i, c in enumerate(chunks)
    )
    prompt = RERANK_PROMPT.format(question=question, chunks=chunks_text)

    try:
        raw = await call_llm(prompt, json_mode=True)
        data = json.loads(raw)
        scores = data.get("scores", [])
    except Exception:
        scores = []

    # Attach rerank scores
    scored = []
    for i, chunk in enumerate(chunks):
        score = scores[i] if i < len(scores) else 0
        scored.append({**chunk, "rerank_score": score})

    scored.sort(key=lambda x: x["rerank_score"], reverse=True)
    return scored[:top_n]
