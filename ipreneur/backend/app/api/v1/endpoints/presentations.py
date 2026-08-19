"""Presentations endpoint — download/export generated presentations."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import io

from loguru import logger

from app.api.deps.auth import get_current_user
from app.models.models import User, Project, Presentation
from app.db.session import get_db
from app.services.storage.s3_client import StorageClient
from app.agents.content.content_agent import DeckContent, SlideContent
from app.services.branding.extractor import BrandingData
from app.ppt.engine.renderer import PPTRenderer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


def _deck_content_from_dict(data: dict) -> DeckContent:
    """Rebuild a DeckContent from the JSON blob stored on the project.

    `DeckContent.model_dump()` adds a few convenience keys (id/type/content)
    that aren't constructor args, so filter down to the real dataclass fields.
    """
    slides: list[SlideContent] = []
    for s in (data or {}).get("slides", []):
        slides.append(
            SlideContent(
                slide_number=s.get("slide_number", len(slides) + 1),
                slide_type=s.get("slide_type") or s.get("type", ""),
                layout=s.get("layout", "title_bullets"),
                title=s.get("title", ""),
                subtitle=s.get("subtitle", ""),
                body=s.get("body") if s.get("body") is not None else s.get("content", ""),
                bullet_points=s.get("bullet_points", []) or [],
                data_points=s.get("data_points", []) or [],
                cards=s.get("cards", []) or [],
                columns=s.get("columns", []) or [],
                speaker_notes=s.get("speaker_notes", ""),
            )
        )
    return DeckContent(
        slides=slides,
        deck_title=(data or {}).get("deck_title", ""),
        deck_subtitle=(data or {}).get("deck_subtitle", ""),
    )


@router.get("/{project_id}/download")
async def download_presentation(
    project_id: str,
    format: str = "pptx",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download the generated PPTX for a project.

    The deck is re-rendered on demand from the stored deck content using the
    project's currently selected template, so the download always matches the
    theme the user picked in the module (rather than a stale pre-rendered file).
    """
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

    # Re-render from stored deck content with the currently selected template.
    if project.deck_content and project.deck_content.get("slides"):
        try:
            deck_content = _deck_content_from_dict(project.deck_content)
            branding = BrandingData(**{
                k: v for k, v in (project.branding_data or {}).items()
                if k in BrandingData.__dataclass_fields__
            })

            # Overlay the uploaded logo if present
            logo_bytes = None
            logo_url = (project.assets or {}).get("logo_url")
            if logo_url:
                from app.services.images.image_service import fetch_image_bytes
                logo_bytes = await fetch_image_bytes(logo_url)

            renderer = PPTRenderer()
            file_data = await renderer.render(
                deck_content=deck_content,
                branding=branding,
                logo_bytes=logo_bytes,
                template_key=project.template_key,
                template_data=(project.deck_content or {}).get("template_data"),
            )
            return StreamingResponse(
                io.BytesIO(file_data),
                media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
                headers={"Content-Disposition": f'attachment; filename="{project.name}.pptx"'},
            )
        except Exception as exc:
            # Fall back to the stored file rather than failing the download.
            logger.warning(f"On-demand re-render failed for {project_id}, serving stored file: {exc}")

    # Fallback: serve the last pre-rendered file from storage.
    result = await db.execute(
        select(Presentation).where(
            Presentation.project_id == project_id,
            Presentation.status == "ready",
        ).order_by(Presentation.created_at.desc()).limit(1)
    )
    presentation = result.scalar_one_or_none()

    if not presentation or not presentation.file_url:
        raise HTTPException(status_code=404, detail="No presentation file found")

    storage = StorageClient()
    # Object key always follows this convention (see upload_pptx call sites) — deriving it
    # directly is more robust than parsing file_url, whose shape differs between the local
    # fallback ("/storage/{key}") and a real storage provider's URL structure.
    filename = f"{project_id}/presentation.pptx"
    file_data = await storage.get_file(filename)

    if not file_data:
        raise HTTPException(status_code=404, detail="Presentation file not found in storage")

    return StreamingResponse(
        io.BytesIO(file_data),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{project.name}.pptx"'},
    )
