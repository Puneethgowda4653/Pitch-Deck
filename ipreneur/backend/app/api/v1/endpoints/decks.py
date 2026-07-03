"""Decks endpoint — manage deck content and slides."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.db.session import get_db
from app.models.models import User, Project

router = APIRouter()


class DeckContentResponse(BaseModel):
    project_id: str
    deck_content: Optional[dict] = None
    slide_count: int = 0


@router.get("/{project_id}", response_model=DeckContentResponse)
async def get_deck_content(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the deck content for a project."""
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

    slide_count = 0
    if project.deck_content and "slides" in project.deck_content:
        slide_count = len(project.deck_content["slides"])

    return DeckContentResponse(
        project_id=project.id,
        deck_content=project.deck_content,
        slide_count=slide_count,
    )
