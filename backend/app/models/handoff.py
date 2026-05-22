import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class HandoffRequest(Base):
    __tablename__ = "handoff_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), nullable=False)
    conversation_id: Mapped[str | None] = mapped_column(String, nullable=True)
    end_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    contact_email: Mapped[str | None] = mapped_column(String, nullable=True)
    suggested_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    kb_added: Mapped[bool] = mapped_column(default=False)
    status: Mapped[str] = mapped_column(String, default="new")  # new / read / resolved
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
