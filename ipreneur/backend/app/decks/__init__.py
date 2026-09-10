"""
Deck types — what a deck is, declared once.

`registry.py` owns the deck types and their slide sequences; `sections.py` owns
the section catalogue (model + renderer + prompt skeleton per section key);
`prompt.py` assembles the generation prompt from both.
"""
from app.decks.registry import (
    DECK_TYPES,
    DEFAULT_DECK_FORMAT,
    DEFAULT_DECK_TYPE,
    BriefField,
    DeckType,
    format_guidance,
    get_deck_type,
    required_manual_fields,
    resolve_sections,
    section_by_slide_number,
    serialize_deck_types,
    stage_emphasis,
)
from app.decks.sections import PASSTHROUGH_KEYS, SECTION_SPECS, SectionSpec

__all__ = [
    "DECK_TYPES",
    "DEFAULT_DECK_FORMAT",
    "DEFAULT_DECK_TYPE",
    "PASSTHROUGH_KEYS",
    "SECTION_SPECS",
    "BriefField",
    "DeckType",
    "SectionSpec",
    "format_guidance",
    "get_deck_type",
    "required_manual_fields",
    "resolve_sections",
    "section_by_slide_number",
    "serialize_deck_types",
    "stage_emphasis",
]
