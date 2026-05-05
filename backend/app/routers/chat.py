from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from datetime import datetime, timezone
import re
import uuid
import logging

logger = logging.getLogger(__name__)

from app.db import get_session
from app.models.tenant import Tenant
from app.models.conversation import Conversation
from app.models.message import Message

router = APIRouter()

_GREETINGS = {
    "你好", "您好", "hi", "hello", "哈囉", "嗨", "hey", "嗨嗨",
    "你好嗎", "您好嗎", "早安", "午安", "晚安",
}

def _is_greeting(text: str) -> bool:
    normalized = re.sub(r"[\s！!？?。，,、～~]+", "", text.lower())
    return normalized in _GREETINGS


class ChatRequest(BaseModel):
    tenant_id: str
    conversation_id: str | None = None
    question: str
    end_user_id: str  # Firebase anonymous UID from frontend


class ChatResponse(BaseModel):
    conversation_id: str
    answer: str
    was_refused: bool
    citations: list | None = None
    # only present in detail/playground mode
    debug: dict | None = None


class WidgetConfig(BaseModel):
    tenant_name: str
    contact_email: str | None = None
    contact_phone: str | None = None
    support_cta: str = "聯繫人工客服"
    greeting_message: str = "您好！我是智慧客服助理，很高興為您服務。請問有什麼我可以幫助您的嗎？"


@router.get("/widget-config/{tenant_id}", response_model=WidgetConfig)
async def get_widget_config(
    tenant_id: str,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = tenant.settings or {}
    return WidgetConfig(
        tenant_name=tenant.name,
        contact_email=settings.get("contact_email"),
        contact_phone=settings.get("contact_phone"),
        support_cta=settings.get("support_cta", "聯繫人工客服"),
        greeting_message=settings.get(
            "greeting_message",
            "您好！我是智慧客服助理，很高興為您服務。請問有什麼我可以幫助您的嗎？",
        ),
    )


@router.get("/suggestions")
async def get_suggestions(
    tenant_id: str,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = tenant.settings or {}
    cache = settings.get("suggested_questions")

    # Return cached if < 24 hours old
    if isinstance(cache, dict) and cache.get("questions") and cache.get("generated_at"):
        try:
            age = (datetime.now(timezone.utc) - datetime.fromisoformat(cache["generated_at"])).total_seconds()
            if age < 86400:
                return {"questions": cache["questions"]}
        except Exception as e:
            logger.warning("suggestions cache parse error for tenant %s: %s", tenant_id, e)

    # Generate fresh from KB chunks
    from app.models.chunk import Chunk
    chunks_result = await session.execute(
        select(Chunk).where(Chunk.tenant_id == tenant_id)
    )
    all_chunks = chunks_result.scalars().all()
    if not all_chunks:
        return {"questions": []}

    from app.services.llm import generate_suggested_questions
    chunk_dicts = [{"id": c.id, "content": c.content} for c in all_chunks]
    questions = await generate_suggested_questions(chunk_dicts)

    # Cache in tenant settings
    new_settings = {**settings, "suggested_questions": {
        "questions": questions,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }}
    await session.execute(
        update(Tenant).where(Tenant.id == tenant_id).values(settings=new_settings)
    )
    await session.commit()

    return {"questions": questions}


@router.post("/", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    detail_mode: bool = False,
    session: AsyncSession = Depends(get_session),
):
    # Verify tenant exists (public endpoint — no auth header, just tenant_id in body)
    result = await session.execute(select(Tenant).where(Tenant.id == req.tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant_settings = tenant.settings or {}
    greeting_message = tenant_settings.get(
        "greeting_message",
        "您好！我是智慧客服助理，很高興為您服務。請問有什麼我可以幫助您的嗎？",
    )

    # Greeting fast-path: skip RAG entirely
    if _is_greeting(req.question):
        return ChatResponse(
            conversation_id="greeting",
            answer=greeting_message,
            was_refused=False,
            citations=[],
            debug={"source": "greeting"} if detail_mode else None,
        )

    # Playground mode: run pipeline without persisting anything to DB
    if detail_mode:
        from app.services.pipeline import run_rag_pipeline
        pipeline_result = await run_rag_pipeline(
            question=req.question,
            tenant=tenant,
            history=[],
            detail_mode=True,
            session=session,
        )
        return ChatResponse(
            conversation_id="playground",
            answer=pipeline_result["answer"],
            was_refused=pipeline_result["was_refused"],
            citations=pipeline_result.get("citations"),
            debug=pipeline_result.get("debug"),
        )

    # Get or create conversation
    if req.conversation_id:
        conv_result = await session.execute(
            select(Conversation).where(
                Conversation.id == req.conversation_id,
                Conversation.tenant_id == tenant.id,
            )
        )
        conversation = conv_result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conversation = Conversation(
            id=str(uuid.uuid4()),
            tenant_id=tenant.id,
            end_user_id=req.end_user_id,
        )
        session.add(conversation)
        await session.flush()

    # Fetch recent history for query rewriting
    history_result = await session.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(6)
    )
    history = list(reversed(history_result.scalars().all()))

    # Save user message
    user_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation.id,
        role="user",
        content=req.question,
    )
    session.add(user_msg)

    # Run RAG pipeline
    from app.services.pipeline import run_rag_pipeline
    pipeline_result = await run_rag_pipeline(
        question=req.question,
        tenant=tenant,
        history=history,
        detail_mode=False,
        session=session,
    )

    # Save assistant message
    assistant_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation.id,
        role="assistant",
        content=pipeline_result["answer"],
        citations=pipeline_result.get("citations"),
        rewritten_query=pipeline_result.get("rewritten_query"),
        retrieved_chunks=pipeline_result.get("retrieved_chunks"),
        confidence_score=pipeline_result.get("confidence_score"),
        was_refused=pipeline_result["was_refused"],
    )
    session.add(assistant_msg)

    # Update conversation timestamp
    await session.execute(
        update(Conversation)
        .where(Conversation.id == conversation.id)
        .values(last_active_at=datetime.now(timezone.utc))
    )

    # Log unanswered question if refused
    if pipeline_result["was_refused"]:
        from app.services.unanswered_tracker import track_unanswered
        await track_unanswered(req.question, tenant.id, session)

    await session.commit()

    return ChatResponse(
        conversation_id=conversation.id,
        answer=pipeline_result["answer"],
        was_refused=pipeline_result["was_refused"],
        citations=pipeline_result.get("citations"),
        debug=None,
    )
