import json
from app.services.llm import call_llm

JUDGE_PROMPT = """你是一個客服系統的問題分類器。你的任務是過濾掉「完全無法處理」的問題，讓真正有機會回答的問題交給 AI 助理處理。

用戶問題：{question}

知識庫片段：
{chunks}

請從以下選項中選一個 verdict：
- "yes"：片段有相關資訊，AI 可以回答（包含需要基本推論的情況，例如比較數字、語意等價）
- "social"：這是社交用語、禮貌話語（例如：謝謝、掰掰、好的、嗨等），不需要知識庫
- "off_topic"：問題與任何客服服務完全無關（例如：天氣、新聞、娛樂、料理等），應委婉說明助理身份
- "no"：片段中完全沒有任何與問題相關的資訊，連推論的基礎都沒有

判斷標準（重要）：
- 寧可放行讓 AI 試著回答，也不要過早拒絕
- 只要片段中有任何相關的數字、政策、條件，就選 "yes"，即使不是完整直接的答案
- "no" 只用於：片段完全沒有提到問題涉及的任何主題

請以 JSON 格式回答：
{{"verdict": "yes|social|off_topic|no", "reason": "簡短說明"}}"""


async def check_answerability(question: str, chunks: list[dict]) -> dict:
    chunks_text = "\n\n".join(f"- {c['content'][:300]}" for c in chunks) if chunks else "（無相關片段）"
    prompt = JUDGE_PROMPT.format(question=question, chunks=chunks_text)

    try:
        raw = await call_llm(prompt, json_mode=True)
        result = json.loads(raw)
        verdict = result.get("verdict", "no")
        if verdict not in ("yes", "social", "off_topic", "no"):
            verdict = "yes"  # unknown verdict → let LLM try
        return {"verdict": verdict, "reason": result.get("reason", "")}
    except Exception:
        return {"verdict": "yes", "reason": "判斷服務異常，交由 LLM 嘗試回答"}
