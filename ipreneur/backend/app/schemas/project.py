"""
Pydantic schemas for Project API endpoints.
Separate from ORM models — schemas handle API I/O, models handle DB.
"""
from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, HttpUrl, ConfigDict, field_validator, model_validator

from app.decks.registry import (
    DECK_TYPES,
    DEFAULT_DECK_TYPE,
    get_deck_type,
    required_manual_fields,
)


class ProjectCreate(BaseModel):
    name: str
    company_url: Optional[HttpUrl] = None
    start_analysis: bool = False
    branding_data: Optional[dict[str, Any]] = None
    deck_type: str = DEFAULT_DECK_TYPE

    @field_validator("deck_type")
    @classmethod
    def _known_deck_type(cls, v: str) -> str:
        if v not in DECK_TYPES:
            raise ValueError(f"Unknown deck type '{v}'. Expected one of: {', '.join(sorted(DECK_TYPES))}")
        return v

    @model_validator(mode="after")
    def _require_context_for_deck_type(self) -> "ProjectCreate":
        """Each deck type declares what it cannot be generated without.

        Two separate gates: a type's own required brief fields are needed even
        when a website exists (crawling a site tells us nothing about which
        buyer this sales deck is aimed at), while `manual_required` covers the
        extra context a project with no site to crawl has no other source for.
        """
        bd = self.branding_data or {}

        def _missing(names) -> list[str]:
            return [n for n in names if not str(bd.get(n) or "").strip()]

        dt = get_deck_type(self.deck_type)

        required_brief = [f.name for f in dt.brief_fields if f.required]
        missing = _missing(required_brief)
        if missing:
            labels = {f.name: f.label for f in dt.brief_fields}
            raise ValueError(
                f"{dt.label} decks need: " + ", ".join(labels.get(m, m) for m in missing)
            )

        if self.company_url is None:
            missing = _missing(required_manual_fields(self.deck_type))
            if missing:
                raise ValueError(
                    "Without a website we need these details instead: "
                    + ", ".join(m.replace("_", " ") for m in missing)
                )
        return self


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    template_key: Optional[str] = None
    # Flat, narrowly named on purpose: a nested `deck_content` field would invite
    # passing `slides`/`deck_title` through the same channel, reintroducing the
    # accidental-full-overwrite risk the merge logic in update_project() avoids.
    template_data: Optional[dict[str, Any]] = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    company_url: Optional[str] = None
    status: str
    branding_data: Optional[dict] = None
    research_data: Optional[dict] = None
    deck_content: Optional[dict] = None
    error_message: Optional[str] = None
    deck_type: str = DEFAULT_DECK_TYPE
    template_key: Optional[str] = None
    assets: Optional[dict] = None
    created_at: datetime
    updated_at: datetime


class ProjectListResponse(BaseModel):
    data: list[ProjectResponse]
    total: int
    page: int
    page_size: int
    has_next_page: bool


class JobProgressResponse(BaseModel):
    job_id: str
    project_id: str
    status: str
    current_step: str
    step_progress: int
    total_progress: int
    message: str
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
