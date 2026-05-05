import json
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig
from app.config import get_settings

_model: GenerativeModel | None = None


def get_model() -> GenerativeModel:
    global _model
    if _model is None:
        settings = get_settings()
        vertexai.init(project=settings.gcp_project_id, location=settings.vertex_ai_location)
        _model = GenerativeModel(settings.llm_model)
    return _model


async def call_llm(prompt: str, json_mode: bool = False) -> str:
    model = get_model()
    config = GenerationConfig(
        temperature=0.1,
        response_mime_type="application/json" if json_mode else "text/plain",
    )
    response = model.generate_content(prompt, generation_config=config)
    return response.text


ANSWER_PROMPT = """你是一個專業的客服助理。請根據以下提供的知識庫片段回答用戶問題。

規則：
1. 只能使用以下片段中的資訊回答，不能加入片段以外的知識
2. 若片段中的資訊不足以完整回答，請誠實說明哪些部分無法確認
3. 回答要自然流暢，不要直接複製貼上片段
4. "answer" 欄位只放給用戶看的文字，不可包含任何 chunk_id 或技術標記
5. 將你參考的片段 ID 填入 "used_chunk_ids"（僅供系統追蹤，不出現在回答中）

知識庫片段：
{chunks}

用戶問題：{question}

請以 JSON 格式回答：
{{
  "answer": "你的回答（純文字，不含 chunk_id）",
  "used_chunk_ids": ["chunk_id_1", "chunk_id_2"]
}}"""


import re as _re
_CHUNK_REF = _re.compile(r"\[chunk_id:\s*[^\]]+\]", _re.IGNORECASE)

SOCIAL_PROMPT = """你是一個友善的智慧客服助理，專門回答關於本服務的問題。
用戶說了：「{question}」
這是一句社交用語或泛性詢問，請用自然、溫暖的方式回應。
若適合，可以輕描淡寫地引導用戶詢問服務相關問題，但不要過度推銷。
直接回覆即可，不要加多餘前綴或說明。"""

OFF_TOPIC_PROMPT = """你是一個智慧客服助理，專門回答關於本服務的常見問題。
用戶問了：「{question}」
這個問題與本服務無關。請用委婉、友善的方式告知用戶你的身份和服務範圍，並邀請他們詢問與本服務相關的問題。
語氣要自然，不要過於機械化。直接回覆即可。"""


SUGGESTIONS_PROMPT = """你是一個智慧客服系統。根據以下知識庫的內容片段，生成 4 個用戶最可能會問的問題。
要求：
1. 自然口語化，像真實用戶會問的方式
2. 直接涵蓋知識庫中的重要資訊（付款、退換貨、使用方式、常見問題等）
3. 每題 15 字以內，簡潔明瞭
4. 用繁體中文
5. 不同問題涵蓋不同主題，不要重複

知識庫片段：
{chunks}

請以 JSON 格式回答：
{{"questions": ["問題1", "問題2", "問題3", "問題4"]}}"""


async def generate_suggested_questions(chunks: list[dict]) -> list[str]:
    import random
    sample = random.sample(chunks, min(15, len(chunks)))
    chunks_text = "\n\n".join(f"- {c['content'][:250]}" for c in sample)
    prompt = SUGGESTIONS_PROMPT.format(chunks=chunks_text)
    try:
        raw = await call_llm(prompt, json_mode=True)
        result = json.loads(raw)
        qs = result.get("questions", [])
        return [q for q in qs if isinstance(q, str) and q.strip()][:4]
    except Exception:
        return []


async def generate_social_response(question: str) -> str:
    prompt = SOCIAL_PROMPT.format(question=question)
    return await call_llm(prompt)


async def generate_off_topic_response(question: str) -> str:
    prompt = OFF_TOPIC_PROMPT.format(question=question)
    return await call_llm(prompt)


TRANSFER_PROMPT = """你是一個友善的客服助理。用戶要求轉接到人工客服。

可用的聯絡方式：
{contact_info}

請生成一個禮貌、自然的回應，告訴用戶如何聯絡人工客服。
- 語氣要溫暖和專業
- 簡潔有力，2-3 句話
- 直接回覆即可，不要加多餘前綴或說明"""


async def generate_transfer_response(contact_phone: str = "", contact_email: str = "") -> str:
    contact_lines = []
    if contact_phone:
        contact_lines.append(f"電話：{contact_phone}")
    if contact_email:
        contact_lines.append(f"信箱：{contact_email}")

    contact_info = "\n".join(contact_lines) if contact_lines else "（目前暫無聯絡方式）"
    prompt = TRANSFER_PROMPT.format(contact_info=contact_info)
    return await call_llm(prompt)


async def generate_answer(question: str, chunks: list[dict]) -> dict:
    chunks_text = "\n\n".join(
        f"[chunk_id: {c['id']}]\n{c['content']}" for c in chunks
    )
    prompt = ANSWER_PROMPT.format(chunks=chunks_text, question=question)
    raw = await call_llm(prompt, json_mode=True)
    try:
        result = json.loads(raw)
        if "answer" in result:
            result["answer"] = _CHUNK_REF.sub("", result["answer"]).strip()
        return result
    except json.JSONDecodeError:
        return {"answer": _CHUNK_REF.sub("", raw).strip(), "used_chunk_ids": []}
