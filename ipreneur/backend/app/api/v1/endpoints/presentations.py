"""Presentations endpoint — download/export generated presentations."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import io

from app.api.deps.auth import get_current_user
from app.models.models import User, Project, Presentation
from app.db.session import get_db
from app.services.storage.s3_client import StorageClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/{project_id}/download")
async def download_presentation(
    project_id: str,
    format: str = "pptx",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download the generated PPTX/PDF for a project."""
    # Verify project ownership
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id,
            Project.is_deleted.is_(False),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.status != "ready":
        raise HTTPException(status_code=400, detail="Deck is not ready yet")

    # Get presentation record
    result = await db.execute(
        select(Presentation).where(
            Presentation.project_id == project_id,
            Presentation.status == "ready",
        ).order_by(Presentation.created_at.desc()).limit(1)
    )
    presentation = result.scalar_one_or_none()

    if not presentation or not presentation.file_url:
        raise HTTPException(status_code=404, detail="No presentation file found")

    # Fetch file
    storage = StorageClient()
    # Extract filename from URL
    filename = presentation.file_url.split("/storage/")[-1] if "/storage/" in presentation.file_url else f"{project_id}/presentation.pptx"
    file_data = await storage.get_file(filename)

    if not file_data:
        raise HTTPException(status_code=404, detail="Presentation file not found in storage")

    return StreamingResponse(
        io.BytesIO(file_data),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{project.name}.pptx"'},
    )
