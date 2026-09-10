"""
Drift guard for the deck-type registry.

The whole point of `app/decks/` is that a deck's shape is declared once instead
of in five files that must agree. These tests fail the moment a deck type
references a section that does not exist, a skeleton stops matching the model it
is supposed to produce, or a renderer id is added on one side of the stack only.

Run: pytest test_deck_registry.py
"""
import json

import pytest

from app.decks import DECK_TYPES, SECTION_SPECS, resolve_sections, section_by_slide_number
from app.decks.prompt import (
    build_section_rules,
    build_slide_plan,
    build_slides_skeleton,
    build_template_skeleton,
)
from app.decks.registry import DEFAULT_DECK_TYPE, serialize_deck_types

# Renderer ids implemented in
# frontend/src/components/workspace/deckTemplates/TemplatedDeck.tsx.
# Adding a renderer here without adding it there yields a blank slide, so this
# set is the contract between the two halves of the stack.
FRONTEND_RENDERERS = {
    "cover", "summary", "probsol", "product", "market", "model", "traction",
    "competition", "roadmap", "gallery", "team", "ask", "closing",
    "proof", "persona", "vision",
}

# Layouts the PPTX renderer dispatches on (ppt/engine/renderer.py).
PPTX_LAYOUTS = {
    "full_bleed", "big_number", "cards", "two_column",
    "market_sizing", "timeline", "title_bullets",
}

# Intake fields collected by the shared part of the new-project form, which
# every deck type can rely on without declaring a brief field for it.
SHARED_INTAKE_FIELDS = {
    "company_name", "industry", "problem_statement", "solution_description",
    "target_customer", "traction_notes", "competitor_notes", "founders",
}

ALL_SECTION_LISTS = [
    (dt.key, stage, sections)
    for dt in DECK_TYPES.values()
    for stage, sections in [(None, dt.sections), *dt.stage_overrides.items()]
]


def _all_referenced_sections():
    for _, _, sections in ALL_SECTION_LISTS:
        yield from sections


# ─── The catalogue is complete and self-consistent ────────────────────────────

@pytest.mark.parametrize("key", sorted(set(_all_referenced_sections())))
def test_referenced_section_exists(key):
    assert key in SECTION_SPECS, f"deck types reference '{key}' but SECTION_SPECS has no such entry"


@pytest.mark.parametrize("key,spec", sorted(SECTION_SPECS.items()))
def test_spec_is_complete(key, spec):
    assert spec.label, f"{key}: needs a label for the prompt's slide plan"
    assert spec.prompt, f"{key}: needs a one-line prompt instruction"
    assert spec.renderer in FRONTEND_RENDERERS, (
        f"{key}: renderer '{spec.renderer}' is not implemented in TemplatedDeck.tsx"
    )
    assert spec.layout in PPTX_LAYOUTS, f"{key}: layout '{spec.layout}' is not a PPTX layout"
    if spec.model is not None:
        assert spec.skeleton, f"{key}: has a model but no prompt skeleton, so the LLM is never asked for it"


@pytest.mark.parametrize("key,spec", sorted(SECTION_SPECS.items()))
def test_skeleton_matches_its_model(key, spec):
    """The prompt skeleton must actually validate against the model that guards it.

    This is the check that catches a skeleton edited without its model (or the
    reverse) — the failure mode that silently drops a section at runtime, since
    validate_template_data logs and skips a section it cannot parse.
    """
    if spec.model is None or not spec.skeleton:
        pytest.skip("no model/skeleton")
    try:
        payload = json.loads(spec.skeleton)
    except json.JSONDecodeError as exc:
        pytest.fail(f"{key}: skeleton is not valid JSON — {exc}")
    assert isinstance(payload, dict), f"{key}: skeleton must be a JSON object"

    validated = spec.model.model_validate(payload).model_dump()
    # Every key the skeleton asks the model for must survive validation,
    # otherwise the prompt is requesting a field nothing will ever read.
    unknown = set(payload) - set(validated)
    assert not unknown, f"{key}: skeleton asks for fields the model drops: {sorted(unknown)}"


@pytest.mark.parametrize("key,spec", sorted(SECTION_SPECS.items()))
def test_caps_name_real_list_fields(key, spec):
    if spec.model is None:
        assert not spec.caps, f"{key}: caps on a section with no model"
        return
    fields = spec.model.model_fields
    for field_name in spec.caps:
        assert field_name in fields, f"{key}: cap on unknown field '{field_name}'"
        default = spec.model().model_dump().get(field_name)
        assert isinstance(default, list), f"{key}: cap on non-list field '{field_name}'"


# ─── Deck types resolve to sane slide sequences ───────────────────────────────

@pytest.mark.parametrize("key,stage,sections", ALL_SECTION_LISTS)
def test_section_list_is_well_formed(key, stage, sections):
    label = f"{key}" + (f"/{stage}" if stage else "")
    assert sections, f"{label}: empty section list"
    assert sections[0] == "cover", f"{label}: every deck must open on the cover"
    assert sections[-1] == "closing", f"{label}: every deck must end on the closing slide"
    assert len(sections) == len(set(sections)), (
        f"{label}: duplicate section keys — a key can only appear once, "
        "since template_data is keyed by it"
    )


@pytest.mark.parametrize("key,stage,sections", ALL_SECTION_LISTS)
def test_slide_number_map_matches_positions(key, stage, sections):
    mapping = section_by_slide_number(sections)
    for slide_no, section_key in mapping.items():
        assert sections[slide_no - 1] == section_key
    # Cover is the one section with no template_data block of its own.
    assert 1 not in mapping


def test_investor_order_is_unchanged():
    """Regression lock: existing decks were generated against this exact order."""
    assert resolve_sections("investor") == (
        "cover", "summary", "probsol", "product", "market", "model",
        "traction", "competition", "roadmap", "galleryS", "team", "ask", "closing",
    )


def test_unknown_deck_type_falls_back_to_investor():
    assert resolve_sections("nonsense") == resolve_sections(DEFAULT_DECK_TYPE)
    assert resolve_sections(None) == resolve_sections(DEFAULT_DECK_TYPE)


def test_stage_override_only_where_it_changes_something():
    for dt in DECK_TYPES.values():
        for stage, sections in dt.stage_overrides.items():
            assert sections != dt.sections, (
                f"{dt.key}/{stage}: stage override is identical to the default list — "
                "emphasis-only differences belong in STAGE_EMPHASIS, not a fake override"
            )


# ─── Intake contract ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("dt", DECK_TYPES.values(), ids=lambda d: d.key)
def test_manual_required_fields_are_collectable(dt):
    """Every field a type demands must be one the form actually collects."""
    declared = {f.name for f in dt.brief_fields}
    for name in dt.manual_required:
        assert name in SHARED_INTAKE_FIELDS or name in declared, (
            f"{dt.key}: requires '{name}' but neither the shared form nor its "
            "brief_fields collect it, so the project can never be created"
        )


@pytest.mark.parametrize("dt", DECK_TYPES.values(), ids=lambda d: d.key)
def test_brief_field_names_are_unique(dt):
    names = [f.name for f in dt.brief_fields]
    assert len(names) == len(set(names)), f"{dt.key}: duplicate brief field names"


def test_serialize_deck_types_covers_every_type():
    payload = serialize_deck_types()
    assert {d["key"] for d in payload} == set(DECK_TYPES)
    by_key = {d["key"]: d for d in payload}
    for entry in payload:
        assert entry["slide_count"] > 0
        assert entry["research"] in {"full", "light", "none"}
        # The form validates against this list, so it must match the registry.
        assert entry["manual_required"] == list(DECK_TYPES[entry["key"]].manual_required)
    assert by_key["investor"]["manual_required"]


# ─── Prompt assembly produces usable text for every type ──────────────────────

@pytest.mark.parametrize("key,stage,sections", ALL_SECTION_LISTS)
def test_prompt_blocks_build(key, stage, sections):
    plan = build_slide_plan(sections)
    assert plan.count("Slide") == len(sections)

    skeleton = build_template_skeleton(sections)
    parsed = json.loads(skeleton)
    for section_key in sections:
        spec = SECTION_SPECS[section_key]
        if spec.model is not None:
            assert section_key in parsed, f"{key}: '{section_key}' missing from the template_data skeleton"

    build_section_rules(sections)
    assert str(len(sections)) in build_slides_skeleton(sections)
