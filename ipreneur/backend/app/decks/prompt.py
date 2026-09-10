"""
Generation-prompt assembly.

The slide plan, the per-section rules, the `template_data` skeleton and the
`slides[]` skeleton were all hand-written literals inside
`master_agent._build_generation_prompt`. They are now built here from the
resolved section list, so a deck type's shape is stated once (in `registry.py`)
instead of being retyped per type.

Everything these functions return is plain text destined for a single `{}` slot
in the prompt's f-string, so the JSON braces inside need no escaping.
"""
from typing import Optional, Sequence

from app.decks.registry import (
    DeckType,
    format_guidance,
    get_deck_type,
    stage_emphasis,
)
from app.decks.sections import SECTION_SPECS

# Layouts the legacy slides[] renderer knows how to dispatch on.
_LEGACY_LAYOUTS = {"full_bleed", "big_number", "cards", "two_column", "market_sizing", "timeline", "title_bullets"}


def build_type_header(
    deck_type: Optional[str],
    *,
    stage: Optional[str] = None,
    deck_format: Optional[str] = None,
) -> str:
    """Audience, goal, per-type guidance, plus stage and format modifiers."""
    dt: DeckType = get_deck_type(deck_type)
    parts = [
        f"DECK TYPE: {dt.label}",
        f"AUDIENCE: {dt.audience}",
        f"GOAL: {dt.goal}",
    ]
    if dt.guidance:
        parts.append("\nHOW THIS TYPE MUST BE WRITTEN:\n" + dt.guidance)

    emphasis = stage_emphasis(stage) if dt.key == "investor" else ""
    if emphasis:
        parts.append("\n" + emphasis)

    parts.append("\n" + format_guidance(deck_format))
    return "\n".join(parts)


def build_slide_plan(sections: Sequence[str]) -> str:
    """The numbered slide list: position, title, layout tag, one-line brief."""
    lines = []
    for i, key in enumerate(sections, start=1):
        spec = SECTION_SPECS.get(key)
        if not spec:
            continue
        layout = spec.layout if spec.layout in _LEGACY_LAYOUTS else "title_bullets"
        lines.append(f"  Slide {i:>2}: {spec.label:<26} [{layout}] — {spec.prompt}")
    return "\n".join(lines)


def build_section_rules(sections: Sequence[str]) -> str:
    """The detailed rules blocks, for the sections that have them."""
    blocks = []
    for i, key in enumerate(sections, start=1):
        spec = SECTION_SPECS.get(key)
        if not spec or not spec.rules:
            continue
        blocks.append(f"  Slide {i} ({spec.label}) — template_data.{key}:\n" +
                      "\n".join(f"    {line}" for line in spec.rules.splitlines()))
    return "\n\n".join(blocks)


def build_template_skeleton(sections: Sequence[str]) -> str:
    """The `template_data` object the model must return, for these sections only."""
    lines = ['    "company": "Company name",',
             '    "mark": "1-2 letter monogram",',
             '    "tagline": "one-line value proposition",',
             '    "eyebrow": "<the deck-type eyebrow given above>",',
             '    "year": "2026",',
             '    "round": "context line under the company name on the cover",',
             '    "theme_suggestion": "one of: meridian, onyx, abyss, nocturne, forest, verdant, indigo, editorial, terra, slate",']
    entries = []
    for key in sections:
        spec = SECTION_SPECS.get(key)
        if not spec or not spec.model or not spec.skeleton:
            continue
        entries.append(f'    "{key}": {spec.skeleton}')
    return "{\n" + "\n".join(lines) + "\n" + ",\n".join(entries) + "\n  }"


def build_slides_skeleton(sections: Sequence[str]) -> str:
    """Two representative `slides[]` entries plus the ordering contract.

    The full array is one object per slide in the plan, in that exact order —
    spelling out all of them would triple the prompt for no extra signal.
    """
    if not sections:
        return "[]"
    first = SECTION_SPECS.get(sections[0])
    second = next((SECTION_SPECS.get(k) for k in sections[1:] if SECTION_SPECS.get(k)), None)

    def _entry(spec, slide_type: str) -> str:
        layout = spec.layout if spec.layout in _LEGACY_LAYOUTS else "title_bullets"
        return (
            '    {\n'
            f'      "slide_type": "{slide_type}",\n'
            f'      "layout": "{layout}",\n'
            '      "title": "...", "subtitle": "...", "body": "...",\n'
            '      "bullet_points": [], "data_points": [], "cards": [], "columns": [],\n'
            '      "speaker_notes": "..."\n'
            '    }'
        )

    parts = [_entry(first, sections[0])]
    if second:
        parts.append(_entry(second, sections[1]))
    return "[\n" + ",\n".join(parts) + f"\n    ... one object per slide in the plan above, {len(sections)} in total, in that exact order\n  ]"


def build_generation_sections(
    deck_type: Optional[str],
    sections: Sequence[str],
    *,
    stage: Optional[str] = None,
    deck_format: Optional[str] = None,
) -> dict[str, str]:
    """Every deck-type-dependent block the generation prompt needs."""
    dt = get_deck_type(deck_type)
    return {
        "type_header": build_type_header(deck_type, stage=stage, deck_format=deck_format),
        "slide_plan": build_slide_plan(sections),
        "section_rules": build_section_rules(sections),
        "template_skeleton": build_template_skeleton(sections),
        "slides_skeleton": build_slides_skeleton(sections),
        "slide_count": str(len(sections)),
        "eyebrow": dt.eyebrow,
        "label": dt.label,
    }
