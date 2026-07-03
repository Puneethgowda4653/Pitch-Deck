"""Webhooks endpoint — handles Stripe webhook events (placeholder)."""
from fastapi import APIRouter, Request

router = APIRouter()


@router.post("/stripe")
async def stripe_webhook(request: Request):
    """Handle incoming Stripe webhook events."""
    # TODO: Implement Stripe webhook handling
    return {"received": True}
