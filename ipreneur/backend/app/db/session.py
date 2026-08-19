"""
Async database engine and session factory.
Connects to Supabase-hosted PostgreSQL via asyncpg.
Falls back to SQLite (aiosqlite) if asyncpg is not available.
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
    pool_pre_ping=True,
    # Supabase connection pooler uses PgBouncer in transaction mode,
    # which does not support prepared statements.
    **({} if "sqlite" in _db_url else {"connect_args": {"prepared_statement_cache_size": 0, "statement_cache_size": 0}}),
)

AsyncSessionFactory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
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
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_db() -> None:
    """Drop all tables. Only for testing."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


def _create_background_engine():
    """Create a fresh async engine for use in background threads.

    asyncpg engines are bound to the event loop on which they were created.
    Background threads that spin up their own event loop therefore need their
    own engine instance.
    """
    return create_async_engine(
        _db_url,
        pool_size=2,
        max_overflow=2,
        echo=False,
        future=True,
        pool_pre_ping=True,
        **({} if "sqlite" in _db_url else {"connect_args": {"prepared_statement_cache_size": 0, "statement_cache_size": 0}}),
    )


@asynccontextmanager
async def get_background_db_context() -> AsyncGenerator[AsyncSession, None]:
    """Context manager for DB sessions in background threads (own event loop).

    Creates a disposable engine so the session is not tied to the main loop.
    """
    bg_engine = _create_background_engine()
    factory = async_sessionmaker(bind=bg_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await bg_engine.dispose()
