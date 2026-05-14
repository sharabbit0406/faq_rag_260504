from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone, timedelta
import logging

TAIWAN_TZ = timezone(timedelta(hours=8))

from app.deps import get_current_tenant, get_session
from app.models.tenant import Tenant
from app.models.message import Message
from app.models.conversation import Conversation
from app.models.unanswered import UnansweredQuestion

router = APIRouter()


@router.get("/dashboard")
async def dashboard_stats(
    tenant: Tenant = Depends(get_current_tenant),
    session: AsyncSession = Depends(get_session),
):
    now_tw = datetime.now(TAIWAN_TZ)
    today_start_tw = now_tw.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start = today_start_tw.astimezone(timezone.utc).replace(tzinfo=None)

    # Subquery: conversation IDs belonging to this tenant, excluding playground tests
    tenant_conv_ids = select(Conversation.id).where(
        Conversation.tenant_id == tenant.id,
        Conversation.is_playground != True,
    )

    today_queries = await session.scalar(
        select(func.count(Message.id)).where(
            Message.conversation_id.in_(tenant_conv_ids),
            Message.role == "user",
            Message.created_at >= today_start,
        )
    ) or 0

    today_refused = await session.scalar(
        select(func.count(Message.id)).where(
            Message.conversation_id.in_(tenant_conv_ids),
            Message.was_refused == True,
            Message.refusal_source.not_in(["transfer", "quota"]) | Message.refusal_source.is_(None),
            Message.created_at >= today_start,
        )
    ) or 0

    unanswered_new = await session.scalar(
        select(func.count(UnansweredQuestion.id)).where(
            UnansweredQuestion.tenant_id == tenant.id,
            UnansweredQuestion.status == "new",
        )
    ) or 0

    # Daily LLM usage from tenant settings (use UTC to match pipeline.py)
    s = tenant.settings or {}
    limit = int(s.get("daily_llm_limit", 100))
    today_str = datetime.now(timezone.utc).date().isoformat()
    usage_date = s.get("daily_usage_date", "")
    daily_llm_used = int(s.get("daily_usage_count", 0)) if usage_date == today_str else 0

    return {
        "today_queries": today_queries,
        "today_refused": today_refused,
        "unanswered_new": unanswered_new,
        "daily_llm_used": daily_llm_used,
        "daily_llm_limit": limit,
    }
