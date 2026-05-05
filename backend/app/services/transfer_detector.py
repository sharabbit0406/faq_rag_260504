"""
Detect if user is requesting to transfer to human agent using LLM.
"""
from app.services.llm import call_llm


async def is_transfer_request(question: str) -> bool:
    """
    Use LLM to detect if user is asking to speak to a human agent.
    Returns True if transfer request detected, False otherwise.
    """
    prompt = f"""You are a customer service request analyzer.
Determine if the user is asking to speak with a human agent or customer service representative.

User message: {question}

Respond with only "yes" or "no"."""

    try:
        response = await call_llm(prompt)
        return response.strip().lower() == "yes"
    except Exception:
        return False
