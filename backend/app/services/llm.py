import json
import logging
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig
from app.config import get_settings

logger = logging.getLogger(__name__)

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


ANSWER_PROMPT = """你是一個客服助理，說話像真人，不像機器人。請根據知識庫片段回答用戶問題。

語氣風格：
{tone_instruction}

回答規則：
1. 主要根據以下知識庫片段回答，不要憑空捏造片段中完全未提及的事實
2. 允許對片段中的數字、條件做基本邏輯推論（例如：片段說「滿199元免運」，用戶問「買200元要運費嗎」→ 200>199，可推論免運費）
3. 允許語意等價推論（例如：「免運費」即代表「運費為0元」，不需要片段明寫「0元」）
4. 只要片段中有任何與問題相關的資訊，就必須嘗試回答，即使答案不完整。只有在片段中完全找不到任何相關資訊時，才將 "cannot_answer" 設為 true。
5. 禁止逐字複製片段原文，要用自己的話重新說
6. 根據用戶情境調整語氣：用戶在抱怨→先表達理解；用戶在詢問→直接回答重點
7. 回答要簡潔，只說跟用戶當下問題最相關的，不要堆砌所有資訊
8. "answer" 欄位只放給用戶看的文字，不可包含任何 chunk_id 或技術標記
9. 將你參考的片段 ID 填入 "used_chunk_ids"（僅供系統追蹤，不出現在回答中）

{history_section}知識庫片段：
{chunks}

用戶問題：{question}

請以 JSON 格式回答：
{{
  "answer": "你的回答（純文字，不含 chunk_id）",
  "cannot_answer": false,
  "used_chunk_ids": ["chunk_id_1", "chunk_id_2"]
}}"""

_TONE_PRESETS = {
    "formal": "正式、專業、有禮貌。使用「您」稱呼用戶，語氣穩重，避免使用emoji或口語化用詞。",
    "friendly": "親切自然，語氣溫暖。可以使用「你」，像和熟悉的朋友聊天，但仍保持專業。",
    "lively": "活潑輕鬆，有個性。語氣像年輕人說話，可以適度使用 emoji，讓對話更有趣。",
}


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


async def generate_transfer_response(contact_phone: str = "", contact_email: str = "") -> str:
    return "可點選右上方的「真人客服」按鈕，我們的客服人員將盡快為您服務。"


HANDOFF_SUMMARY_PROMPT = """你是一個客服助理，請根據以下對話記錄，生成一份給真人客服人員的「轉接摘要」。

對話記錄：
{conversation}

請用繁體中文生成摘要，格式如下（每項1~2行，簡潔即可）：
【問題類型】（一句話描述用戶的主要需求或問題類型）
【對話重點】（用戶說了什麼、AI如何回應的重點）
【尚未解決】（哪些問題AI沒有解決或被拒答）
【建議處理】（給客服人員的具體建議）

直接輸出摘要文字即可，不要加額外說明。"""


async def generate_handoff_summary(messages: list[dict]) -> str:
    lines = []
    for m in messages:
        role_label = "用戶" if m["role"] == "user" else "AI客服"
        lines.append(f"{role_label}：{m['content']}")
    conversation = "\n".join(lines)
    prompt = HANDOFF_SUMMARY_PROMPT.format(conversation=conversation)
    return await call_llm(prompt)


async def generate_answer(question: str, chunks: list[dict], history: list = None, tone: str = "friendly", style_note: str = "") -> dict:
    chunks_text = "\n\n".join(
        f"[chunk_id: {c['id']}]\n{c['content']}" for c in chunks
    )
    if history:
        history_lines = "\n".join(
            f"{'用戶' if m.role == 'user' else '客服'}：{m.content}"
            for m in history[-4:]
        )
        history_section = f"對話歷史（供理解上下文）：\n{history_lines}\n\n"
    else:
        history_section = ""
    if tone == "custom":
        tone_instruction = style_note.strip() if style_note and style_note.strip() else _TONE_PRESETS["friendly"]
    else:
        tone_instruction = _TONE_PRESETS.get(tone, _TONE_PRESETS["friendly"])
        if style_note:
            tone_instruction += f"\n【強制規則，必須嚴格遵守，不可忽略】：{style_note}"
    prompt = ANSWER_PROMPT.format(chunks=chunks_text, question=question, history_section=history_section, tone_instruction=tone_instruction)
    try:
        raw = await call_llm(prompt, json_mode=True)
        if not raw or not raw.strip():
            return {"answer": None, "cannot_answer": True, "used_chunk_ids": []}
        try:
            result = json.loads(raw)
            if "answer" in result and result["answer"]:
                result["answer"] = _CHUNK_REF.sub("", result["answer"]).strip()
            return result
        except json.JSONDecodeError:
            cleaned = _CHUNK_REF.sub("", raw).strip()
            return {"answer": cleaned, "cannot_answer": False, "used_chunk_ids": []}
    except Exception as e:
        logger.error("generate_answer failed: %s", e, exc_info=True)
        return {"answer": None, "cannot_answer": True, "used_chunk_ids": [], "_error": str(e)}
