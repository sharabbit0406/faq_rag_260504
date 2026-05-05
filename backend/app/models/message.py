import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text, JSON, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(String, ForeignKey("conversations.id"), nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)  # user / assistant
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # [{document_id, chunk_id, score, excerpt}]
    citations: Mapped[list | None] = mapped_column(JSON, nullable=True)
    rewritten_query: Mapped[str | None] = mapped_column(Text, nullable=True)
    # top-N chunks passed to LLM [{chunk_id, content, score}]
    retrieved_chunks: Mapped[list | None] = mapped_column(JSON, nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    was_refused: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
