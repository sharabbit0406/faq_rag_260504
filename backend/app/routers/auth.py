from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import uuid
import re
from pydantic import BaseModel

from app.db import get_session
from app.deps import get_current_tenant
from app.models.tenant import Tenant

router = APIRouter()


class SignupRequest(BaseModel):
    email: str
    tenant_name: str
    firebase_uid: str


class TenantResponse(BaseModel):
    id: str
    name: str
    firebase_uid: str


@router.post("/signup", response_model=TenantResponse)
async def signup(req: SignupRequest, session: AsyncSession = Depends(get_session)):
    """Create a new tenant (merchant) after Firebase signup."""
    # Check if tenant already exists
    result = await session.execute(select(Tenant).where(Tenant.firebase_uid == req.firebase_uid))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tenant already registered")

    tenant = Tenant(
        id=str(uuid.uuid4()),
        name=req.tenant_name,
        firebase_uid=req.firebase_uid,
        settings={
            "refusal_message": "抱歉，目前的資料庫中找不到與您問題相關的資訊，建議您聯繫人工客服以獲得進一步協助。",
            "daily_llm_limit": 100,
        },
    )
    session.add(tenant)
    await session.commit()

    return TenantResponse(id=tenant.id, name=tenant.name, firebase_uid=tenant.firebase_uid)


@router.get("/tenant-name/{tenant_id}")
async def get_tenant_name(tenant_id: str, session: AsyncSession = Depends(get_session)):
    """Public endpoint: get tenant display name and chat config by ID."""
    result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    s = tenant.settings or {}
    return {
        "name": tenant.name,
        "greeting_message": s.get(
            "greeting_message",
            "您好！我是智慧客服助理，很高興為您服務。請問有什麼我可以幫助您的嗎？",
        ),
        "contact_email": s.get("contact_email") or None,
        "contact_phone": s.get("contact_phone") or None,
    }


@router.post("/profile", response_model=TenantResponse)
async def get_profile(
    req: SignupRequest,
    session: AsyncSession = Depends(get_session),
):
    """Get tenant profile by firebase_uid (public endpoint for frontend)."""
    result = await session.execute(select(Tenant).where(Tenant.firebase_uid == req.firebase_uid))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return TenantResponse(id=tenant.id, name=tenant.name, firebase_uid=tenant.firebase_uid)


class UpdateProfileRequest(BaseModel):
    name: str


@router.patch("/profile", response_model=TenantResponse)
async def update_profile(
    req: UpdateProfileRequest,
    tenant: Tenant = Depends(get_current_tenant),
    session: AsyncSession = Depends(get_session),
):
    """Update tenant display name."""
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="名稱不可為空")
    await session.execute(update(Tenant).where(Tenant.id == tenant.id).values(name=name))
    await session.commit()
    return TenantResponse(id=tenant.id, name=name, firebase_uid=tenant.firebase_uid)


class SettingsRequest(BaseModel):
    refusal_message: str | None = None
    greeting_message: str | None = None
    daily_llm_limit: int | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    ai_tone: str | None = None        # "formal" | "friendly" | "lively"
    ai_style_note: str | None = None  # free-text style instruction
    custom_suggestions: list[str] | None = None  # merchant-defined greeting bubbles
    loading_text: str | None = None              # chat widget loading message


@router.get("/settings")
async def get_settings(tenant: Tenant = Depends(get_current_tenant)):
    s = dict(tenant.settings or {})
    return {
        "refusal_message": s.get("refusal_message", "抱歉，目前的資料庫中找不到與您問題相關的資訊，建議您聯繫人工客服以獲得進一步協助。"),
        "greeting_message": s.get("greeting_message", "您好！我是智慧客服助理，很高興為您服務。請問有什麼我可以幫助您的嗎？"),
        "daily_llm_limit": s.get("daily_llm_limit", 100),
        "contact_email": s.get("contact_email", ""),
        "contact_phone": s.get("contact_phone", ""),
        "ai_tone": s.get("ai_tone", "friendly"),
        "ai_style_note": s.get("ai_style_note", ""),
        "custom_suggestions": s.get("custom_suggestions", []),
        "avatar_url": s.get("avatar_url", ""),
        "loading_text": s.get("loading_text", ""),
    }


def _validate_email(email: str) -> bool:
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))

def _validate_phone(phone: str) -> bool:
    return bool(re.match(r"^[+\d][\d\s\-\(\)]{6,19}$", phone))


@router.patch("/settings")
async def update_settings(
    req: SettingsRequest,
    tenant: Tenant = Depends(get_current_tenant),
    session: AsyncSession = Depends(get_session),
):
    if req.contact_email and not _validate_email(req.contact_email):
        raise HTTPException(status_code=400, detail="contact_email 格式不正確")
    if req.contact_phone and not _validate_phone(req.contact_phone):
        raise HTTPException(status_code=400, detail="contact_phone 格式不正確")

    current = dict(tenant.settings or {})
    if req.refusal_message is not None:
        current["refusal_message"] = req.refusal_message
    if req.greeting_message is not None:
        current["greeting_message"] = req.greeting_message
    if req.daily_llm_limit is not None:
        current["daily_llm_limit"] = req.daily_llm_limit
    if req.contact_email is not None:
        current["contact_email"] = req.contact_email
    if req.contact_phone is not None:
        current["contact_phone"] = req.contact_phone
    if req.ai_tone is not None:
        if req.ai_tone not in ("formal", "friendly", "lively", "custom"):
            raise HTTPException(status_code=400, detail="ai_tone 必須是 formal / friendly / lively / custom")
        current["ai_tone"] = req.ai_tone
    if req.ai_style_note is not None:
        current["ai_style_note"] = req.ai_style_note
    if req.custom_suggestions is not None:
        filtered = [s.strip() for s in req.custom_suggestions if s.strip()][:5]
        current["custom_suggestions"] = filtered
    if req.loading_text is not None:
        current["loading_text"] = req.loading_text.strip()
    await session.execute(
        update(Tenant).where(Tenant.id == tenant.id).values(settings=current)
    )
    await session.commit()
    return {
        "refusal_message": current.get("refusal_message", ""),
        "greeting_message": current.get("greeting_message", ""),
        "daily_llm_limit": current.get("daily_llm_limit", 100),
        "contact_email": current.get("contact_email", ""),
        "contact_phone": current.get("contact_phone", ""),
        "ai_tone": current.get("ai_tone", "friendly"),
        "ai_style_note": current.get("ai_style_note", ""),
        "custom_suggestions": current.get("custom_suggestions", []),
        "avatar_url": current.get("avatar_url", ""),
        "loading_text": current.get("loading_text", ""),
    }


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
EXT_MAP = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    tenant: Tenant = Depends(get_current_tenant),
    session: AsyncSession = Depends(get_session),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="只接受 JPG / PNG / WebP / GIF")
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="圖片不可超過 2MB")

    import base64
    b64 = base64.b64encode(content).decode()
    url = f"data:{file.content_type};base64,{b64}"

    current = dict(tenant.settings or {})
    current["avatar_url"] = url
    await session.execute(update(Tenant).where(Tenant.id == tenant.id).values(settings=current))
    await session.commit()
    return {"avatar_url": url}
