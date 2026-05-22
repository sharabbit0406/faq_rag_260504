"""
Main RAG pipeline: query rewrite → hybrid retrieve → rerank → answerability → LLM answer
"""
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models.tenant import Tenant
from app.models.message import Message
from app.models.chunk import Chunk
from app.models.unanswered import UnansweredQuestion
from app.services.query_rewriter import rewrite_query
from app.services.retriever import hybrid_retrieve
from app.services.reranker import rerank
from app.services.answerability import check_answerability
from app.services.llm import generate_answer, generate_social_response, generate_off_topic_response, generate_transfer_response
from app.services.transfer_detector import is_transfer_request
from app.config import get_settings


_GREETINGS = {
    "你好", "您好", "hi", "hello", "哈囉", "嗨", "hey", "嗨嗨",
    "你好嗎", "您好嗎", "早安", "午安", "晚安",
}


def _is_greeting(text: str) -> bool:
    import re
    normalized = re.sub(r"[\s！!？?。，,、～~]+", "", text.lower())
    return normalized in _GREETINGS


async def run_rag_pipeline(
    question: str,
    tenant: Tenant,
    history: list[Message],
    detail_mode: bool = False,
    is_playground: bool = False,
    session: AsyncSession = None,
) -> dict:
    settings = get_settings()
    tenant_settings = tenant.settings or {}
    refusal_message = tenant_settings.get(
        "refusal_message",
        "抱歉，目前的資料庫中找不到與您問題相關的資訊，建議您聯繫人工客服以獲得進一步協助。",
    )
    greeting_message = tenant_settings.get(
        "greeting_message",
        "您好！我是智慧客服助理，很高興為您服務。請問有什麼我可以幫助您的嗎？",
    )

    # 0. Greeting fast-path (no LLM → no quota deduction)
    if _is_greeting(question):
        return {
            "answer": greeting_message,
            "was_refused": False,
            "citations": [],
            "rewritten_query": question,
            "retrieved_chunks": [],
            "confidence_score": 1.0,
            "debug": {"source": "greeting"} if detail_mode else None,
        }

    # 0b. Daily LLM quota check (skip for Playground regardless of detail_mode)
    # Defined before transfer detection so transfer calls also deduct quota
    if not is_playground and session:
        limit = int(tenant_settings.get("daily_llm_limit", 100))
        if limit > 0:
            today = datetime.now(timezone.utc).date().isoformat()
            usage_date = tenant_settings.get("daily_usage_date", "")
            count = int(tenant_settings.get("daily_usage_count", 0)) if usage_date == today else 0
            if count >= limit:
                return {
                    "answer": f"今日諮詢次數已達上限（{limit} 次），請明日再試或聯繫商家。",
                    "was_refused": True,
                    "_source": "quota",
                    "rewritten_query": question,
                    "retrieved_chunks": [],
                    "confidence_score": 0.0,
                    "citations": None,
                    "debug": None,
                }
            # Increment counter; committed together with message save in chat.py
            new_settings = {
                **tenant_settings,
                "daily_usage_date": today,
                "daily_usage_count": count + 1,
            }
            await session.execute(
                update(Tenant).where(Tenant.id == tenant.id).values(settings=new_settings)
            )
            # Keep local copy in sync so the rest of the pipeline reads fresh values
            tenant_settings = new_settings

    # 0a. Transfer request detection (after quota check so transfer calls deduct quota)
    if await is_transfer_request(question):
        contact_email = tenant_settings.get("contact_email", "")
        contact_phone = tenant_settings.get("contact_phone", "")
        transfer_message = await generate_transfer_response(contact_phone, contact_email)

        return {
            "answer": transfer_message,
            "was_refused": True,
            "_source": "transfer",
            "citations": [],
            "rewritten_query": question,
            "retrieved_chunks": [],
            "confidence_score": 1.0,
            "debug": {"source": "transfer"} if detail_mode else None,
        }

    # 1. Query rewriting
    rewritten = await rewrite_query(question, history)

    # 1b. Fast-path: if query matches an answered manual Q&A, return it directly
    if session:
        import re
        def _norm(t: str) -> str:
            return re.sub(r"[\s？?！!。，,、]+", "", t.lower())

        manual_result = await session.execute(
            select(UnansweredQuestion).where(
                UnansweredQuestion.tenant_id == tenant.id,
                UnansweredQuestion.status == "answered",
                UnansweredQuestion.manual_answer.isnot(None),
            )
        )
        rewritten_norm = _norm(rewritten)
        for uq in manual_result.scalars().all():
            if _norm(uq.question) == rewritten_norm or _norm(uq.question) == _norm(question):
                return {
                    "answer": uq.manual_answer,
                    "was_refused": False,
                    "citations": [],
                    "rewritten_query": rewritten,
                    "retrieved_chunks": [],
                    "confidence_score": 1.0,
                    "debug": {"source": "manual_answer", "matched_question": uq.question} if detail_mode else None,
                }

    # 2. Load all chunks for BM25 (demo scale)
    all_chunks = []
    if session:
        result = await session.execute(
            select(Chunk).where(Chunk.tenant_id == tenant.id)
        )
        db_chunks = result.scalars().all()
        all_chunks = [{"id": c.id, "content": c.content, "parent_content": c.parent_content or c.content, "document_id": c.document_id} for c in db_chunks]

        # Inject answered manual Q&A as synthetic chunks so BM25 can retrieve them
        manual_result = await session.execute(
            select(UnansweredQuestion).where(
                UnansweredQuestion.tenant_id == tenant.id,
                UnansweredQuestion.status == "answered",
                UnansweredQuestion.manual_answer.isnot(None),
            )
        )
        for uq in manual_result.scalars().all():
            all_chunks.append({
                "id": f"manual_{uq.id}",
                "content": f"問題：{uq.question}\n答案：{uq.manual_answer}",
                "document_id": "manual_answer",
            })

    # 3. Hybrid retrieval
    retrieved = await hybrid_retrieve(
        query=rewritten,
        tenant_id=tenant.id,
        all_chunks=all_chunks,
        top_k=settings.retrieval_top_k,
    )

    # 4. Rerank
    reranked = await rerank(rewritten, retrieved, top_n=settings.rerank_top_n)

    # 5. Answerability judge
    answerability = await check_answerability(rewritten, reranked)
    verdict = answerability["verdict"]

    debug = {
        "rewritten_query": rewritten,
        "retrieved_count": len(retrieved),
        "reranked_chunks": [
            {"id": c["id"], "content": c["content"][:200], "rerank_score": c.get("rerank_score")}
            for c in reranked
        ],
        "answerability": answerability,
    } if detail_mode else None

    if verdict == "social":
        social_answer = await generate_social_response(question)
        return {
            "answer": social_answer,
            "was_refused": False,
            "rewritten_query": rewritten,
            "retrieved_chunks": [],
            "confidence_score": 1.0,
            "citations": [],
            "debug": {**debug, "source": "social"} if debug else None,
        }

    if verdict == "off_topic":
        off_topic_answer = await generate_off_topic_response(question)
        return {
            "answer": off_topic_answer,
            "was_refused": False,
            "rewritten_query": rewritten,
            "retrieved_chunks": [],
            "confidence_score": 1.0,
            "citations": [],
            "debug": {**debug, "source": "off_topic"} if debug else None,
        }

    if verdict == "no":
        return {
            "answer": refusal_message,
            "was_refused": True,
            "rewritten_query": rewritten,
            "retrieved_chunks": [{"id": c["id"], "content": c["content"][:200]} for c in reranked],
            "confidence_score": 0.0,
            "citations": None,
            "debug": debug,
        }

    # 6. Generate answer (verdict == "yes")
    ai_tone = tenant_settings.get("ai_tone", "friendly")
    ai_style_note = tenant_settings.get("ai_style_note", "")
    llm_result = await generate_answer(rewritten, reranked, history=history, tone=ai_tone, style_note=ai_style_note)
    if llm_result.get("cannot_answer"):
        if debug:
            debug["llm_cannot_answer"] = True
            if llm_result.get("_error"):
                debug["answer_error"] = llm_result["_error"]
        return {
            "answer": refusal_message,
            "was_refused": True,
            "rewritten_query": rewritten,
            "retrieved_chunks": [{"id": c["id"], "content": c["content"][:200]} for c in reranked],
            "confidence_score": 0.0,
            "citations": None,
            "debug": debug,
        }
    answer = llm_result.get("answer") or refusal_message
    used_ids = set(llm_result.get("used_chunk_ids", []))

    citations = [
        {
            "chunk_id": c["id"],
            "document_id": c.get("document_id"),
            "excerpt": c["content"][:200],
            "rerank_score": c.get("rerank_score"),
        }
        for c in reranked
        if c["id"] in used_ids
    ]

    return {
        "answer": answer,
        "was_refused": False,
        "citations": citations,
        "rewritten_query": rewritten,
        "retrieved_chunks": [{"id": c["id"], "content": c["content"][:200]} for c in reranked],
        "confidence_score": reranked[0].get("rerank_score", 0) / 10 if reranked else 0,
        "debug": debug,
    }
