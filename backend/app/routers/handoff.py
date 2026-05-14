from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
import uuid

from app.db import get_session
from app.deps import get_current_tenant
from app.models.tenant import Tenant
from app.models.handoff import HandoffRequest
from app.services.llm import generate_handoff_summary

router = APIRouter()


class MessageItem(BaseModel):
    role: str
    content: str


class GenerateSummaryRequest(BaseModel):
    tenant_id: str
    messages: list[MessageItem]


class SubmitHandoffRequest(BaseModel):
    tenant_id: str
    conversation_id: str | None = None
    end_user_id: str | None = None
    summary: str


class HandoffResponse(BaseModel):
    id: str
    tenant_id: str
    conversation_id: str | None
    end_user_id: str | None
    summary: str
    status: str
    created_at: str


@router.post("/generate-summary")
async def generate_summary(req: GenerateSummaryRequest):
    """Generate a handoff summary from conversation messages (public endpoint)."""
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages 不可為空")
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    summary = await generate_handoff_summary(messages)
    return {"summary": summary}


@router.post("/submit", response_model=HandoffResponse)
async def submit_handoff(req: SubmitHandoffRequest, session: AsyncSession = Depends(get_session)):
    """Submit a handoff request from chat widget (public endpoint)."""
    if not req.summary.strip():
        raise HTTPException(status_code=400, detail="summary 不可為空")

    handoff = HandoffRequest(
        id=str(uuid.uuid4()),
        tenant_id=req.tenant_id,
        conversation_id=req.conversation_id,
        end_user_id=req.end_user_id,
        summary=req.summary.strip(),
        status="new",
    )
    session.add(handoff)
    await session.commit()

    return HandoffResponse(
        id=handoff.id,
        tenant_id=handoff.tenant_id,
        conversation_id=handoff.conversation_id,
        end_user_id=handoff.end_user_id,
        summary=handoff.summary,
        status=handoff.status,
        created_at=handoff.created_at.isoformat(),
    )


@router.get("/", response_model=list[HandoffResponse])
async def list_handoffs(
    tenant: Tenant = Depends(get_current_tenant),
    session: AsyncSession = Depends(get_session),
):
    """List handoff requests for the authenticated merchant."""
    result = await session.execute(
        select(HandoffRequest)
        .where(HandoffRequest.tenant_id == tenant.id)
        .order_by(HandoffRequest.created_at.desc())
    )
    rows = result.scalars().all()
    return [
        HandoffResponse(
            id=h.id,
            tenant_id=h.tenant_id,
            conversation_id=h.conversation_id,
            end_user_id=h.end_user_id,
            summary=h.summary,
            status=h.status,
            created_at=h.created_at.isoformat(),
        )
        for h in rows
    ]


class UpdateHandoffRequest(BaseModel):
    status: str


@router.patch("/{handoff_id}", response_model=HandoffResponse)
async def update_handoff(
    handoff_id: str,
    req: UpdateHandoffRequest,
    tenant: Tenant = Depends(get_current_tenant),
    session: AsyncSession = Depends(get_session),
):
    """Update handoff status (read / resolved)."""
    if req.status not in ("new", "read", "resolved"):
        raise HTTPException(status_code=400, detail="status 必須是 new / read / resolved")

    result = await session.execute(
        select(HandoffRequest).where(
            HandoffRequest.id == handoff_id,
            HandoffRequest.tenant_id == tenant.id,
        )
    )
    handoff = result.scalar_one_or_none()
    if not handoff:
        raise HTTPException(status_code=404, detail="找不到此轉接紀錄")

    await session.execute(
        update(HandoffRequest)
        .where(HandoffRequest.id == handoff_id)
        .values(status=req.status)
    )
    await session.commit()

    return HandoffResponse(
        id=handoff.id,
        tenant_id=handoff.tenant_id,
        conversation_id=handoff.conversation_id,
        end_user_id=handoff.end_user_id,
        summary=handoff.summary,
        status=req.status,
        created_at=handoff.created_at.isoformat(),
    )
