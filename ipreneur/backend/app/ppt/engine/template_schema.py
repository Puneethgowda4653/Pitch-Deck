"""
Validation for MasterDeckAgent's `template_data` payload.

The section models and the slide→section map used to live here, hard-coded to
the one 12-slide investor deck. They now live in `app/decks/` so that every deck
type derives from the same declaration; this module is the validation entry
point over that registry.

Each section is validated INDEPENDENTLY — a malformed or missing section is
dropped (with a logged reason) rather than invalidating the whole deck, so one
bad section degrades a single slide gracefully instead of breaking rendering.
The renderer already treats a missing section as "fall back to SlideContent for
this slide", which is what makes dropping safe.
"""
from typing import Optional, Sequence

from loguru import logger

from app.decks.registry import resolve_sections, section_by_slide_number
from app.decks.sections import PASSTHROUGH_KEYS, SECTION_SPECS, _coerce_number

# Re-exported for the PPTX renderer, which coerces money strings to floats.
__all__ = [
    "validate_template_data",
    "section_by_slide_number",
    "TEMPLATE_SECTION_BY_SLIDE_NUMBER",
    "_coerce_number",
]

# Back-compat: the investor deck's positional map, for callers that predate
# multi-deck support and pass no section list of their own.
TEMPLATE_SECTION_BY_SLIDE_NUMBER: dict[int, str] = section_by_slide_number(resolve_sections("investor"))


def validate_template_data(raw: dict, sections: Optional[Sequence[str]] = None) -> dict:
    """Validate + cap each section of `template_data`.

    `sections` is the deck's resolved section list; when omitted every known
    section is accepted, which is what an edit-time merge wants (it only sees a
    partial payload and has no deck context to hand).
    """
    if not isinstance(raw, dict):
        return {}

    allowed = set(sections) if sections is not None else set(SECTION_SPECS)
    out: dict = {k: raw[k] for k in PASSTHROUGH_KEYS if k in raw}

    for key, spec in SECTION_SPECS.items():
        if spec.model is None or key not in allowed:
            continue
        section = raw.get(key)
        if not isinstance(section, dict):
            continue
        try:
            validated = spec.model.model_validate(section).model_dump()
        except Exception as exc:  # pydantic ValidationError, or a bad shape
            logger.warning(f"template_data.{key} failed validation, dropping: {exc}")
            continue

        for list_field, cap in spec.caps.items():
            if isinstance(validated.get(list_field), list):
                validated[list_field] = validated[list_field][:cap]

        out[key] = validated

    return out
