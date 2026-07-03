"""
iPreneur Backend — FastAPI Application Entry Point

Architecture:
  - Async FastAPI with lifespan context
  - Modular router registration
  - Middleware stack: CORS, Auth, Logging, Error handling
  - Startup: DB init
"""
import sys
import asyncio

# Playwright requires subprocess support — WindowsSelectorEventLoop (Windows default)
# does not support subprocesses; ProactorEventLoop does.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

from app.core.config import settings
from app.db.session import engine, init_db


# ─── Logging ──────────────────────────────────────────────────────────────────
# SECURITY: loguru's default handler has diagnose=True, which dumps every frame's
# local variables into tracebacks. Those locals include API keys (e.g. the Gemini
# key inside genai_client). Reconfigure with diagnose=False so secrets never reach
# the logs. backtrace=True keeps the stack readable without printing values.
logger.remove()
logger.add(
    sys.stderr,
    level=settings.log_level,
    backtrace=True,
    diagnose=False,
)


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup and shutdown lifecycle."""
    logger.info(f"🚀 Starting {settings.app_name} [{settings.app_env}]")

    # Create tables in dev
    if not settings.is_production:
        await init_db()
        logger.info("✅ Database tables ensured")

    yield  # App runs here

    logger.info("🔴 Shutting down")
    await engine.dispose()


# ─── Application Factory ──────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description="AI-powered investor pitch deck generator",
        version="1.0.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # ── Middleware ───────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Static: user-uploaded assets (logo, gallery photos) ──────────────────
    import os
    from fastapi.staticfiles import StaticFiles
    from app.services.storage import UPLOAD_DIR
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

    # ── Routers ──────────────────────────────────────────────────────────────
    from app.api.v1.routes import router as api_v1_router
    app.include_router(api_v1_router, prefix="/api/v1")

    # ── Global Exception Handler ─────────────────────────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(f"Unhandled exception: {exc}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
            },
        )

    # ── Health Check ─────────────────────────────────────────────────────────
    @app.get("/health", tags=["infra"])
    async def health_check():
        return {"status": "ok", "app": settings.app_name, "env": settings.app_env}

    return app


app = create_app()
