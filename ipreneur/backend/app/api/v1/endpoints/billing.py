"""Billing endpoints — subscription management and plan info."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps.auth import get_current_user
from app.models.models import User

router = APIRouter()


class PlanInfo(BaseModel):
    plan: str
    projects_limit: int
    exports_limit: int
    is_active: bool


PLAN_LIMITS = {
    "free": {"projects_limit": 3, "exports_limit": 3},
    "pro": {"projects_limit": 50, "exports_limit": 50},
    "enterprise": {"projects_limit": -1, "exports_limit": -1},
    "admin": {"projects_limit": -1, "exports_limit": -1},
}


@router.get("/plan", response_model=PlanInfo)
async def get_current_plan(current_user: User = Depends(get_current_user)):
    """Get the current user's subscription plan."""
    limits = PLAN_LIMITS.get(current_user.role, PLAN_LIMITS["free"])
    return PlanInfo(
        plan=current_user.role,
        projects_limit=limits["projects_limit"],
        exports_limit=limits["exports_limit"],
        is_active=current_user.is_active,
    )


class PlanSummary(BaseModel):
    name: str
    price: str
    features: list[str]


@router.get("/plans", response_model=list[PlanSummary])
async def list_plans():
    """List available subscription plans."""
    return [
        PlanSummary(
            name="Free",
            price="$0/mo",
            features=["3 pitch decks/month", "Basic templates", "PPTX export"],
        ),
        PlanSummary(
            name="Pro",
            price="$29/mo",
            features=["50 pitch decks/month", "Premium templates", "PPTX + PDF export", "Priority AI processing"],
        ),
        PlanSummary(
            name="Enterprise",
            price="Custom",
            features=["Unlimited decks", "Custom branding", "API access", "Team collaboration", "Dedicated support"],
        ),
    ]
