"""
API v1 router — registers all endpoint modules.
Each domain has its own router module for clean separation.
"""
from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    projects,
    decks,
    presentations,
    users,
    billing,
    webhooks,
    pipeline,
)

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(projects.router, prefix="/projects", tags=["projects"])
router.include_router(decks.router, prefix="/decks", tags=["decks"])
router.include_router(presentations.router, prefix="/presentations", tags=["presentations"])
router.include_router(billing.router, prefix="/billing", tags=["billing"])
router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
router.include_router(pipeline.router, prefix="/pipeline", tags=["pipeline"])
