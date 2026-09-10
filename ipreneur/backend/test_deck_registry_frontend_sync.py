"""
Cross-stack drift guard: the frontend registry must match the backend one.

`frontend/.../deckTypes.ts` mirrors two things from `app/decks/`: each deck
type's slide sequence, and which renderer draws each section key. Nothing at
runtime forces those to agree — a deck type whose lists diverge renders the
wrong slides, and a section missing from the frontend table renders a blank one.

This parses the TypeScript directly rather than duplicating the data a third
time, which would just move the drift somewhere new.

Run: pytest test_deck_registry_frontend_sync.py
"""
import re
from pathlib import Path

import pytest

from app.decks import DECK_TYPES, SECTION_SPECS

DECK_TYPES_TS = (
    Path(__file__).resolve().parent.parent
    / "frontend" / "src" / "components" / "workspace" / "deckTemplates" / "deckTypes.ts"
)


@pytest.fixture(scope="module")
def ts_source() -> str:
    if not DECK_TYPES_TS.exists():
        pytest.skip(f"frontend not present at {DECK_TYPES_TS}")
    return DECK_TYPES_TS.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def ts_sections(ts_source: str) -> dict[str, str]:
    """Section key → renderer id, parsed from the SECTIONS table."""
    block = re.search(
        r"const SECTIONS: Record<string, \{[^}]*\}> = \{(.*?)\n\};",
        ts_source, re.DOTALL,
    )
    assert block, "could not locate the SECTIONS table in deckTypes.ts"
    found = re.findall(r'^\s*(\w+):\s*\{\s*renderer:\s*"([\w]+)"', block.group(1), re.MULTILINE)
    assert found, "parsed the SECTIONS table but found no entries"
    return dict(found)


@pytest.fixture(scope="module")
def ts_deck_types(ts_source: str) -> dict[str, list[str]]:
    """Deck type key → its section list, parsed from DECK_TYPES."""
    block = re.search(r"export const DECK_TYPES: Record<string, DeckTypeSpec> = \{(.*?)\n\};",
                      ts_source, re.DOTALL)
    assert block, "could not locate DECK_TYPES in deckTypes.ts"
    out: dict[str, list[str]] = {}
    for key, sections in re.findall(
        r'key:\s*"(\w+)",.*?sections:\s*\[(.*?)\]', block.group(1), re.DOTALL
    ):
        out[key] = re.findall(r'"(\w+)"', sections)
    assert out, "parsed DECK_TYPES but found no deck types"
    return out


def test_same_deck_types_on_both_sides(ts_deck_types):
    assert set(ts_deck_types) == set(DECK_TYPES), (
        "deck types differ between deckTypes.ts and app/decks/registry.py: "
        f"frontend-only={sorted(set(ts_deck_types) - set(DECK_TYPES))}, "
        f"backend-only={sorted(set(DECK_TYPES) - set(ts_deck_types))}"
    )


@pytest.mark.parametrize("key", sorted(DECK_TYPES))
def test_section_lists_match(key, ts_deck_types):
    """The default slide sequence must be identical on both sides.

    A generated deck persists its own `slide_order` and the frontend prefers
    that, so a mismatch here does not corrupt existing decks — but it does mean
    the two registries disagree about what this deck type is, which is exactly
    what this package exists to prevent.
    """
    if key not in ts_deck_types:
        pytest.fail(f"'{key}' is missing from deckTypes.ts")
    assert ts_deck_types[key] == list(DECK_TYPES[key].sections), (
        f"{key}: section list differs\n"
        f"  backend:  {list(DECK_TYPES[key].sections)}\n"
        f"  frontend: {ts_deck_types[key]}"
    )


def test_every_backend_section_is_drawable(ts_sections):
    missing = sorted(set(SECTION_SPECS) - set(ts_sections))
    assert not missing, (
        f"sections declared in SECTION_SPECS but absent from deckTypes.ts, "
        f"so they would render as a blank slide: {missing}"
    )


def test_no_orphan_frontend_sections(ts_sections):
    orphans = sorted(set(ts_sections) - set(SECTION_SPECS))
    assert not orphans, (
        f"deckTypes.ts declares sections the backend never produces: {orphans}"
    )


@pytest.mark.parametrize("key", sorted(SECTION_SPECS))
def test_renderer_ids_match(key, ts_sections):
    assert ts_sections.get(key) == SECTION_SPECS[key].renderer, (
        f"{key}: renderer differs — backend says '{SECTION_SPECS[key].renderer}', "
        f"deckTypes.ts says '{ts_sections.get(key)}'"
    )
