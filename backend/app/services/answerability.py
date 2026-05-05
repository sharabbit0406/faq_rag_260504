import json
from app.services.llm import call_llm

JUDGE_PROMPT = """你是一個客服系統的問題分類器。根據知識庫片段和用戶問題，選擇最適合的處理方式。

用戶問題：{question}

知識庫片段：
{chunks}

請從以下選項中選一個 verdict：
- "yes"：片段中有明確、直接的答案，可以回答此問題
- "partial"：片段有相關資訊但不完整，可以部分回答
- "social"：這是社交用語、禮貌話語、或泛性詢問（例如：謝謝、掰掰、好的知道了、如何開始使用、你能幫我什麼等），應由助理自然回應，不需要知識庫
- "off_topic"：問題與任何客服服務完全無關（例如：天氣、新聞、運動、料理等），應委婉說明助理身份
- "no"：問題看起來是關於本服務的，但知識庫片段不足以回答

注意：如果片段中有足夠資訊回答「如何開始使用」等問題，請選 "yes" 而非 "social"。

請以 JSON 格式回答：
{{"verdict": "yes|partial|social|off_topic|no", "reason": "簡短說明"}}"""


async def check_answerability(question: str, chunks: list[dict]) -> dict:
    chunks_text = "\n\n".join(f"- {c['content'][:300]}" for c in chunks) if chunks else "（無相關片段）"
    prompt = JUDGE_PROMPT.format(question=question, chunks=chunks_text)

    try:
        raw = await call_llm(prompt, json_mode=True)
        result = json.loads(raw)
        verdict = result.get("verdict", "no")
        if verdict not in ("yes", "partial", "social", "off_topic", "no"):
            verdict = "no"
        return {"verdict": verdict, "reason": result.get("reason", "")}
    except Exception:
        return {"verdict": "no", "reason": "判斷失敗"}
