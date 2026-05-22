import asyncio
from google.cloud import storage
from app.config import get_settings

_client: storage.Client | None = None


def get_client() -> storage.Client:
    global _client
    if _client is None:
        _client = storage.Client()
    return _client


async def upload_file(content: bytes, filename: str, tenant_id: str) -> str:
    settings = get_settings()

    def _do_upload():
        client = get_client()
        bucket = client.bucket(settings.gcs_bucket_name)
        blob_name = f"{tenant_id}/{filename}"
        blob = bucket.blob(blob_name)
        blob.upload_from_string(content)
        return f"gs://{settings.gcs_bucket_name}/{blob_name}"

    return await asyncio.to_thread(_do_upload)


async def upload_avatar(content: bytes, tenant_id: str, ext: str) -> str:
    """Upload avatar image, make it public, return HTTPS URL."""
    settings = get_settings()

    def _do_upload():
        client = get_client()
        bucket = client.bucket(settings.gcs_bucket_name)
        blob_name = f"avatars/{tenant_id}/avatar.{ext}"
        blob = bucket.blob(blob_name)
        content_type = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
        blob.upload_from_string(content, content_type=content_type)
        try:
            blob.make_public()
            return blob.public_url
        except Exception:
            # Bucket uses uniform access control — construct the public URL directly
            return f"https://storage.googleapis.com/{settings.gcs_bucket_name}/{blob_name}"

    return await asyncio.to_thread(_do_upload)


async def delete_file(gcs_path: str):
    client = get_client()
    if gcs_path.startswith("gs://"):
        parts = gcs_path[5:].split("/", 1)
        bucket = client.bucket(parts[0])
        blob = bucket.blob(parts[1])
        blob.delete(if_generation_match=None)
