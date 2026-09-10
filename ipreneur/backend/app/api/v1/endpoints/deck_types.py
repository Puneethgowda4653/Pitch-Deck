"""
Deck-type catalogue endpoint.

The new-project form renders its deck-type picker and its per-type fields from
this response rather than from a hard-coded copy of the registry, so the form
cannot drift from what the generation prompt actually consumes.
"""
from fastapi import APIRouter

from app.decks.registry import serialize_deck_types

router = APIRouter()


@router.get("")
async def list_deck_types() -> dict:
    """Every deck type: label, description, slide count, and its intake fields."""
    return {"data": serialize_deck_types()}
