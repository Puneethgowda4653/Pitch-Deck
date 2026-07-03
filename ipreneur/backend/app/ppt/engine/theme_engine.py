"""
Theme Engine — Applies brand colors, fonts, and visual identity to slides.

Manages:
- Color palette from branding data
- Font assignments
- Background fills
- Gradient definitions
- Accent shapes and lines
"""
from dataclasses import dataclass
from typing import Optional

from pptx.dml.color import RGBColor
from pptx.util import Pt


def hex_to_rgb(hex_color: str) -> RGBColor:
    """Convert #RRGGBB hex to pptx RGBColor."""
    hex_color = hex_color.lstrip("#")
    r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    return RGBColor(r, g, b)


@dataclass
class ThemeEngine:
    """
    Encapsulates all visual theming decisions.
    Used by SlideFactory to apply consistent styling.
    """
    theme_data: dict

    @property
    def primary(self) -> RGBColor:
        return hex_to_rgb(self.theme_data.get("primary_color", "#2540B5"))

    @property
    def secondary(self) -> RGBColor:
        return hex_to_rgb(self.theme_data.get("secondary_color", "#7B2CBF"))

    @property
    def background(self) -> RGBColor:
        return hex_to_rgb(self.theme_data.get("background_color", "#0A0716"))

    @property
    def surface(self) -> RGBColor:
        return hex_to_rgb(self.theme_data.get("surface_color", "#1A1130"))

    @property
    def text_primary(self) -> RGBColor:
        return hex_to_rgb(self.theme_data.get("text_color", "#F5F3FF"))

    @property
    def text_secondary(self) -> RGBColor:
        return hex_to_rgb("#9B8EC4")

    @property
    def accent(self) -> RGBColor:
        return hex_to_rgb(self.theme_data.get("accent_color", "#7B2CBF"))

    @property
    def font_title(self) -> str:
        return self.theme_data.get("font_title", "Inter")

    @property
    def font_body(self) -> str:
        return self.theme_data.get("font_body", "Inter")

    @property
    def is_dark(self) -> bool:
        return self.theme_data.get("style", "dark") == "dark"

    def title_font_size(self, layout: str) -> Pt:
        sizes = {
            "full_bleed": Pt(44),
            "big_number": Pt(32),
            "title_only": Pt(40),
            "title_content": Pt(28),
            "title_bullets": Pt(28),
            "two_column": Pt(24),
            "chart_focus": Pt(24),
            "image_right": Pt(26),
            "image_left": Pt(26),
        }
        return sizes.get(layout, Pt(28))

    def body_font_size(self) -> Pt:
        return Pt(16)

    def bullet_font_size(self) -> Pt:
        return Pt(15)

    def stat_value_font_size(self) -> Pt:
        return Pt(48)

    def stat_label_font_size(self) -> Pt:
        return Pt(14)
