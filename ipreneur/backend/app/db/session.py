"""
Async database engine and session factory.
Supports both PostgreSQL (asyncpg) and SQLite (aiosqlite) for local dev.
"""
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    """All ORM models inherit from this base."""
    pass


# Determine database URL — fallback to SQLite if asyncpg is not available
_db_url = settings.database_url
if "postgresql+asyncpg" in _db_url:
    try:
        import asyncpg  # noqa: F401
    except ImportError:
        # Fallback to SQLite for local development
        import os
        _db_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        _db_path = os.path.join(_db_dir, "ipreneur.db")
        _db_url = f"sqlite+aiosqlite:///{_db_path}"

engine = create_async_engine(
    _db_url,
    pool_size=settings.database_pool_size if "sqlite" not in _db_url else 5,
    max_overflow=settings.database_max_overflow if "sqlite" not in _db_url else 0,
    echo=settings.app_debug,
    future=True,
    **({} if "sqlite" not in _db_url else {"pool_pre_ping": True}),
)

AsyncSessionFactory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


@asynccontextmanager
async def get_db_context() -> AsyncGenerator[AsyncSession, None]:
    """Context manager for non-request DB sessions (e.g. Celery tasks)."""
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for request-scoped DB sessions."""
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Create all tables. Only used in dev/testing. Prod uses Alembic migrations."""
    from sqlalchemy import text

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Lightweight dev migration: create_all won't ADD columns to existing
        # tables. Add any missing project columns (SQLite dev only).
        if "sqlite" in _db_url:
            rows = await conn.exec_driver_sql("PRAGMA table_info('projects')")
            cols = {r[1] for r in rows.fetchall()}
            _dev_add_cols = {
                "template_key": "VARCHAR(32)",
                "assets": "TEXT",  # JSONType serializes to TEXT on SQLite
            }
            for col, ddl in _dev_add_cols.items():
                if col not in cols:
                    await conn.exec_driver_sql(f"ALTER TABLE projects ADD COLUMN {col} {ddl}")


async def drop_db() -> None:
    """Drop all tables. Only for testing."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
