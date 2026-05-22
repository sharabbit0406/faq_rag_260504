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
    contact_email: str | None = None


class HandoffResponse(BaseModel):
    id: str
    tenant_id: str
    conversation_id: str | None
    end_user_id: str | None
    summary: str
    contact_email: str | None = None
    suggested_answer: str | None = None
    kb_added: bool = False
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
        contact_email=req.contact_email or None,
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
        contact_email=handoff.contact_email,
        suggested_answer=None,
        kb_added=False,
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
            contact_email=h.contact_email,
            suggested_answer=h.suggested_answer,
            kb_added=h.kb_added,
            status=h.status,
            created_at=h.created_at.isoformat(),
        )
        for h in rows
    ]


class UpdateHandoffRequest(BaseModel):
    status: str | None = None
    suggested_answer: str | None = None


@router.patch("/{handoff_id}", response_model=HandoffResponse)
async def update_handoff(
    handoff_id: str,
    req: UpdateHandoffRequest,
    tenant: Tenant = Depends(get_current_tenant),
    session: AsyncSession = Depends(get_session),
):
    """Update handoff status or suggested_answer."""
    if req.status is not None and req.status not in ("new", "read", "resolved"):
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

    values: dict = {}
    if req.status is not None:
        values["status"] = req.status
    if req.suggested_answer is not None:
        values["suggested_answer"] = req.suggested_answer
    if values:
        await session.execute(
            update(HandoffRequest).where(HandoffRequest.id == handoff_id).values(**values)
        )
        await session.commit()
        # Refresh
        result2 = await session.execute(select(HandoffRequest).where(HandoffRequest.id == handoff_id))
        handoff = result2.scalar_one()

    return HandoffResponse(
        id=handoff.id,
        tenant_id=handoff.tenant_id,
        conversation_id=handoff.conversation_id,
        end_user_id=handoff.end_user_id,
        summary=handoff.summary,
        contact_email=handoff.contact_email,
        suggested_answer=handoff.suggested_answer,
        kb_added=handoff.kb_added,
        status=handoff.status,
        created_at=handoff.created_at.isoformat(),
    )


@router.post("/{handoff_id}/add-to-kb", response_model=HandoffResponse)
async def add_handoff_to_kb(
    handoff_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    session: AsyncSession = Depends(get_session),
):
    """Create a Q&A chunk from a handoff record and add it to the knowledge base."""
    result = await session.execute(
        select(HandoffRequest).where(
            HandoffRequest.id == handoff_id,
            HandoffRequest.tenant_id == tenant.id,
        )
    )
    handoff = result.scalar_one_or_none()
    if not handoff:
        raise HTTPException(status_code=404, detail="找不到此轉接紀錄")
    if not handoff.suggested_answer or not handoff.suggested_answer.strip():
        raise HTTPException(status_code=400, detail="請先填寫建議回答方式")
    if handoff.kb_added:
        raise HTTPException(status_code=400, detail="此紀錄已加入知識庫")

    from app.models.document import Document
    from app.models.chunk import Chunk
    from app.services.embedding import embed_texts
    from app.services.vector_store import upsert_chunks, ensure_collection

    # Create a virtual document to satisfy FK
    doc_id = str(uuid.uuid4())
    # Use first line of summary (up to 40 chars) as the document name
    first_line = handoff.summary.strip().splitlines()[0][:40]
    doc_name = f"轉接問答｜{first_line}" if first_line else f"轉接問答 #{handoff_id[:8]}"
    doc = Document(
        id=doc_id,
        tenant_id=tenant.id,
        filename=doc_name,
        file_type="txt",
        gcs_path="",
        status="done",
        chunk_count=1,
    )
    session.add(doc)
    await session.flush()

    # Build Q&A content
    content = f"問：{handoff.summary.strip()}\n答：{handoff.suggested_answer.strip()}"
    chunk_id = str(uuid.uuid4())

    # Embed
    embeddings = await embed_texts([content])
    ensure_collection()
    await upsert_chunks([{"id": chunk_id, "content": content, "embedding": embeddings[0], "document_id": doc_id, "metadata": {"source": "handoff"}}], tenant.id)

    # Save chunk
    session.add(Chunk(
        id=chunk_id,
        document_id=doc_id,
        tenant_id=tenant.id,
        content=content,
        chunk_index=0,
        qdrant_point_id=chunk_id,
        metadata_={"source": "handoff"},
    ))

    await session.execute(
        update(HandoffRequest).where(HandoffRequest.id == handoff_id).values(kb_added=True)
    )
    await session.commit()

    return HandoffResponse(
        id=handoff.id,
        tenant_id=handoff.tenant_id,
        conversation_id=handoff.conversation_id,
        end_user_id=handoff.end_user_id,
        summary=handoff.summary,
        contact_email=handoff.contact_email,
        suggested_answer=handoff.suggested_answer,
        kb_added=True,
        status=handoff.status,
        created_at=handoff.created_at.isoformat(),
    )
