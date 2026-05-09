from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
from typing import List

from app.deps import get_current_tenant, get_session
from app.models.tenant import Tenant
from app.models.document import Document

router = APIRouter()

MAX_FILE_SIZE = 200 * 1024 * 1024  # 200 MB
ALLOWED_TYPES = {"pdf", "csv", "xlsx", "xls", "txt"}


def _validate_ext(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"不支援的檔案格式：{ext}")
    return ext


async def _read_and_validate(file: UploadFile) -> bytes:
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"{file.filename} 超過大小限制（最大 {MAX_FILE_SIZE // 1024 // 1024} MB）",
        )
    return content


@router.post("/")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    tenant: Tenant = Depends(get_current_tenant),
    session: AsyncSession = Depends(get_session),
):
    ext = _validate_ext(file.filename)
    content = await _read_and_validate(file)

    doc = Document(
        id=str(uuid.uuid4()),
        tenant_id=tenant.id,
        filename=file.filename,
        file_type=ext,
        gcs_path="",  # filled by indexing task
        size_bytes=len(content),
        status="pending",
    )
    session.add(doc)
    await session.commit()

    from app.tasks.indexing import index_document
    background_tasks.add_task(index_document, doc.id, content, file.filename, ext, tenant.id)

    return {"id": doc.id, "status": "pending"}


@router.post("/batch")
async def upload_documents_batch(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    tenant: Tenant = Depends(get_current_tenant),
    session: AsyncSession = Depends(get_session),
):
    if not files:
        raise HTTPException(status_code=400, detail="請至少選擇一個檔案")

    results = []
    from app.tasks.indexing import index_document

    for file in files:
        ext = _validate_ext(file.filename)
        content = await _read_and_validate(file)

        doc = Document(
            id=str(uuid.uuid4()),
            tenant_id=tenant.id,
            filename=file.filename,
            file_type=ext,
            gcs_path="",
            size_bytes=len(content),
            status="pending",
        )
        session.add(doc)
        await session.flush()
        background_tasks.add_task(index_document, doc.id, content, file.filename, ext, tenant.id)
        results.append({"id": doc.id, "filename": file.filename, "status": "pending"})

    await session.commit()
    return results


@router.get("/")
async def list_documents(
    tenant: Tenant = Depends(get_current_tenant),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Document).where(Document.tenant_id == tenant.id).order_by(Document.created_at.desc())
    )
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "file_type": d.file_type,
            "size_bytes": d.size_bytes,
            "status": d.status,
            "chunk_count": d.chunk_count,
            "created_at": d.created_at,
            "error_message": d.error_message,
        }
        for d in docs
    ]


@router.get("/{doc_id}/status")
async def get_document_status(
    doc_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Document).where(Document.id == doc_id, Document.tenant_id == tenant.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"id": doc.id, "status": doc.status, "chunk_count": doc.chunk_count, "error_message": doc.error_message}


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Document).where(Document.id == doc_id, Document.tenant_id == tenant.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status == "processing":
        raise HTTPException(status_code=409, detail="文件正在索引中，請等待完成後再刪除")

    from app.services.vector_store import delete_document_vectors
    from app.models.chunk import Chunk
    from sqlalchemy import delete as sql_delete, update as sql_update

    await delete_document_vectors(doc_id, tenant.id)
    await session.execute(sql_delete(Chunk).where(Chunk.document_id == doc_id))
    await session.delete(doc)

    # Invalidate suggestions cache
    new_settings = {**(tenant.settings or {})}
    new_settings.pop("suggested_questions", None)
    await session.execute(sql_update(Tenant).where(Tenant.id == tenant.id).values(settings=new_settings))

    await session.commit()
    return {"deleted": True}
