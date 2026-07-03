"""
PPT Renderer v2 — Gamma-style visual presentation engine.

Layout system:
  full_bleed  — Cover/closing: centered title, gradient bar, minimal text
  big_number  — Market/traction: 3-4 large metric callouts in bordered cards
  title_bullets — Standard content: title + lead-in bullets in two columns
  two_column  — Comparison: left vs right with heading + bullet list
  cards       — Feature/model: 2-4 styled cards with title, body, optional metric
  timeline    — Milestones: horizontal flow of events
"""
import io
from typing import Optional

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from loguru import logger

from app.services.branding.extractor import BrandingData
from app.agents.content.content_agent import DeckContent, SlideContent


# ── Color helpers ──────────────────────────────────────────────────────────────

def _rgb(hex_color: str) -> RGBColor:
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _tint(c: RGBColor, factor: float) -> RGBColor:
    """Darken color toward black by factor (0 = black, 1 = original)."""
    return RGBColor(int(c[0] * factor), int(c[1] * factor), int(c[2] * factor))


def _mix(c1: RGBColor, c2: RGBColor, t: float) -> RGBColor:
    """Linear interpolation between two colors (t=0 → c1, t=1 → c2)."""
    return RGBColor(
        int(c1[0] * (1 - t) + c2[0] * t),
        int(c1[1] * (1 - t) + c2[1] * t),
        int(c1[2] * (1 - t) + c2[2] * t),
    )


def _brightness(c: RGBColor) -> float:
    return (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000


def _ensure_visible(c: RGBColor, min_brightness: float = 60.0) -> RGBColor:
    """If color is too dark to see on a dark background, brighten it."""
    if _brightness(c) < min_brightness:
        factor = min_brightness / max(_brightness(c), 1)
        return RGBColor(
            min(255, int(c[0] * factor)),
            min(255, int(c[1] * factor)),
            min(255, int(c[2] * factor)),
        )
    return c


def _brand_palette(primary: RGBColor, secondary: RGBColor) -> dict:
    """
    Derive a full cohesive slide palette from the company's brand colors.
    Background stays dark for readability; accent elements use brand colors.
    """
    # Ensure primary is visible enough to use as an accent on dark backgrounds
    p = _ensure_visible(primary, min_brightness=70)
    s = _ensure_visible(secondary, min_brightness=70)

    return {
        # Backgrounds — very dark tint of primary (subtle brand warmth)
        "bg":       RGBColor(max(8,  int(p[0]*0.07)), max(6,  int(p[1]*0.06)), max(16, int(p[2]*0.08))),
        # Card surface — slightly lighter tint
        "surface":  RGBColor(max(18, int(p[0]*0.14)), max(14, int(p[1]*0.12)), max(30, int(p[2]*0.16))),
        # Alt surface
        "surface2": RGBColor(max(28, int(p[0]*0.22)), max(22, int(p[1]*0.18)), max(45, int(p[2]*0.24))),
        # Card border — noticeable but not harsh
        "border":   RGBColor(max(40, int(p[0]*0.32)), max(32, int(p[1]*0.26)), max(65, int(p[2]*0.34))),
        # Text — always white/near-white for readability
        "text_pri":  _rgb("#F5F3FF"),
        # Secondary text — soft tint of primary mixed toward white
        "text_sec":  _mix(p, _rgb("#CCCCCC"), 0.55),
        # Muted text
        "text_muted": _tint(p, 0.45),
        # Accent colors — the brand colors themselves
        "accent1": p,
        "accent2": s,
        # Tertiary accent — blend of primary + secondary
        "accent3": _mix(p, s, 0.5),
        # Fourth accent — slightly lighter primary
        "accent4": _mix(p, _rgb("#FFFFFF"), 0.25),
    }


# ── Constants (fallback defaults) ─────────────────────────────────────────────

W = Inches(13.333)
H = Inches(7.5)

TEXT_PRI    = _rgb("#F5F3FF")
TEXT_MUTED  = _rgb("#5C4E7A")
ACCENT_1    = _rgb("#2540B5")
ACCENT_2    = _rgb("#7B2CBF")


class PPTRenderer:
    """Renders a DeckContent into a PPTX file using branded, Gamma-style layouts."""

    def __init__(self):
        pass

    async def render(
        self,
        deck_content: DeckContent,
        branding: BrandingData,
        logo_bytes: Optional[bytes] = None,
        slide_backgrounds: Optional[dict] = None,
    ) -> bytes:
        logger.info(f"📊 Rendering PPTX: {len(deck_content.slides)} slides")

        prs = Presentation()
        prs.slide_width = W
        prs.slide_height = H

        primary   = _rgb(branding.primary_color)   if branding.primary_color   else ACCENT_1
        secondary = _rgb(branding.secondary_color) if branding.secondary_color else ACCENT_2

        palette = _brand_palette(primary, secondary)
        slide_backgrounds = slide_backgrounds or {}

        for slide_data in deck_content.slides:
            blank = prs.slide_layouts[6]
            slide = prs.slides.add_slide(blank)
            _bg(slide, palette["bg"])

            # Add background photo if available for this slide type
            bg_bytes = slide_backgrounds.get(slide_data.slide_type)
            if bg_bytes:
                self._add_background_image(slide, bg_bytes, overlay_alpha=0.72)

            layout = slide_data.layout or "title_bullets"

            if layout == "full_bleed":
                self._full_bleed(slide, slide_data, palette, logo_bytes=logo_bytes if slide_data.slide_number == 1 else None)
            elif layout == "market_sizing" or slide_data.slide_type == "financials":
                self._market_sizing(slide, slide_data, palette)
            elif layout == "big_number":
                self._big_number(slide, slide_data, palette)
            elif layout == "cards":
                self._cards(slide, slide_data, palette)
            elif layout == "two_column":
                self._two_column(slide, slide_data, palette)
            elif layout == "timeline":
                self._timeline(slide, slide_data, palette)
            else:
                self._title_bullets(slide, slide_data, palette)

            # Add small logo to top-right of every non-cover slide
            if logo_bytes and slide_data.slide_number != 1:
                self._add_logo_small(slide, logo_bytes)

        buf = io.BytesIO()
        prs.save(buf)
        buf.seek(0)
        data = buf.read()
        logger.info(f"✅ PPTX rendered: {len(data):,} bytes | logo={'yes' if logo_bytes else 'no'} | bg_photos={len(slide_backgrounds)}")
        return data

    # ── Layout renderers ───────────────────────────────────────────────────────

    def _full_bleed(self, slide, s: SlideContent, p: dict, logo_bytes: Optional[bytes] = None):
        """Full-screen cover slide — with optional logo."""
        _rect(slide, 0, 0, W, Inches(0.12), p["accent1"])
        _rect(slide, 0, H - Inches(0.06), W, Inches(0.06), p["accent2"])

        # Logo on cover — top-center
        if logo_bytes:
            try:
                logo_stream = io.BytesIO(logo_bytes)
                logo_w = Inches(2.0)
                logo_h = Inches(0.8)
                logo_x = (W - logo_w) / 2
                slide.shapes.add_picture(logo_stream, logo_x, Inches(0.3), logo_w, logo_h)
                title_y = Inches(1.4)
            except Exception:
                title_y = Inches(1.8)
        else:
            title_y = Inches(1.8)

        _txt(slide, Inches(1), title_y, Inches(11.3), Inches(1.6),
             s.title, size=48, bold=True, color=p["text_pri"], align=PP_ALIGN.CENTER)

        if s.subtitle:
            _txt(slide, Inches(1.5), title_y + Inches(1.7), Inches(10.3), Inches(0.8),
                 s.subtitle, size=22, color=p["text_sec"], align=PP_ALIGN.CENTER)

        if s.body:
            _txt(slide, Inches(2), title_y + Inches(2.6), Inches(9.3), Inches(0.8),
                 s.body, size=15, color=p["text_muted"], align=PP_ALIGN.CENTER)

        _txt(slide, Inches(3.5), Inches(6.9), Inches(6.3), Inches(0.4),
             "Investor Presentation  •  Confidential",
             size=10, color=p["text_muted"], align=PP_ALIGN.CENTER)

    def _big_number(self, slide, s: SlideContent, p: dict):
        """Market/traction slide with large metric callouts."""
        self._slide_header(slide, s, p)

        metrics = s.data_points[:4] if s.data_points else []
        n = len(metrics)

        if n > 0:
            card_w = Inches(2.8)
            total = n * 2.8 + (n - 1) * 0.25
            start_x = (13.333 - total) / 2
            accents = [p["accent1"], p["accent2"], p["accent3"], p["accent4"]]

            for i, dp in enumerate(metrics):
                x = Inches(start_x + i * (2.8 + 0.25))
                y = Inches(2.3)
                ch = Inches(2.4)

                card = _rect(slide, x, y, card_w, ch, p["surface"])
                card.line.color.rgb = accents[i % len(accents)]
                card.line.width = Pt(1.5)

                _txt(slide, x + Inches(0.15), y + Inches(0.25), Inches(2.5), Inches(1.0),
                     dp.get("value", ""), size=34, bold=True, color=p["text_pri"], align=PP_ALIGN.CENTER)

                _txt(slide, x + Inches(0.15), y + Inches(1.25), Inches(2.5), Inches(0.45),
                     dp.get("label", ""), size=12, color=p["text_sec"], align=PP_ALIGN.CENTER)

                if dp.get("sublabel"):
                    _txt(slide, x + Inches(0.1), y + Inches(1.7), Inches(2.6), Inches(0.5),
                         dp["sublabel"], size=10, color=p["text_muted"], align=PP_ALIGN.CENTER)

        if s.body:
            _txt(slide, Inches(0.8), Inches(5.0), Inches(11.7), Inches(0.9),
                 s.body, size=14, color=p["text_sec"])

        if s.bullet_points:
            y_b = Inches(5.9) if s.body else Inches(5.2)
            for i, bp in enumerate(s.bullet_points[:3]):
                _txt(slide, Inches(1.0), y_b + Inches(i * 0.45), Inches(11.3), Inches(0.4),
                     f"›  {bp}", size=13, color=p["text_sec"])

    def _cards(self, slide, s: SlideContent, p: dict):
        """Feature/model/problem slide with 2-4 visual cards."""
        self._slide_header(slide, s, p)

        cards = s.cards[:4] if s.cards else []
        n = len(cards)
        if n == 0:
            self._title_bullets(slide, s, p)
            return

        if n <= 2:
            card_w, card_h = Inches(5.6), Inches(3.8)
            gap = Inches(0.4)
            total_w = n * 5.6 + (n - 1) * 0.4
            y = Inches(2.0)
        else:
            card_w, card_h = Inches(3.0), Inches(3.6)
            gap = Inches(0.25)
            total_w = n * 3.0 + (n - 1) * 0.25
            y = Inches(2.1)

        start_x = (13.333 - total_w) / 2
        accents = [p["accent1"], p["accent2"], p["accent3"], p["accent4"]]

        for i, card in enumerate(cards):
            x = Inches(start_x + i * (card_w.inches + gap.inches))
            acc = accents[i % len(accents)]

            card_bg = _rect(slide, x, y, card_w, card_h, p["surface"])
            card_bg.line.color.rgb = p["border"]
            card_bg.line.width = Pt(1)

            _rect(slide, x, y, card_w, Inches(0.06), acc)

            _txt(slide, x + Inches(0.2), y + Inches(0.2), card_w - Inches(0.4), Inches(0.6),
                 card.get("title", ""), size=16, bold=True, color=p["text_pri"])

            metric = card.get("metric", "")
            if metric:
                _txt(slide, x + Inches(0.2), y + Inches(0.8), card_w - Inches(0.4), Inches(0.55),
                     metric, size=22, bold=True, color=acc)
                body_y = y + Inches(1.35)
            else:
                body_y = y + Inches(0.85)

            if card.get("body"):
                _txt(slide, x + Inches(0.2), body_y, card_w - Inches(0.4),
                     card_h - (body_y - y) - Inches(0.2),
                     card["body"], size=13, color=p["text_sec"], wrap=True)

    def _two_column(self, slide, s: SlideContent, p: dict):
        """Side-by-side comparison layout."""
        self._slide_header(slide, s, p)

        cols = s.columns[:2] if s.columns else []
        if not cols:
            self._title_bullets(slide, s, p)
            return

        col_w, col_h = Inches(5.8), Inches(4.5)
        y = Inches(1.9)
        left_x = Inches(0.7)
        right_x = left_x + col_w + Inches(0.5)
        accents = [p["accent1"], p["accent2"]]

        for ci, (col, x) in enumerate([(cols[0], left_x), (cols[1] if len(cols) > 1 else {}, right_x)]):
            acc = accents[ci]

            bg = _rect(slide, x, y, col_w, col_h, p["surface"])
            bg.line.color.rgb = acc
            bg.line.width = Pt(1.5)

            _rect(slide, x, y, col_w, Inches(0.07), acc)

            _txt(slide, x + Inches(0.2), y + Inches(0.2), col_w - Inches(0.4), Inches(0.55),
                 col.get("heading", ""), size=18, bold=True, color=p["text_pri"])

            yp = y + Inches(0.8)
            if col.get("highlight"):
                _txt(slide, x + Inches(0.2), yp, col_w - Inches(0.4), Inches(0.55),
                     col["highlight"], size=24, bold=True, color=acc)
                yp += Inches(0.6)

            for pt in (col.get("points") or [])[:5]:
                _txt(slide, x + Inches(0.3), yp, col_w - Inches(0.5), Inches(0.48),
                     f"•  {pt}", size=13, color=p["text_sec"])
                yp += Inches(0.48)

        div = slide.shapes.add_shape(1,
            left_x + col_w + Inches(0.22), y + Inches(0.3),
            Inches(0.03), col_h - Inches(0.6))
        div.fill.solid()
        div.fill.fore_color.rgb = p["border"]
        div.line.fill.background()

    def _market_sizing(self, slide, s: SlideContent, p: dict):
        """TAM / SAM / SOM slide with concentric donut rings + metric legend."""
        from pptx.util import Pt
        from pptx.chart.data import ChartData
        from pptx.enum.chart import XL_CHART_TYPE
        import math

        self._slide_header(slide, s, p)

        metrics = (s.data_points or [])[:4]
        labels  = ["TAM", "SAM", "SOM", "CAGR"]
        colors  = [p["accent1"], p["accent2"], p["accent3"], p["accent4"]]

        # ── Concentric rings (simulated with nested circles) ──────────────────
        ring_configs = [
            (Inches(0.6),  Inches(1.7), Inches(4.2), Inches(4.2)),  # TAM — largest
            (Inches(1.0),  Inches(2.1), Inches(3.4), Inches(3.4)),  # SAM — medium
            (Inches(1.45), Inches(2.55),Inches(2.45),Inches(2.45)), # SOM — smallest
        ]
        ring_colors = [p["accent1"], p["accent2"], p["accent3"]]

        for i, (lx, ly, lw, lh) in enumerate(ring_configs):
            if i >= len(metrics):
                break
            # Outer glow ring
            glow = slide.shapes.add_shape(9, lx, ly, lw, lh)  # oval
            glow.fill.solid()
            glow.fill.fore_color.rgb = ring_colors[i]
            glow.line.fill.background()
            # Set transparency via XML hack (pptx doesn't expose alpha directly)
            sp_pr = glow._element.spPr
            alpha_val = [25000, 45000, 65000][i]  # 75%, 55%, 35% transparent
            try:
                from lxml import etree
                ns = "http://schemas.openxmlformats.org/drawingml/2006/main"
                solidFill = sp_pr.find(f"{{{ns}}}solidFill")
                if solidFill is not None:
                    srgb = solidFill.find(f"{{{ns}}}srgbClr")
                    if srgb is None:
                        srgb = etree.SubElement(solidFill, f"{{{ns}}}srgbClr")
                        h = f"{ring_colors[i][0]:02X}{ring_colors[i][1]:02X}{ring_colors[i][2]:02X}"
                        srgb.set("val", h)
                    alpha = etree.SubElement(srgb, f"{{{ns}}}alpha")
                    alpha.set("val", str(alpha_val))
            except Exception:
                pass

        # CAGR label in center
        if len(metrics) > 3:
            cagr_dp = metrics[3]
            _txt(slide, Inches(1.55), Inches(3.1), Inches(2.25), Inches(0.35),
                 "CAGR", size=9, bold=True, color=p["text_muted"], align=PP_ALIGN.CENTER)
            _txt(slide, Inches(1.55), Inches(3.45), Inches(2.25), Inches(0.6),
                 cagr_dp.get("value", ""), size=22, bold=True, color=p["accent4"], align=PP_ALIGN.CENTER)

        # ── Metric legend (right side) ────────────────────────────────────────
        legend_x = Inches(5.3)
        ly_start  = Inches(1.9)
        row_h     = Inches(1.15)

        for i, dp in enumerate(metrics[:3]):
            y = ly_start + Inches(i * 1.15)
            acc = ring_colors[i]

            card = _rect(slide, legend_x, y, Inches(7.3), Inches(1.0), p["surface"])
            card.line.color.rgb = p["border"]
            card.line.width = Pt(1)

            # Colored left bar
            _rect(slide, legend_x, y, Inches(0.07), Inches(1.0), acc)

            _txt(slide, legend_x + Inches(0.2), y + Inches(0.1), Inches(1.0), Inches(0.35),
                 labels[i], size=9, bold=True, color=p["text_muted"])
            _txt(slide, legend_x + Inches(1.3), y + Inches(0.08), Inches(2.5), Inches(0.45),
                 dp.get("value", ""), size=28, bold=True, color=acc)
            _txt(slide, legend_x + Inches(0.2), y + Inches(0.55), Inches(7.0), Inches(0.38),
                 dp.get("sublabel", ""), size=11, color=p["text_sec"])

        # ── Revenue bullets ───────────────────────────────────────────────────
        if s.bullet_points:
            bullets = s.bullet_points[:3]
            bw = Inches(4.0)
            for i, bp in enumerate(bullets):
                bx = Inches(0.5 + i * 4.25)
                bcard = _rect(slide, bx, Inches(6.3), bw, Inches(0.75), p["surface"])
                bcard.line.color.rgb = p["border"]
                bcard.line.width = Pt(1)
                _txt(slide, bx + Inches(0.15), Inches(6.4), bw - Inches(0.3), Inches(0.55),
                     bp, size=12, color=p["text_sec"], wrap=True)

    def _timeline(self, slide, s: SlideContent, p: dict):
        """Horizontal milestone timeline."""
        self._slide_header(slide, s, p)

        items = (s.bullet_points or [])[:5]
        if not items:
            return

        n = len(items)
        item_w = Inches((13.333 - 1.4) / n)
        y_line = Inches(3.8)
        y_cards = Inches(4.1)

        line = slide.shapes.add_shape(1, Inches(0.7), y_line, W - Inches(1.4), Inches(0.04))
        line.fill.solid()
        line.fill.fore_color.rgb = p["border"]
        line.line.fill.background()

        for i, item in enumerate(items):
            x = Inches(0.7 + i * item_w.inches)
            dot_x = x + item_w / 2 - Inches(0.12)
            dot = slide.shapes.add_shape(9, dot_x, y_line - Inches(0.1), Inches(0.24), Inches(0.24))
            dot.fill.solid()
            dot.fill.fore_color.rgb = p["accent1"]
            dot.line.fill.background()

            parts = item.split(":", 1)
            label = parts[0].strip()
            detail = parts[1].strip() if len(parts) > 1 else ""

            _txt(slide, x + Inches(0.1), y_cards, item_w - Inches(0.2), Inches(0.45),
                 label, size=13, bold=True, color=p["text_pri"], align=PP_ALIGN.CENTER)
            if detail:
                _txt(slide, x + Inches(0.1), y_cards + Inches(0.45), item_w - Inches(0.2), Inches(0.6),
                     detail, size=11, color=p["text_sec"], align=PP_ALIGN.CENTER)

    def _title_bullets(self, slide, s: SlideContent, p: dict):
        """Standard title + bullets layout."""
        self._slide_header(slide, s, p)

        bullets = s.bullet_points[:8]
        body = s.body

        if body:
            _txt(slide, Inches(0.8), Inches(2.0), Inches(11.7), Inches(0.85),
                 body, size=15, color=p["text_sec"], wrap=True)

        if not bullets:
            return

        y_start = Inches(2.95) if body else Inches(2.1)
        mid = (len(bullets) + 1) // 2
        left_bullets = bullets[:mid]
        right_bullets = bullets[mid:]
        col_w = Inches(5.7) if right_bullets else Inches(11.7)

        for i, bp in enumerate(left_bullets):
            self._bullet_row(slide, Inches(0.8), y_start + Inches(i * 0.62), col_w, bp, p["accent1"], p)

        if right_bullets:
            rx = Inches(0.8) + col_w + Inches(0.5)
            for i, bp in enumerate(right_bullets):
                self._bullet_row(slide, rx, y_start + Inches(i * 0.62), col_w, bp, p["accent2"], p)

    def _bullet_row(self, slide, x, y, w, text: str, accent, p: dict):
        """Single bullet row with colored dot."""
        dot = slide.shapes.add_shape(9, x, y + Inches(0.14), Inches(0.12), Inches(0.12))
        dot.fill.solid()
        dot.fill.fore_color.rgb = accent
        dot.line.fill.background()
        _txt(slide, x + Inches(0.22), y, w - Inches(0.22), Inches(0.56),
             text, size=14, color=p["text_sec"], wrap=True)

    # ── Image helpers ──────────────────────────────────────────────────────────

    def _add_background_image(self, slide, img_bytes: bytes, overlay_alpha: float = 0.70):
        """Add a full-slide background photo with a dark overlay for text readability."""
        try:
            img_stream = io.BytesIO(img_bytes)
            pic = slide.shapes.add_picture(img_stream, 0, 0, W, H)
            # Move picture to the very back of the shape stack
            sp_tree = slide.shapes._spTree
            sp_tree.remove(pic._element)
            sp_tree.insert(2, pic._element)

            # Dark overlay so text stays readable
            overlay = slide.shapes.add_shape(1, 0, 0, W, H)
            overlay.fill.solid()
            alpha = max(0, min(255, int(overlay_alpha * 255)))
            overlay.fill.fore_color.rgb = _rgb("#000000")
            overlay.fill.fore_color.theme_color  # noqa — just access to confirm
            # python-pptx doesn't support transparency directly on fills for PPTX shapes,
            # so we set a very dark near-black color instead
            darkness = int((1 - overlay_alpha) * 255)
            overlay.fill.fore_color.rgb = RGBColor(darkness, darkness, darkness)
            overlay.line.fill.background()

            # Move overlay just behind all content but above the photo
            sp_tree.remove(overlay._element)
            sp_tree.insert(3, overlay._element)
        except Exception as exc:
            pass  # Background image is optional — never block rendering

    def _add_logo_small(self, slide, logo_bytes: bytes):
        """Add a small logo to the top-right corner of a slide."""
        try:
            logo_stream = io.BytesIO(logo_bytes)
            logo_w = Inches(1.1)
            logo_h = Inches(0.45)
            slide.shapes.add_picture(
                logo_stream,
                W - logo_w - Inches(0.2),
                Inches(0.1),
                logo_w,
                logo_h,
            )
        except Exception:
            pass

    # ── Shared header ──────────────────────────────────────────────────────────

    def _slide_header(self, slide, s: SlideContent, p: dict):
        """Left accent bar + slide type tag + title + optional subtitle."""
        _rect(slide, 0, 0, Inches(0.07), H, p["accent1"])

        tag = s.slide_type.replace("_", " ").upper()
        _txt(slide, Inches(0.8), Inches(0.18), Inches(5), Inches(0.38),
             tag, size=9, bold=True, color=p["text_muted"])

        _txt(slide, Inches(0.8), Inches(0.55), Inches(11.7), Inches(0.85),
             s.title, size=30, bold=True, color=p["text_pri"])

        if s.subtitle:
            _txt(slide, Inches(0.8), Inches(1.4), Inches(11.7), Inches(0.6),
                 s.subtitle, size=16, color=p["text_sec"])


# ── Low-level drawing helpers ──────────────────────────────────────────────────

def _bg(slide, color: RGBColor):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color


def _rect(slide, left, top, width, height, color: RGBColor):
    shape = slide.shapes.add_shape(1, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    return shape


def _txt(
    slide, left, top, width, height,
    text: str,
    size: int = 14,
    bold: bool = False,
    color: RGBColor = TEXT_PRI,
    align=PP_ALIGN.LEFT,
    wrap: bool = True,
    font: str = "Calibri",
):
    if not text:
        return None
    tb = slide.shapes.add_textbox(left, top, width, height)
    tf = tb.text_frame
    tf.word_wrap = wrap
    p = tf.paragraphs[0]
    p.alignment = align

    # Handle bold lead-ins: "**Bold part:** rest of text"
    if "**" in text:
        parts = text.split("**")
        for pi, part in enumerate(parts):
            run = p.add_run()
            run.text = part
            run.font.size = Pt(size)
            run.font.color.rgb = color
            run.font.name = font
            run.font.bold = bold or (pi % 2 == 1)
    else:
        run = p.add_run()
        run.text = text
        run.font.size = Pt(size)
        run.font.color.rgb = color
        run.font.name = font
        run.font.bold = bold

    return tb
