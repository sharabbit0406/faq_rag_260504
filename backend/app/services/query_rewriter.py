from app.services.llm import call_llm
from app.models.message import Message

REWRITE_PROMPT = """你是一個對話分析助理。根據對話歷史，將用戶的最新問題改寫成一個獨立、完整的問題。

若最新問題已經完整（不依賴上文），直接回傳原始問題即可。

對話歷史：
{history}

最新問題：{question}

只回傳改寫後的問題文字，不要任何解釋。"""


async def rewrite_query(question: str, history: list[Message]) -> str:
    if not history:
        return question

    history_text = "\n".join(
        f"{'用戶' if m.role == 'user' else '客服'}：{m.content}"
        for m in history[-4:]  # last 4 turns
    )

    prompt = REWRITE_PROMPT.format(history=history_text, question=question)
    rewritten = await call_llm(prompt)
    return rewritten.strip()
