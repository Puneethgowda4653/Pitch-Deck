/**
 * Portaled overlay input that sits on top of whichever editableText/
 * editableSvgText marker is currently active, at its real on-screen
 * position AND with the marker's own computed style (color, font, size)
 * copied onto it — so it reads as the text itself becoming editable in
 * place, not a foreign popup dropped on top of the slide.
 *
 * Three things make a portaled input necessary rather than a plain
 * contentEditable span:
 *  1. The deck stage renders inside `transform: scale(clientWidth/1280)`,
 *     often well under 1 — a native caret at that scale is unreliable, and a
 *     legible-sized portaled input sidesteps the whole problem. `scale` is
 *     passed in so we can convert the marker's *design-size* computed font
 *     back up to real on-screen pixels (CSS transforms don't affect
 *     getComputedStyle's layout values, only paint).
 *  2. The traction chart's numbers are SVG <text>/<tspan>, which have no
 *     contentEditable equivalent at all. A portaled HTML input positioned
 *     over the glyph's real screen rect works identically for both cases —
 *     one interaction pattern for the whole deck.
 *  3. Must be portaled to document.body: rendering it as a normal descendant
 *     anywhere inside the scaled container would shrink the input itself
 *     right along with everything else, defeating the point.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import type { ActiveEdit, EditPath } from "./editableText";

interface Props {
  active: ActiveEdit | null;
  /** Scoped so we never accidentally match a marker outside this deck stage. */
  containerRef: React.RefObject<HTMLElement>;
  /** Current CSS transform scale of the deck stage — used to convert the
   * marker's design-size computed font back up to real screen pixels. */
  scale: number;
  onCommit: (path: EditPath, value: string | number) => void;
  onCancel: () => void;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface MatchedStyle {
  color: string;
  fontSize: number; // already scaled to real screen px
  fontFamily: string;
  fontWeight: string;
  letterSpacing: string;
  textAlign: React.CSSProperties["textAlign"];
  lineHeight: string; // already scaled to real screen px, or "normal"
}

function isSvgEl(el: Element): el is SVGGraphicsElement {
  return el instanceof SVGElement;
}

/** Real on-screen rect for a <span> or <text>/<tspan> marker, accounting for
 * every ancestor transform (including the deck stage's scale()) via
 * getScreenCTM for SVG, or getBoundingClientRect for plain DOM. */
function measureRect(el: Element): Rect {
  if (isSvgEl(el)) {
    const svg = el.ownerSVGElement;
    const ctm = el.getScreenCTM();
    if (svg && ctm && typeof (el as any).getBBox === "function") {
      try {
        const bbox = (el as SVGGraphicsElement & { getBBox(): DOMRect }).getBBox();
        const p1 = svg.createSVGPoint();
        p1.x = bbox.x;
        p1.y = bbox.y;
        const p2 = svg.createSVGPoint();
        p2.x = bbox.x + bbox.width;
        p2.y = bbox.y + bbox.height;
        const s1 = p1.matrixTransform(ctm);
        const s2 = p2.matrixTransform(ctm);
        return {
          left: Math.min(s1.x, s2.x),
          top: Math.min(s1.y, s2.y),
          width: Math.abs(s2.x - s1.x),
          height: Math.abs(s2.y - s1.y),
        };
      } catch {
        // fall through to the generic rect below
      }
    }
  }
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** Copy the marker's own rendered appearance so the input reads as "this
 * text became editable," not a differently-styled box dropped on top of it.
 * SVG text uses `fill` for color, not `color`; everything else is the same
 * CSS. Font-size comes back at *design* size (transforms don't affect
 * computed layout values) — scale it back up to match the rect we measured. */
function matchStyle(el: Element, scale: number): MatchedStyle {
  const cs = window.getComputedStyle(el);
  const svg = isSvgEl(el);
  const rawColor = (svg ? cs.fill : cs.color) || (svg ? "#fff" : "#111");
  const rawSize = parseFloat(cs.fontSize) || 14;
  const rawTracking = parseFloat(cs.letterSpacing);
  const rawLineHeight = parseFloat(cs.lineHeight);
  return {
    color: rawColor === "none" ? "#111" : rawColor,
    fontSize: Math.max(rawSize * scale, 11),
    fontFamily: cs.fontFamily || "inherit",
    fontWeight: cs.fontWeight || "400",
    letterSpacing: Number.isFinite(rawTracking) ? `${rawTracking * scale}px` : "normal",
    textAlign: (svg ? "left" : (cs.textAlign as React.CSSProperties["textAlign"])) || "left",
    // getComputedStyle resolves "normal"/unitless line-height to a px value
    // in every browser that matters here, so this is almost always numeric —
    // "normal" is kept only as a last-resort fallback.
    lineHeight: Number.isFinite(rawLineHeight) ? `${rawLineHeight * scale}px` : "normal",
  };
}

export function FloatingTextEditor({ active, containerRef, scale, onCommit, onCancel }: Props) {
  const [value, setValue] = React.useState("");
  const [rect, setRect] = React.useState<Rect | null>(null);
  const [matched, setMatched] = React.useState<MatchedStyle | null>(null);
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Never trust callers to have flagged every long field: fall back to
  // measuring the marker's own rect. A field that renders taller than ~1.6
  // lines is, empirically, wrapped text — no single-line box (however
  // generous its line-height) reaches that ratio, but two real lines
  // comfortably clear it. This is what actually caught the paragraph field
  // that shipped without an explicit `multiline` flag.
  const isMultiline = !!(
    active?.multiline || (rect && matched && rect.height > matched.fontSize * 1.6)
  );

  const measure = React.useCallback(() => {
    if (!active || !containerRef.current) return;
    const key = active.key.replace(/"/g, '\\"');
    const el = containerRef.current.querySelector(`[data-edit-path="${key}"]`);
    if (el) {
      setRect(measureRect(el));
      setMatched(matchStyle(el, scale));
    }
  }, [active, containerRef, scale]);

  React.useLayoutEffect(() => {
    if (!active) {
      setRect(null);
      setMatched(null);
      return;
    }
    setValue(active.value);
    measure();
  }, [active, measure]);

  React.useEffect(() => {
    if (!active) return;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, measure]);

  React.useEffect(() => {
    if (rect && inputRef.current) {
      inputRef.current.focus();
      // Select-all makes sense for a short label/number you're likely
      // replacing outright. For a paragraph, selecting everything risks
      // wiping the whole thing on the next keystroke — just place the caret
      // and let the browser's default (start of text) stand.
      if (!isMultiline) inputRef.current.select();
    }
  }, [rect, isMultiline]);

  const commit = () => {
    if (!active) return;
    if (active.numeric) {
      const n = parseFloat(value);
      if (Number.isNaN(n)) {
        onCancel(); // don't silently coerce an unparsable edit to 0
        return;
      }
      onCommit(active.path, n);
    } else {
      onCommit(active.path, value);
    }
  };

  if (!active || !rect || !matched) return null;

  // Grown very slightly past the measured glyph box (not padded inward) so
  // the caret and a couple of extra typed characters have room without the
  // box visibly relocating from where the original text sat.
  //
  // width MUST be explicit, not just minWidth: a bare <input>/<textarea>'s
  // intrinsic size defaults to ~20 characters (the HTML `size`/`cols`
  // default) at whatever font-size is applied — since we copy the marker's
  // real font-size (which can be huge, e.g. a 96px cover title), that
  // default intrinsic width balloons to hundreds of extra pixels past the
  // actual text. An explicit width overrides that default entirely.
  //
  // Multiline is the one case that does NOT get the growth-room treatment:
  // rect.width there is already the wrapped paragraph's own column width
  // (block text wraps to its container, not to its longest line), so
  // widening it would rewrap the text at different points than the original
  // render — the opposite of "edit like how it has been generated."
  const maxWidth = Math.max(window.innerWidth - rect.left - 24, 80);
  const width = isMultiline
    ? Math.min(rect.width + 8, maxWidth)
    : Math.min(Math.max(rect.width * 1.4, rect.width + 60), maxWidth);
  const style: React.CSSProperties = {
    position: "fixed",
    left: rect.left - 3,
    top: rect.top - 2,
    width,
    minHeight: isMultiline ? Math.max(rect.height + 4, 60) : rect.height + 4,
    zIndex: 2000,
    margin: 0,
    padding: 0,
    // No visible chrome by default — the goal is "the text itself became
    // editable," not a box drawn on top of it. The native blinking caret is
    // the only affordance, same as clicking into any real text editor.
    border: "none",
    outline: "none",
    background: "transparent",
    color: matched.color,
    fontSize: matched.fontSize,
    fontFamily: matched.fontFamily,
    fontWeight: matched.fontWeight as any,
    letterSpacing: matched.letterSpacing,
    textAlign: matched.textAlign,
    // Copy the paragraph's own line-height (scaled) rather than a guessed
    // constant, so wrapped lines land at the same spacing as the real render.
    lineHeight: isMultiline ? matched.lineHeight : `${rect.height + 4}px`,
    // No resize handle: minHeight is already sized from the real measured
    // block, and a drag-grip is exactly the kind of foreign UI chrome the
    // "just the inline editing feel, no visible box" goal rules out. (Native
    // textarea scrolling still kicks in if typed text grows past minHeight —
    // that's independent of `resize` and needs no extra handling.)
    resize: "none",
  };

  const onKeyDown = (ev: React.KeyboardEvent) => {
    ev.stopPropagation(); // never let this reach TemplatedDeck's arrow-key slide nav
    if (ev.key === "Escape") {
      onCancel();
    } else if (ev.key === "Enter" && (!isMultiline || (ev.metaKey || ev.ctrlKey))) {
      ev.preventDefault();
      commit();
    }
  };

  const shared = {
    ref: inputRef as any,
    value,
    onChange: (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(ev.target.value),
    onBlur: commit,
    onKeyDown,
    onClick: (ev: React.MouseEvent) => ev.stopPropagation(),
    style,
  };

  return createPortal(
    isMultiline
      ? React.createElement("textarea", shared)
      : React.createElement("input", { ...shared, type: "text" }),
    document.body
  );
}
