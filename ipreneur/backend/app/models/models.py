"""
SQLAlchemy ORM models for iPreneur.
All models use UUID primary keys and soft-delete patterns.
Compatible with both PostgreSQL and SQLite.
"""
import uuid
import json
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    TypeDecorator,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


# ─── Custom JSON type that works with both PostgreSQL and SQLite ──────────────

class JSONType(TypeDecorator):
    """Platform-independent JSON type. Uses JSONB on PostgreSQL, TEXT on SQLite."""
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return json.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return json.loads(value)
        return value


# ─── User ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512))
    role: Mapped[str] = mapped_column(
        String(20),
        default="free",
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    projects: Mapped[list["Project"]] = relationship("Project", back_populates="user")
    subscriptions: Mapped[list["Subscription"]] = relationship(
        "Subscription", back_populates="user"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"


# ─── Project ──────────────────────────────────────────────────────────────────

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_url: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        default="draft",
        nullable=False,
    )

    # JSON blobs for flexible AI-generated data
    branding_data: Mapped[Optional[dict]] = mapped_column(JSONType)
    research_data: Mapped[Optional[dict]] = mapped_column(JSONType)
    deck_content: Mapped[Optional[dict]] = mapped_column(JSONType)
    error_message: Mapped[Optional[str]] = mapped_column(Text)

    # User-selected deck template (one of the 10 theme keys). Null = use default.
    template_key: Mapped[Optional[str]] = mapped_column(String(32))

    # User-uploaded assets, overlaid on the deck at render time (NOT via the LLM):
    #   {"logo_url": "...", "gallery_images": [{"slot": "g1", "url": "..."}, ...]}
    # logo_url shows on every slide; gallery_images fill the gallery slot tiles.
    assets: Mapped[Optional[dict]] = mapped_column(JSONType)

    # Soft delete
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="projects")
    presentations: Mapped[list["Presentation"]] = relationship(
        "Presentation", back_populates="project"
    )
    jobs: Mapped[list["Job"]] = relationship("Job", back_populates="project")

    def __repr__(self) -> str:
        return f"<Project id={self.id} name={self.name} status={self.status}>"


# ─── Presentation ─────────────────────────────────────────────────────────────

class Presentation(Base):
    __tablename__ = "presentations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    file_url: Mapped[Optional[str]] = mapped_column(String(1024))
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(1024))
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
        nullable=False,
    )
    format: Mapped[str] = mapped_column(
        String(10),
        default="pptx",
        nullable=False,
    )
    slide_count: Mapped[int] = mapped_column(Integer, default=0)
    theme_id: Mapped[Optional[str]] = mapped_column(String(64))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="presentations")


# ─── Job ──────────────────────────────────────────────────────────────────────

class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    status: Mapped[str] = mapped_column(
        String(20),
        default="queued",
        nullable=False,
    )
    current_step: Mapped[Optional[str]] = mapped_column(String(64))
    step_progress: Mapped[int] = mapped_column(Integer, default=0)
    total_progress: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[Optional[str]] = mapped_column(String(512))
    error: Mapped[Optional[str]] = mapped_column(Text)
    result: Mapped[Optional[dict]] = mapped_column(JSONType)

    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="jobs")


# ─── Subscription ─────────────────────────────────────────────────────────────

class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    plan: Mapped[str] = mapped_column(
        String(20),
        default="free",
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="active",
        nullable=False,
    )
    current_period_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Usage tracking (reset monthly)
    projects_used_this_month: Mapped[int] = mapped_column(Integer, default=0)
    exports_used_this_month: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="subscriptions")
