"""
Local file storage for user-uploaded assets (logo, gallery photos).

Files are written to backend/uploads/<project_id>/ and served by FastAPI's
StaticFiles mount at /uploads (see app/main.py). URLs returned are relative
(e.g. "/uploads/<id>/logo_ab12.png"); the frontend prefixes the API origin.

S3-swappable: to move to MinIO/S3/Supabase Storage later, replace save_upload()
with an uploader that returns a public URL — nothing else changes.
"""
import os
import uuid

from fastapi import UploadFile

# backend/uploads  (this file is backend/app/services/storage/assets.py → up 4 levels)
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
UPLOAD_DIR = os.path.join(_BACKEND_DIR, "uploads")

_ALLOWED_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/svg+xml"}
_EXT = {
    "image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg",
    "image/webp": ".webp", "image/gif": ".gif", "image/svg+xml": ".svg",
}
_MAX_BYTES = 8 * 1024 * 1024  # 8 MB per file


class StorageError(Exception):
    pass


async def save_upload(project_id: str, file: UploadFile, kind: str) -> str:
    """Validate + persist one uploaded image. Returns its relative URL."""
    content_type = (file.content_type or "").lower()
    if content_type not in _ALLOWED_TYPES:
        raise StorageError(f"Unsupported file type '{content_type}'. Use PNG, JPG, WEBP, GIF or SVG.")

    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise StorageError(f"'{file.filename}' is too large (max {_MAX_BYTES // (1024*1024)} MB).")
    if not data:
        raise StorageError(f"'{file.filename}' is empty.")

    proj_dir = os.path.join(UPLOAD_DIR, project_id)
    os.makedirs(proj_dir, exist_ok=True)

    ext = _EXT.get(content_type, ".png")
    fname = f"{kind}_{uuid.uuid4().hex[:10]}{ext}"
    with open(os.path.join(proj_dir, fname), "wb") as fh:
        fh.write(data)

    return f"/uploads/{project_id}/{fname}"
