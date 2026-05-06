"""
Detect if user is requesting to transfer to human agent using LLM.
"""
from app.services.llm import call_llm


async def is_transfer_request(question: str) -> bool:
    """
    Detect EXPLICIT requests to speak with a human agent.
    Returns True only for direct transfer requests, not general problems.
    """
    prompt = f"""你是一個客服系統的意圖分類器。判斷用戶是否在「明確要求」轉接真人客服或人工服務。

用戶訊息：{question}

判斷標準（必須符合才回答 yes）：
- 明確說要找真人、人工、客服專員（例如：「我要找人工」、「幫我轉客服」、「我想和真人說話」）
- 明確表示 AI 無法解決、要求升級處理

不算轉人工請求（回答 no）：
- 描述問題或困難（例如：「我買錯了」、「我的訂單有問題」、「我想退貨」）
- 詢問政策或流程
- 抱怨但沒有要求轉接

只回答 yes 或 no。"""

    try:
        response = await call_llm(prompt)
        return response.strip().lower() == "yes"
    except Exception:
        return False
