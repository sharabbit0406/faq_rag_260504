from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from pydantic import BaseModel

from app.deps import get_current_tenant, get_session
from app.models.tenant import Tenant
from app.models.unanswered import UnansweredQuestion

router = APIRouter()


@router.get("/")
async def list_unanswered(
    status: str | None = None,
    tenant: Tenant = Depends(get_current_tenant),
    session: AsyncSession = Depends(get_session),
):
    query = select(UnansweredQuestion).where(UnansweredQuestion.tenant_id == tenant.id)
    if status:
        query = query.where(UnansweredQuestion.status == status)
    query = query.order_by(UnansweredQuestion.occurrence_count.desc())
    result = await session.execute(query)
    items = result.scalars().all()
    return [
        {
            "id": q.id,
            "question": q.question,
            "occurrence_count": q.occurrence_count,
            "last_asked_at": q.last_asked_at,
            "status": q.status,
            "manual_answer": q.manual_answer,
        }
        for q in items
    ]


class UpdateUnansweredRequest(BaseModel):
    status: str | None = None
    manual_answer: str | None = None


@router.patch("/{question_id}")
async def update_unanswered(
    question_id: str,
    req: UpdateUnansweredRequest,
    tenant: Tenant = Depends(get_current_tenant),
    session: AsyncSession = Depends(get_session),
):
    values = {}
    if req.status is not None:
        values["status"] = req.status
    if req.manual_answer is not None:
        values["manual_answer"] = req.manual_answer

    await session.execute(
        update(UnansweredQuestion)
        .where(UnansweredQuestion.id == question_id, UnansweredQuestion.tenant_id == tenant.id)
        .values(**values)
    )
    await session.commit()
    return {"updated": True}


@router.delete("/{question_id}")
async def delete_unanswered(
    question_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        delete(UnansweredQuestion).where(
            UnansweredQuestion.id == question_id,
            UnansweredQuestion.tenant_id == tenant.id,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await session.commit()
    return {"deleted": True}
