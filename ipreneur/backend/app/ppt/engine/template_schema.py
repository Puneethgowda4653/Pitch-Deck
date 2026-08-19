"""
Validation for MasterDeckAgent's `template_data` payload.

The LLM returns a large, free-form JSON object (schema documented in
`master_agent.py`'s generation prompt). Each section is validated
INDEPENDENTLY here — a malformed/missing section is dropped (with a logged
reason) rather than invalidating the whole deck, so one bad section degrades
a single slide gracefully instead of breaking rendering.

`_TEMPLATE_SECTION_BY_SLIDE_NUMBER` maps a slide's fixed position (the prompt
enforces an exact 12-slide order) to its `template_data` section — slide
POSITION is used rather than the LLM-chosen `slide_type` string, since
`SlideContent.slide_number` is assigned deterministically by array index
(see `master_agent.py`'s `generate()`), while `slide_type` is free text the
model can phrase inconsistently.
"""
from typing import Optional

from loguru import logger
from pydantic import BaseModel, ValidationError, field_validator


def _coerce_number(val):
    """Traction series / ask percentages sometimes arrive as strings ("2", "15%")."""
    if isinstance(val, (int, float)):
        return val
    if isinstance(val, str):
        import re
        m = re.search(r"[-+]?\d*\.?\d+", val)
        if m:
            return float(m.group())
    return 0


class KpiTile(BaseModel):
    k: str = ""
    l: str = ""


class ProbSolItem(BaseModel):
    k: str = ""
    t: str = ""


class SummarySection(BaseModel):
    headline: str = ""
    lead: str = ""
    highlights: list[KpiTile] = []


class ProbSolSection(BaseModel):
    headline: str = ""
    sub: str = ""
    problemTitle: str = ""
    problemLead: str = ""
    solutionTitle: str = ""
    solutionLead: str = ""
    problem: list[ProbSolItem] = []
    solution: list[ProbSolItem] = []
    problemFoot: str = ""
    solutionFoot: str = ""


class ProductStep(BaseModel):
    n: str = ""
    t: str = ""
    d: str = ""
    tags: list[str] = []


class ProductSection(BaseModel):
    headline: str = ""
    sub: str = ""
    steps: list[ProductStep] = []


class MarketPoint(BaseModel):
    v: str = ""
    l: str = ""


class MarketSection(BaseModel):
    headline: str = ""
    tam: MarketPoint = MarketPoint()
    sam: MarketPoint = MarketPoint()
    som: MarketPoint = MarketPoint()
    note: str = ""


class ModelStream(BaseModel):
    t: str = ""
    d: str = ""
    v: str = ""
    vl: str = ""


class ModelTier(BaseModel):
    t: str = ""
    p: str = ""
    s: str = ""
    d: str = ""


class ModelSection(BaseModel):
    headline: str = ""
    flow: list[str] = []
    streams: list[ModelStream] = []
    tiers: list[ModelTier] = []


class TractionPoint(BaseModel):
    y: str = ""
    v: float = 0

    @field_validator("v", mode="before")
    @classmethod
    def _coerce_v(cls, val):
        return _coerce_number(val)


class TractionSection(BaseModel):
    headline: str = ""
    sub: str = ""
    series: list[TractionPoint] = []
    kpis: list[KpiTile] = []


class CompetitionRow(BaseModel):
    f: str = ""
    v: list[bool] = []


class CompetitionSection(BaseModel):
    headline: str = ""
    cols: list[str] = []
    rows: list[CompetitionRow] = []


class TeamMember(BaseModel):
    i: str = ""
    n: str = ""
    r: str = ""
    b: str = ""


class TeamSection(BaseModel):
    headline: str = ""
    members: list[TeamMember] = []
    advisors: str = ""


class AskItem(BaseModel):
    l: str = ""
    p: float = 0

    @field_validator("p", mode="before")
    @classmethod
    def _coerce_p(cls, val):
        return _coerce_number(val)


class AskSection(BaseModel):
    headline: str = ""
    sub: str = ""
    use: list[AskItem] = []


class ClosingSection(BaseModel):
    headline: str = ""
    sub: str = ""
    contact: str = ""
    site: str = ""


class RoadmapItem(BaseModel):
    q: str = ""
    t: str = ""
    d: str = ""


class RoadmapSection(BaseModel):
    headline: str = ""
    sub: str = ""
    items: list[RoadmapItem] = []


class GallerySlot(BaseModel):
    id: str = ""
    ph: str = ""
    span: bool = False


class GallerySection(BaseModel):
    headline: str = ""
    sub: str = ""
    slots: list[GallerySlot] = []


_SECTION_MODELS: dict[str, type[BaseModel]] = {
    "summary": SummarySection,
    "probsol": ProbSolSection,
    "product": ProductSection,
    "market": MarketSection,
    "model": ModelSection,
    "traction": TractionSection,
    "competition": CompetitionSection,
    "team": TeamSection,
    "ask": AskSection,
    "closing": ClosingSection,
    "roadmap": RoadmapSection,
    "galleryS": GallerySection,
}

# Hard caps matching what the generation prompt already asks for — codifies
# intent as a safety net instead of only hoping the model honors it.
_CAPS: dict[str, dict[str, int]] = {
    "summary": {"highlights": 4},
    "probsol": {"problem": 3, "solution": 3},
    "product": {"steps": 3},
    "model": {"streams": 3, "tiers": 3},
    "traction": {"series": 8, "kpis": 4},
    "competition": {"rows": 6, "cols": 4},
    "team": {"members": 4},
    "ask": {"use": 4},
    "roadmap": {"items": 4},
    "galleryS": {"slots": 5},
}

# Passed through as-is (top-level scalars, not a nested section).
_PASSTHROUGH_KEYS = ("company", "mark", "tagline", "eyebrow", "year", "round", "theme_suggestion")

# Maps a slide's fixed position (see module docstring) to its template_data
# section. Slide 1 (Cover) uses the passthrough keys directly; slide 3
# (Market Opportunity) has no dedicated section in this schema and stays on
# SlideContent alone.
TEMPLATE_SECTION_BY_SLIDE_NUMBER: dict[int, str] = {
    2: "summary",
    4: "probsol",
    5: "product",
    6: "model",
    7: "traction",
    8: "competition",
    9: "team",
    10: "market",
    11: "ask",
    12: "closing",
}


def validate_template_data(raw: dict) -> dict:
    """Validate + cap each section of `template_data` independently.

    A section that fails validation is dropped (logged), not fatal — callers
    (the renderer) already treat a missing section as "fall back to
    SlideContent for this slide", so dropping here is a safe degrade.
    """
    if not isinstance(raw, dict):
        return {}

    out: dict = {k: raw[k] for k in _PASSTHROUGH_KEYS if k in raw}

    for key, model in _SECTION_MODELS.items():
        section = raw.get(key)
        if not isinstance(section, dict):
            continue
        try:
            validated = model.model_validate(section).model_dump()
        except ValidationError as exc:
            logger.warning(f"template_data.{key} failed validation, dropping: {exc}")
            continue

        for list_field, cap in _CAPS.get(key, {}).items():
            if isinstance(validated.get(list_field), list):
                validated[list_field] = validated[list_field][:cap]

        out[key] = validated

    return out
