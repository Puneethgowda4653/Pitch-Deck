"""
Pydantic schemas for Project API endpoints.
Separate from ORM models — schemas handle API I/O, models handle DB.
"""
from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, HttpUrl, ConfigDict, model_validator


class ProjectCreate(BaseModel):
    name: str
    company_url: Optional[HttpUrl] = None
    start_analysis: bool = False
    branding_data: Optional[dict[str, Any]] = None

    @model_validator(mode="after")
    def _require_website_or_manual_context(self) -> "ProjectCreate":
        if self.company_url is None:
            bd = self.branding_data or {}
            if not (bd.get("company_name") and bd.get("problem_statement") and bd.get("solution_description")):
                raise ValueError(
                    "Provide either company_url, or branding_data.company_name + "
                    "problem_statement + solution_description for a no-website project."
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
