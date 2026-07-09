"""
Deck themes — Python port of the frontend theme tokens.

Mirrors `frontend/src/components/workspace/deckTemplates/themes.ts` so the
downloaded PPTX matches the template the user selected and previewed in the
module. Keep the two files in sync: same keys, same colors, same light/dark
mode. Each theme is a design-token set the renderer maps onto slide elements.
"""
from typing import Optional

# key -> tokens. Fields mirror the TS `Theme` interface (color + mode subset
# the PPTX renderer needs). `mode` drives light-vs-dark handling in the palette.
THEMES: dict[str, dict] = {
    "meridian":  {"name": "Meridian Navy",   "mode": "dark",  "bg": "#0A1838", "surface": "#102350", "text": "#EAF0FF", "muted": "#9DB0D6", "accent": "#5B8DEF", "accent2": "#62D6C4"},
    "onyx":      {"name": "Onyx Coral",       "mode": "dark",  "bg": "#141519", "surface": "#1E2027", "text": "#F5F5F6", "muted": "#A1A3AD", "accent": "#FF6B53", "accent2": "#FFC178"},
    "abyss":     {"name": "Abyss Teal",       "mode": "dark",  "bg": "#04212A", "surface": "#0A3340", "text": "#E6F6F4", "muted": "#8DB8B6", "accent": "#27D2C1", "accent2": "#56B8FF"},
    "nocturne":  {"name": "Nocturne Violet",  "mode": "dark",  "bg": "#130D2C", "surface": "#1F1745", "text": "#F1ECFF", "muted": "#A99FCB", "accent": "#9A7BFF", "accent2": "#FF8FCB"},
    "forest":    {"name": "Forest Lime",      "mode": "dark",  "bg": "#0B1D15", "surface": "#112C20", "text": "#E9F3EC", "muted": "#92B5A1", "accent": "#3FBF7A", "accent2": "#C4E25F"},
    "verdant":   {"name": "Verdant",          "mode": "light", "bg": "#F5F8F4", "surface": "#FFFFFF", "text": "#152319", "muted": "#566359", "accent": "#1F8A5B", "accent2": "#5FA63C"},
    "indigo":    {"name": "Indigo SaaS",      "mode": "light", "bg": "#F4F4FB", "surface": "#FFFFFF", "text": "#15152E", "muted": "#5C5C78", "accent": "#4F46E5", "accent2": "#0EA5B7"},
    "editorial": {"name": "Editorial Mono",   "mode": "light", "bg": "#FAFAF7", "surface": "#FFFFFF", "text": "#121211", "muted": "#6B6B63", "accent": "#16150F", "accent2": "#C2410C"},
    "terra":     {"name": "Terracotta",       "mode": "light", "bg": "#FBF4EC", "surface": "#FFFFFF", "text": "#2A1D14", "muted": "#7C6A5B", "accent": "#C2683D", "accent2": "#7C8B4F"},
    "slate":     {"name": "Slate Amber",      "mode": "light", "bg": "#F3F6F8", "surface": "#FFFFFF", "text": "#162033", "muted": "#586677", "accent": "#E08A0B", "accent2": "#2563EB"},
}

DEFAULT_THEME_KEY = "meridian"


def get_theme(key: Optional[str]) -> dict:
    """Return the theme tokens for `key`, falling back to the default theme."""
    return THEMES.get(key or DEFAULT_THEME_KEY, THEMES[DEFAULT_THEME_KEY])
