import re
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.unanswered import UnansweredQuestion


def _normalize(text: str) -> str:
    # Remove punctuation and whitespace for dedup matching
    text = re.sub(r"[\s！!？?。，,、～~「」『』【】《》""''…—－\-\.\(\)（）]+", "", text.lower())
    return text.strip()


async def track_unanswered(question: str, tenant_id: str, session: AsyncSession):
    normalized = _normalize(question)
    result = await session.execute(
        select(UnansweredQuestion).where(
            UnansweredQuestion.tenant_id == tenant_id,
            UnansweredQuestion.normalized_question == normalized,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        await session.execute(
            update(UnansweredQuestion)
            .where(UnansweredQuestion.id == existing.id)
            .values(occurrence_count=existing.occurrence_count + 1, last_asked_at=datetime.now(timezone.utc))
        )
    else:
        session.add(
            UnansweredQuestion(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                question=question,
                normalized_question=normalized,
            )
        )
