"""
Storage Client — Handles file uploads to S3/MinIO or local filesystem.
Falls back to local storage if S3 is not configured.
"""
import os
from pathlib import Path
from typing import Optional

from loguru import logger

from app.core.config import settings


# Local storage directory
LOCAL_STORAGE_DIR = Path(__file__).parent.parent.parent.parent / "storage"
LOCAL_STORAGE_DIR.mkdir(exist_ok=True)


class StorageClient:
    """File storage client supporting local filesystem and S3/MinIO."""

    def __init__(self):
        self.use_s3 = bool(
            settings.s3_access_key
            and settings.s3_secret_key
            and settings.s3_endpoint_url
            and settings.s3_access_key != "minioadmin"  # Skip default dev creds if MinIO not running
        )

    async def upload_pptx(self, data: bytes, filename: str) -> str:
        """Upload a PPTX file and return its URL."""
        if self.use_s3:
            return await self._upload_to_s3(data, filename, "application/vnd.openxmlformats-officedocument.presentationml.presentation")
        else:
            return await self._save_locally(data, filename)

    async def upload_thumbnail(self, project_id: str) -> str:
        """Generate and upload a thumbnail placeholder. Returns URL."""
        # For now, return a placeholder
        return f"/api/v1/projects/{project_id}/thumbnail"

    async def get_file(self, filename: str) -> Optional[bytes]:
        """Retrieve a file by its path."""
        local_path = LOCAL_STORAGE_DIR / filename
        if local_path.exists():
            return local_path.read_bytes()

        if self.use_s3:
            return await self._download_from_s3(filename)

        return None

    async def _save_locally(self, data: bytes, filename: str) -> str:
        """Save file to local filesystem."""
        file_path = LOCAL_STORAGE_DIR / filename
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(data)
        logger.info(f"💾 Saved locally: {file_path} ({len(data)} bytes)")
        return f"/storage/{filename}"

    async def _upload_to_s3(self, data: bytes, filename: str, content_type: str) -> str:
        """Upload file to S3/MinIO."""
        try:
            import boto3
            from botocore.config import Config

            s3 = boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint_url,
                aws_access_key_id=settings.s3_access_key,
                aws_secret_access_key=settings.s3_secret_key,
                region_name=settings.s3_region,
                config=Config(signature_version="s3v4"),
            )

            # Ensure bucket exists
            try:
                s3.head_bucket(Bucket=settings.s3_bucket_name)
            except Exception:
                s3.create_bucket(Bucket=settings.s3_bucket_name)

            s3.put_object(
                Bucket=settings.s3_bucket_name,
                Key=filename,
                Body=data,
                ContentType=content_type,
            )

            url = f"{settings.cdn_base_url}/{filename}"
            logger.info(f"☁️ Uploaded to S3: {url}")
            return url

        except Exception as e:
            logger.warning(f"S3 upload failed, falling back to local: {e}")
            return await self._save_locally(data, filename)

    async def _download_from_s3(self, filename: str) -> Optional[bytes]:
        """Download file from S3/MinIO."""
        try:
            import boto3
            from botocore.config import Config

            s3 = boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint_url,
                aws_access_key_id=settings.s3_access_key,
                aws_secret_access_key=settings.s3_secret_key,
                region_name=settings.s3_region,
                config=Config(signature_version="s3v4"),
            )

            response = s3.get_object(
                Bucket=settings.s3_bucket_name,
                Key=filename,
            )
            return response["Body"].read()

        except Exception as e:
            logger.warning(f"S3 download failed: {e}")
            return None
