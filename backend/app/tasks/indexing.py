"""
Background task: parse → chunk → embed → store in Qdrant + DB
"""
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import update

from app.config import get_settings
from app.models.document import Document
from app.models.chunk import Chunk
from app.services.parser import parse_file
from app.services.chunker import chunk_blocks
from app.services.embedding import embed_texts
from app.services.vector_store import upsert_chunks, ensure_collection
from app.services.storage import upload_file


async def index_document(doc_id: str, content: bytes, filename: str, file_type: str, tenant_id: str):
    settings = get_settings()

    # Background tasks need their own DB session
    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        try:
            # Update status to processing
            await session.execute(
                update(Document).where(Document.id == doc_id).values(status="processing")
            )
            await session.commit()

            # Upload to GCS (optional — skip if billing disabled)
            try:
                gcs_path = await upload_file(content, filename, tenant_id)
            except Exception:
                gcs_path = ""

            # Parse
            blocks = parse_file(content, file_type)

            # Chunk
            chunks = chunk_blocks(blocks, file_type)

            if not chunks:
                await session.execute(
                    update(Document).where(Document.id == doc_id).values(
                        status="failed", error_message="No content extracted"
                    )
                )
                await session.commit()
                return

            # Embed child chunks (small, precise for retrieval)
            texts = [c["content"] for c in chunks]
            embeddings = await embed_texts(texts)

            # Ensure Qdrant collection exists
            ensure_collection()

            # Build chunk records
            chunk_records = []
            db_chunks = []
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                chunk_id = str(uuid.uuid4())
                parent_content = chunk.get("parent_content") or chunk["content"]
                chunk_records.append({
                    "id": chunk_id,
                    "content": chunk["content"],
                    "parent_content": parent_content,
                    "embedding": embedding,
                    "document_id": doc_id,
                    "metadata": chunk.get("metadata", {}),
                })
                db_chunks.append(Chunk(
                    id=chunk_id,
                    document_id=doc_id,
                    tenant_id=tenant_id,
                    content=chunk["content"],
                    parent_content=parent_content,
                    chunk_index=i,
                    qdrant_point_id=chunk_id,
                    metadata_=chunk.get("metadata", {}),
                ))

            # Upsert to Qdrant
            await upsert_chunks(chunk_records, tenant_id)

            # Save to DB
            session.add_all(db_chunks)
            await session.execute(
                update(Document).where(Document.id == doc_id).values(
                    status="done",
                    gcs_path=gcs_path,
                    size_bytes=len(content),
                    chunk_count=len(chunks),
                )
            )
            # Invalidate suggestions cache so they regenerate with new content
            from app.models.tenant import Tenant
            from sqlalchemy import select as sql_select
            t_result = await session.execute(sql_select(Tenant).where(Tenant.id == tenant_id))
            t = t_result.scalar_one_or_none()
            if t:
                new_settings = {**(t.settings or {})}
                new_settings.pop("suggested_questions", None)
                await session.execute(update(Tenant).where(Tenant.id == tenant_id).values(settings=new_settings))
            await session.commit()

        except Exception as e:
            await session.execute(
                update(Document).where(Document.id == doc_id).values(
                    status="failed", error_message=str(e)[:500]
                )
            )
            await session.commit()
            raise
