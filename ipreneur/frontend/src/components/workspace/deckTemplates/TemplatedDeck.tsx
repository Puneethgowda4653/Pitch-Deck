/**
 * TemplatedDeck — the 10-theme deck renderer.
 *
 * Ported from the Claude template artifact (React.createElement style kept to
 * stay faithful to the original layouts). Renders a fixed 1280×720 slide and
 * scales it to fit the container; includes prev/next + dot navigation.
 *
 * Slides are addressed by SECTION KEY, not by position: `renderSlide` looks up
 * slot `index` in the deck's order (see deckTypes.ts) and calls that slot's
 * renderer with the key to read and the eyebrow to show. That indirection is
 * what lets one renderer serve several sections — `probsol` draws the
 * problem/solution slide, the risks/mitigations slide and the partnership
 * "what each side brings" slide, each reading its own key and writing its own
 * edit paths.
 *
 * `renderSlide(theme, data, index, editCtx, order)` is also exported for thumbnails.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Maximize2, X as XIcon } from "lucide-react";
import { Theme, mix, border, fD } from "./themes";
import {
  TemplateDeckData,
  sec,
  EMPTY_ASK, EMPTY_CLOSING, EMPTY_COMPETITION, EMPTY_GALLERY, EMPTY_MARKET,
  EMPTY_MODEL, EMPTY_PERSONA, EMPTY_PROBSOL, EMPTY_PRODUCT, EMPTY_PROOF,
  EMPTY_ROADMAP, EMPTY_SUMMARY, EMPTY_TEAM, EMPTY_TRACTION, EMPTY_VISION,
} from "./types";
import { DEFAULT_DECK_TYPE, RendererId, SlideSlot, slideOrder } from "./deckTypes";
import { EditCtx, VIEW_CTX, editableText, editableSvgText, EditPath, ActiveEdit } from "./editing/editableText";
import { FloatingTextEditor } from "./editing/FloatingTextEditor";

const e = React.createElement;
type N = React.ReactNode;

/**
 * What a slide needs beyond the theme and the data: which section key it is
 * rendering, what eyebrow to show, and how long the deck is (for the footer).
 * Bundled rather than passed as three positional params, since every renderer
 * takes all three and the list would otherwise keep growing.
 */
export interface SlideArgs {
  k: string;
  eb: string;
  total: number;
}

type SlideFn = (T: Theme, C: TemplateDeckData, i: number, X: EditCtx, A: SlideArgs) => N;

// ── Shared bits ──────────────────────────────────────────────────────────────

function eyebrow(T: Theme, txt: N): N {
  return e("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 22 } },
    e("span", { key: "d", style: { width: 26, height: 3, borderRadius: 2, background: T.accent } }),
    e("span", { key: "t", style: { fontFamily: fD(T), fontSize: 13, fontWeight: 600, letterSpacing: T.upper ? ".16em" : ".04em", textTransform: T.upper ? "uppercase" : "none", color: T.accent } }, txt)
  );
}

function h1(T: Theme, txt: N, size?: number): N {
  return e("h1", { style: { margin: 0, fontFamily: fD(T), fontWeight: T.serif ? 600 : 700, fontSize: size || 48, lineHeight: 1.04, letterSpacing: T.serif ? "-0.01em" : "-0.025em", color: T.text, textWrap: "balance" } as React.CSSProperties }, txt);
}

function logo(T: Theme, C: TemplateDeckData): N {
  const logoUrl = C._assets?.logoUrl;
  const badge = logoUrl
    ? e("img", { key: "m", src: logoUrl, alt: C.company, style: { height: 24, maxWidth: 120, objectFit: "contain", display: "block" } })
    : e("div", { key: "m", style: { width: 22, height: 22, borderRadius: 6, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", color: T.mode === "dark" ? T.bg : "#fff", fontFamily: fD(T), fontWeight: 700, fontSize: 13 } }, C.mark);
  return e("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
    badge,
    e("span", { key: "n", style: { fontFamily: fD(T), fontWeight: 600, fontSize: 14, letterSpacing: ".01em", color: T.text } }, C.company)
  );
}

interface ShellOpts { noFoot?: boolean; deco?: N; pad?: number; total?: number }
function shell(T: Theme, C: TemplateDeckData, no: number, inner: N, opts: ShellOpts = {}): N {
  // Deck length varies by type, so the page counter reads it from the slide's
  // args rather than assuming the investor deck's 12.
  const total = opts.total ?? 12;
  const foot = opts.noFoot ? null : e("div", { key: "foot", style: { position: "absolute", left: opts.pad || 80, right: opts.pad || 80, bottom: 32, display: "flex", justifyContent: "space-between", alignItems: "center" } },
    logo(T, C),
    e("span", { key: "p", style: { fontFamily: fD(T), fontSize: 12, fontWeight: 500, letterSpacing: ".04em", color: T.muted } }, (no < 9 ? "0" : "") + (no + 1) + " / " + total)
  );
  return e("div", { style: { position: "relative", width: 1280, height: 720, background: T.bg, color: T.text, fontFamily: T.fontB + ", sans-serif", padding: opts.pad ? `64px ${opts.pad}px 88px` : "62px 80px 88px", display: "flex", flexDirection: "column", overflow: "hidden" } },
    opts.deco || null, inner, foot);
}

function areaChart(T: Theme, series: { y: string; v: number }[], w: number, h: number, X: EditCtx = VIEW_CTX, basePath: EditPath = ["traction", "series"]): N {
  const hasRealData = !!(series && series.length);
  const safe = hasRealData ? series : [{ y: "", v: 1 }];
  const max = Math.max(...safe.map((s) => s.v)) * 1.12 || 1;
  const n = safe.length;
  const px = (i: number) => (n === 1 ? w / 2 : (i / (n - 1)) * w);
  const py = (v: number) => h - (v / max) * h;
  const pts = safe.map((s, i) => [px(i), py(s.v)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L ${w} ${h} L 0 ${h} Z`;
  const gid = "g" + T.key;
  return e("svg", { viewBox: `0 0 ${w} ${h + 34}`, style: { width: "100%", height: "auto", overflow: "visible" } },
    e("defs", { key: "def" },
      e("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
        e("stop", { key: 0, offset: "0%", stopColor: T.accent, stopOpacity: 0.34 }),
        e("stop", { key: 1, offset: "100%", stopColor: T.accent, stopOpacity: 0 })
      )),
    [0.25, 0.5, 0.75, 1].map((g, i) => e("line", { key: "gl" + i, x1: 0, y1: h * g, x2: w, y2: h * g, stroke: border(T), strokeWidth: 1 })),
    e("path", { key: "a", d: area, fill: `url(#${gid})` }),
    e("path", { key: "l", d: line, fill: "none", stroke: T.accent, strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" }),
    pts.map((p, i) => e("circle", { key: "c" + i, cx: p[0], cy: p[1], r: 5, fill: T.bg, stroke: T.accent, strokeWidth: 3 })),
    safe.map((s, i) => e("text", { key: "lx" + i, x: px(i), y: h + 24, textAnchor: i === 0 ? "start" : i === n - 1 ? "end" : "middle", fontSize: 13, fontFamily: T.fontB, fill: T.muted },
      hasRealData ? editableSvgText(s.y, [...basePath, i, "y"], X, undefined, "n" + i) : s.y)),
    safe.map((s, i) => e("text", { key: "lv" + i, x: px(i), y: py(s.v) - 14, textAnchor: "middle", fontSize: 13, fontWeight: 700, fontFamily: fD(T), fill: T.text },
      "$", hasRealData ? editableSvgText(String(s.v), [...basePath, i, "v"], X, { numeric: true }, "n" + i) : s.v, "M"))
  );
}

function check(T: Theme, on: boolean): N {
  if (on) return e("svg", { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none" }, e("path", { d: "M5 12.5l4 4 10-10", stroke: T.accent, strokeWidth: 2.6, strokeLinecap: "round", strokeLinejoin: "round" }));
  return e("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none" }, e("path", { d: "M7 7l10 10M17 7L7 17", stroke: T.muted, strokeWidth: 2, strokeLinecap: "round", opacity: 0.5 }));
}

function kpiTiles(T: Theme, kpis: { k: string; l: string }[], basePath: EditPath, X: EditCtx, cols?: number): N {
  return e("div", { style: { display: "grid", gridTemplateColumns: `repeat(${cols || (kpis || []).length || 1},1fr)`, gap: 14 } },
    (kpis || []).map((k, i) => e("div", { key: i, style: { background: T.mode === "dark" ? mix(T.surface, 75, T.bg) : T.surface, border: `1px solid ${border(T)}`, borderRadius: 14, padding: "18px 18px 16px" } },
      e("div", { key: "k", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 30, letterSpacing: "-0.02em", color: T.accent, lineHeight: 1 } }, editableText(k.k, [...basePath, i, "k"], X)),
      e("div", { key: "l", style: { marginTop: 8, fontSize: 13, lineHeight: 1.35, color: T.muted } }, editableText(k.l, [...basePath, i, "l"], X))
    ))
  );
}

// Image placeholder tile — our decks have no uploaded images yet, so render a
// themed empty-media state (icon + caption). Swap for a real <img> once images
// are wired into template_data.
function imgSlot(T: Theme, caption: N): N {
  return e("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: T.muted } },
    e("svg", { key: "ic", width: 34, height: 34, viewBox: "0 0 24 24", fill: "none" },
      e("rect", { x: 3, y: 4, width: 18, height: 16, rx: 2.5, stroke: mix(T.accent, 55), strokeWidth: 1.6 }),
      e("circle", { cx: 8.5, cy: 9.5, r: 1.8, fill: mix(T.accent, 70) }),
      e("path", { d: "M3.5 18l5-5 4 4 3-3 5 5", stroke: mix(T.accent, 55), strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" })
    ),
    e("span", { key: "cap", style: { fontSize: 13.5, fontWeight: 500, letterSpacing: ".01em" } }, caption)
  );
}

// Avatar image slot — our decks have no per-member photos, so render the
// initials placeholder in a themed circle (matches the artifact's empty state).
function avatar(T: Theme, initials: N): N {
  return e("div", { style: { width: 84, height: 84, borderRadius: "50%", padding: 3, background: mix(T.accent, T.mode === "dark" ? 22 : 13, T.mode === "dark" ? "transparent" : "#fff"), border: `1px solid ${mix(T.accent, 32)}`, flexShrink: 0 } },
    e("div", { style: { width: "100%", height: "100%", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fD(T), fontWeight: 700, fontSize: 24, color: T.accent, background: mix(T.accent, T.mode === "dark" ? 14 : 8, T.mode === "dark" ? "transparent" : "#fff") } }, initials)
  );
}

// A bordered surface card — the repeated container across most slides.
function cardStyle(T: Theme, accented = false): React.CSSProperties {
  return {
    background: accented
      ? mix(T.accent, T.mode === "dark" ? 13 : 7, T.mode === "dark" ? "transparent" : "#fff")
      : (T.mode === "dark" ? mix(T.surface, 72, T.bg) : T.surface),
    border: `1px solid ${accented ? mix(T.accent, 42) : border(T)}`,
    borderRadius: 18,
  };
}

// ── Slides ───────────────────────────────────────────────────────────────────

const cover: SlideFn = (T, C, i, X, A) => {
  const deco = e("div", { key: "dc", style: { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" } },
    e("div", { key: 1, style: { position: "absolute", right: -120, top: -120, width: 460, height: 460, borderRadius: "50%", background: mix(T.accent2, T.mode === "dark" ? 22 : 16, "transparent"), filter: "blur(10px)" } }),
    e("div", { key: 2, style: { position: "absolute", right: 120, bottom: -160, width: 380, height: 380, borderRadius: "50%", background: mix(T.accent, T.mode === "dark" ? 20 : 14, "transparent"), filter: "blur(6px)" } }),
    e("div", { key: 3, style: { position: "absolute", right: 90, top: 150, width: 220, height: 220, borderRadius: "50%", border: `1.5px solid ${border(T, true)}` } })
  );
  const inner = e("div", { key: "in", style: { display: "flex", flexDirection: "column", height: "100%" } },
    e("div", { key: "top", style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
      logo(T, C),
      e("span", { key: "y", style: { fontFamily: fD(T), fontSize: 12, fontWeight: 500, letterSpacing: ".14em", textTransform: "uppercase", color: T.muted } },
        editableText(C.eyebrow, ["eyebrow"], X), " · ", editableText(C.year, ["year"], X))
    ),
    e("div", { key: "mid", style: { marginTop: "auto", marginBottom: "auto", maxWidth: 760 } },
      eyebrow(T, editableText(C.eyebrow || "Investor Presentation", ["eyebrow"], X)),
      e("h1", { key: "co", style: { margin: "0 0 4px", fontFamily: fD(T), fontWeight: T.serif ? 600 : 700, fontSize: 96, lineHeight: 0.96, letterSpacing: "-0.035em", color: T.text } }, editableText(C.company, ["company"], X)),
      e("p", { key: "tg", style: { margin: "22px 0 0", fontSize: 23, lineHeight: 1.4, color: T.muted, maxWidth: 560, fontWeight: 400 } }, editableText(C.tagline, ["tagline"], X))
    ),
    e("div", { key: "bot", style: { display: "flex", alignItems: "center", gap: 16 } },
      e("span", { key: "r", style: { fontFamily: fD(T), fontWeight: 600, fontSize: 15, color: T.text, padding: "9px 16px", borderRadius: 999, background: mix(T.accent, T.mode === "dark" ? 18 : 12, T.mode === "dark" ? "transparent" : "#fff"), border: `1px solid ${mix(T.accent, 34)}` } }, editableText(C.round, ["round"], X)),
      e("span", { key: "c", style: { fontSize: 13, color: T.muted, letterSpacing: ".04em" } }, "Confidential")
    )
  );
  return shell(T, C, i, inner, { noFoot: true, deco, total: A.total });
};

const summary: SlideFn = (T, C, i, X, A) => {
  const S = sec(C, A.k, EMPTY_SUMMARY);
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" } },
    eyebrow(T, A.eb),
    e("div", { key: "hd", style: { maxWidth: 920 } },
      h1(T, editableText(S.headline, [A.k, "headline"], X), 50),
      e("p", { key: "l", style: { margin: "24px 0 0", fontSize: 20, lineHeight: 1.6, color: T.muted, maxWidth: 860 } }, editableText(S.lead, [A.k, "lead"], X, { multiline: true }))
    ),
    e("div", { key: "kp", style: { marginTop: 52 } }, kpiTiles(T, S.highlights || [], [A.k, "highlights"], X, 4))
  );
  return shell(T, C, i, inner, { total: A.total });
};

const probsol: SlideFn = (T, C, i, X, A) => {
  const PS = sec(C, A.k, EMPTY_PROBSOL);
  const card = (titlePath: EditPath, title: string, leadPath: EditPath, lead: string, itemsPath: EditPath, items: { k: string; t: string }[], footPath: EditPath, foot: string, solution: boolean): N =>
    e("div", { style: { ...cardStyle(T, solution), flex: 1, display: "flex", flexDirection: "column", padding: "28px 30px" } },
      e("div", { key: "lab", style: { fontSize: 12, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: solution ? T.accent : T.muted } }, editableText(title, titlePath, X)),
      e("div", { key: "ld", style: { marginTop: 11, fontFamily: fD(T), fontWeight: 600, fontSize: 22, lineHeight: 1.2, letterSpacing: "-0.01em", color: T.text } }, editableText(lead, leadPath, X)),
      e("div", { key: "it", style: { marginTop: 24, display: "flex", flexDirection: "column", gap: 18 } },
        (items || []).map((it, k) => e("div", { key: k, style: { display: "flex", gap: 13, alignItems: "flex-start" } },
          e("span", { key: "d", style: { width: 8, height: 8, borderRadius: "50%", marginTop: 8, flexShrink: 0, background: solution ? T.accent : mix(T.muted, 70) } }),
          e("div", { key: "t", style: { fontSize: 15.5, lineHeight: 1.55, color: T.muted } },
            e("span", { key: "k", style: { fontWeight: 700, color: T.text } }, editableText(it.k, [...itemsPath, k, "k"], X)),
            " — ",
            editableText(it.t, [...itemsPath, k, "t"], X, { multiline: true }))
        ))
      ),
      e("div", { key: "ft", style: { marginTop: "auto", paddingTop: 20, borderTop: `1px solid ${border(T)}`, display: "flex", gap: 11, alignItems: "center" } },
        e("span", { key: "b", style: { width: 24, height: 3, borderRadius: 2, flexShrink: 0, background: solution ? T.accent : mix(T.muted, 60) } }),
        e("span", { key: "t", style: { fontSize: 14.5, lineHeight: 1.45, fontWeight: 600, color: solution ? T.accent : T.text } }, editableText(foot, footPath, X, { multiline: true }))
      )
    );
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, A.eb),
    e("div", { key: "hd", style: { maxWidth: 860 } },
      h1(T, editableText(PS.headline, [A.k, "headline"], X), 44),
      e("p", { key: "s", style: { margin: "16px 0 0", fontSize: 18, color: T.muted } }, editableText(PS.sub, [A.k, "sub"], X, { multiline: true }))),
    e("div", { key: "cards", style: { display: "flex", gap: 22, marginTop: 26, flex: 1 } },
      card([A.k, "problemTitle"], PS.problemTitle, [A.k, "problemLead"], PS.problemLead, [A.k, "problem"], PS.problem, [A.k, "problemFoot"], PS.problemFoot, false),
      card([A.k, "solutionTitle"], PS.solutionTitle, [A.k, "solutionLead"], PS.solutionLead, [A.k, "solution"], PS.solution, [A.k, "solutionFoot"], PS.solutionFoot, true)
    )
  );
  return shell(T, C, i, inner, { total: A.total });
};

const product: SlideFn = (T, C, i, X, A) => {
  const P = sec(C, A.k, EMPTY_PRODUCT);
  const steps = P.steps || [];
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, A.eb),
    e("div", { key: "hd", style: { maxWidth: 820 } }, h1(T, editableText(P.headline, [A.k, "headline"], X), 46),
      e("p", { key: "s", style: { margin: "18px 0 0", fontSize: 18, lineHeight: 1.5, color: T.muted } }, editableText(P.sub, [A.k, "sub"], X, { multiline: true }))),
    e("div", { key: "st", style: { display: "flex", gap: 20, marginTop: 34, flex: 1 } },
      steps.map((s, k) => e("div", { key: k, style: { ...cardStyle(T), flex: 1, display: "flex", flexDirection: "column", padding: "28px 28px 26px" } },
        e("div", { key: "row", style: { display: "flex", alignItems: "center", gap: 14 } },
          e("div", { key: "n", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 17, color: T.accent, width: 46, height: 46, borderRadius: 13, background: mix(T.accent, T.mode === "dark" ? 20 : 12, T.mode === "dark" ? "transparent" : "#fff"), display: "flex", alignItems: "center", justifyContent: "center" } }, editableText(s.n, [A.k, "steps", k, "n"], X)),
          e("div", { key: "ln", style: { flex: 1, height: 2, background: mix(T.accent, 28) } })
        ),
        e("div", { key: "mid", style: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" } },
          e("div", { key: "t", style: { fontFamily: fD(T), fontWeight: 600, fontSize: 26, color: T.text, letterSpacing: "-0.01em" } }, editableText(s.t, [A.k, "steps", k, "t"], X)),
          e("div", { key: "d", style: { marginTop: 12, fontSize: 15.5, lineHeight: 1.55, color: T.muted } }, editableText(s.d, [A.k, "steps", k, "d"], X, { multiline: true }))
        ),
        e("div", { key: "tg", style: { paddingTop: 16, display: "flex", flexWrap: "wrap", gap: 8 } },
          (s.tags || []).map((tg, n) => e("span", { key: n, style: { fontSize: 12.5, fontWeight: 500, color: T.muted, padding: "5px 12px", borderRadius: 999, border: `1px solid ${border(T, true)}` } }, editableText(tg, [A.k, "steps", k, "tags", n], X))))
      ))
    )
  );
  return shell(T, C, i, inner, { total: A.total });
};

const market: SlideFn = (T, C, i, X, A) => {
  const M = sec(C, A.k, EMPTY_MARKET);
  const keys = ["tam", "sam", "som"] as const;
  const rings = [{ d: 360, key: keys[0], k: M.tam, op: T.mode === "dark" ? 0.16 : 0.1 }, { d: 248, key: keys[1], k: M.sam, op: T.mode === "dark" ? 0.26 : 0.18 }, { d: 140, key: keys[2], k: M.som, op: 1 }];
  const circle = e("div", { key: "cir", style: { position: "relative", width: 360, height: 360, flexShrink: 0 } },
    rings.map((r, k) => e("div", { key: k, style: { position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)", width: r.d, height: r.d, borderRadius: "50%", background: k === 2 ? T.accent : mix(T.accent, r.op * 100, T.mode === "dark" ? "transparent" : "#fff"), border: `1.5px solid ${mix(T.accent, k === 2 ? 100 : 45)}`, display: "flex", alignItems: k === 2 ? "center" : "flex-start", justifyContent: "center", paddingTop: k === 2 ? 0 : 14 } },
      e("span", { style: { fontFamily: fD(T), fontWeight: 700, fontSize: k === 2 ? 30 : 17, color: k === 2 ? (T.mode === "dark" ? T.bg : "#fff") : T.text } }, editableText(r.k?.v || "", [A.k, r.key, "v"], X))
    ))
  );
  const legendItems: N[] = keys.map((key, k) => {
    const r = M[key];
    return e("div", { key: k, style: { display: "flex", gap: 16, alignItems: "flex-start" } },
      e("span", { key: "sw", style: { width: 14, height: 14, borderRadius: 4, marginTop: 5, background: mix(T.accent, [40, 68, 100][k]), flexShrink: 0 } }),
      e("div", { key: "tx" },
        e("div", { key: "r", style: { display: "flex", alignItems: "baseline", gap: 10 } },
          e("span", { key: "a", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 13, letterSpacing: ".12em", color: T.accent } }, ["TAM", "SAM", "SOM"][k]),
          e("span", { key: "v", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 28, letterSpacing: "-0.02em", color: T.text } }, editableText(r?.v || "", [A.k, key, "v"], X))
        ),
        e("div", { key: "l", style: { marginTop: 4, fontSize: 15.5, color: T.muted, lineHeight: 1.4 } }, editableText(r?.l || "", [A.k, key, "l"], X))
      )
    );
  });
  legendItems.push(e("div", { key: "note", style: { marginTop: 8, padding: "14px 18px", borderRadius: 12, background: T.mode === "dark" ? mix(T.surface, 70, T.bg) : mix(T.accent, 6, "#fff"), border: `1px solid ${border(T)}`, fontSize: 14, lineHeight: 1.5, color: T.muted } }, editableText(M.note, [A.k, "note"], X, { multiline: true })));
  const legend = e("div", { key: "leg", style: { display: "flex", flexDirection: "column", gap: 22, flex: 1 } }, legendItems);
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, A.eb),
    h1(T, editableText(M.headline, [A.k, "headline"], X), 46),
    e("div", { key: "g", style: { display: "flex", gap: 64, alignItems: "center", marginTop: "auto", marginBottom: "auto" } }, circle, legend)
  );
  return shell(T, C, i, inner, { total: A.total });
};

const model: SlideFn = (T, C, i, X, A) => {
  const M = sec(C, A.k, EMPTY_MODEL);
  const flowArr = M.flow || [];
  const flow = e("div", { key: "flow", style: { display: "flex", alignItems: "center", gap: 0, marginTop: 6 } },
    flowArr.map((f, k) => [
      e("div", { key: "n" + k, style: { flex: 1, textAlign: "center", padding: "13px 10px", borderRadius: 10, background: k === flowArr.length - 1 ? mix(T.accent, T.mode === "dark" ? 20 : 12, T.mode === "dark" ? "transparent" : "#fff") : (T.mode === "dark" ? mix(T.surface, 70, T.bg) : T.surface), border: `1px solid ${k === flowArr.length - 1 ? mix(T.accent, 40) : border(T)}`, fontSize: 13.5, fontWeight: 600, color: k === flowArr.length - 1 ? T.accent : T.text, fontFamily: fD(T) } }, editableText(f, [A.k, "flow", k], X)),
      k < flowArr.length - 1 ? e("span", { key: "ar" + k, style: { padding: "0 12px", color: T.accent, fontSize: 20, fontWeight: 700 } }, "→") : null
    ])
  );
  const streams = e("div", { key: "str", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 20, flex: 1 } },
    (M.streams || []).map((s, k) => e("div", { key: k, style: { ...cardStyle(T), borderRadius: 16, padding: "26px 26px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18 } },
      e("div", { key: "l" },
        e("div", { key: "t", style: { fontFamily: fD(T), fontWeight: 600, fontSize: 19, color: T.text, letterSpacing: "-0.01em" } }, editableText(s.t, [A.k, "streams", k, "t"], X)),
        e("div", { key: "d", style: { marginTop: 8, fontSize: 14, lineHeight: 1.5, color: T.muted, maxWidth: 300 } }, editableText(s.d, [A.k, "streams", k, "d"], X, { multiline: true }))
      ),
      e("div", { key: "v", style: { textAlign: "right", flexShrink: 0 } },
        e("div", { key: "a", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 34, letterSpacing: "-0.02em", color: T.accent, lineHeight: 1 } }, editableText(s.v, [A.k, "streams", k, "v"], X)),
        e("div", { key: "b", style: { fontSize: 12, color: T.muted, marginTop: 4 } }, editableText(s.vl, [A.k, "streams", k, "vl"], X))
      )
    ))
  );
  const tiers = e("div", { key: "tier", style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginTop: 20 } },
    (M.tiers || []).map((t, k) => e("div", { key: k, style: { border: `1px solid ${k === 1 ? mix(T.accent, 45) : border(T)}`, borderRadius: 13, padding: "16px 18px", background: k === 1 ? mix(T.accent, T.mode === "dark" ? 12 : 7, T.mode === "dark" ? "transparent" : "#fff") : "transparent" } },
      e("div", { key: "t", style: { fontSize: 13, fontWeight: 600, letterSpacing: ".04em", color: T.muted, textTransform: "uppercase" } }, editableText(t.t, [A.k, "tiers", k, "t"], X)),
      e("div", { key: "p", style: { marginTop: 8, display: "flex", alignItems: "baseline", gap: 3 } },
        e("span", { key: "a", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 24, color: T.text } }, editableText(t.p, [A.k, "tiers", k, "p"], X)),
        e("span", { key: "s", style: { fontSize: 13, color: T.muted } }, editableText(t.s, [A.k, "tiers", k, "s"], X))),
      e("div", { key: "d", style: { marginTop: 6, fontSize: 13.5, color: T.muted } }, editableText(t.d, [A.k, "tiers", k, "d"], X, { multiline: true }))
    ))
  );
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, A.eb),
    h1(T, editableText(M.headline, [A.k, "headline"], X), 42),
    flow, streams, tiers
  );
  return shell(T, C, i, inner, { total: A.total });
};

const traction: SlideFn = (T, C, i, X, A) => {
  const Tr = sec(C, A.k, EMPTY_TRACTION);
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, A.eb),
    h1(T, editableText(Tr.headline, [A.k, "headline"], X), 44),
    e("div", { key: "g", style: { display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 44, marginTop: 30, alignItems: "center", flex: 1 } },
      e("div", { key: "ch" },
        e("div", { key: "lab", style: { fontSize: 13, fontWeight: 600, letterSpacing: ".04em", color: T.muted, marginBottom: 16, textTransform: "uppercase" } }, editableText(Tr.sub, [A.k, "sub"], X)),
        areaChart(T, Tr.series || [], 520, 232, X, [A.k, "series"])
      ),
      e("div", { key: "kp", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } },
        (Tr.kpis || []).map((k, n) => e("div", { key: n, style: { ...cardStyle(T), borderRadius: 14, padding: "18px 18px" } },
          e("div", { key: "k", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 27, letterSpacing: "-0.02em", color: T.accent, lineHeight: 1 } }, editableText(k.k, [A.k, "kpis", n, "k"], X)),
          e("div", { key: "l", style: { marginTop: 7, fontSize: 13, lineHeight: 1.35, color: T.muted } }, editableText(k.l, [A.k, "kpis", n, "l"], X))
        ))
      )
    )
  );
  return shell(T, C, i, inner, { total: A.total });
};

const competition: SlideFn = (T, C, i, X, A) => {
  const Co = sec(C, A.k, EMPTY_COMPETITION);
  const cols = Co.cols || [];
  const rows = Co.rows || [];
  const grid = `1.6fr repeat(${Math.max(cols.length, 1)},1fr)`;
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, A.eb),
    h1(T, editableText(Co.headline, [A.k, "headline"], X), 44),
    e("div", { key: "tbl", style: { marginTop: 34, border: `1px solid ${border(T)}`, borderRadius: 16, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" } },
      e("div", { key: "hd", style: { display: "grid", gridTemplateColumns: grid, background: T.mode === "dark" ? mix(T.surface, 80, T.bg) : mix(T.accent, 5, "#fff"), borderBottom: `1px solid ${border(T)}` } },
        e("div", { key: "f", style: { padding: "16px 22px" } }),
        cols.map((c, k) => e("div", { key: k, style: { padding: "16px 10px", textAlign: "center", fontFamily: fD(T), fontWeight: k === 0 ? 700 : 600, fontSize: 14.5, color: k === 0 ? T.accent : T.text, background: k === 0 ? mix(T.accent, T.mode === "dark" ? 12 : 7, "transparent") : "transparent" } }, editableText(c, [A.k, "cols", k], X)))
      ),
      rows.map((r, k) => e("div", { key: k, style: { display: "grid", gridTemplateColumns: grid, borderBottom: k < rows.length - 1 ? `1px solid ${border(T)}` : "none", flex: 1, alignItems: "center" } },
        e("div", { key: "f", style: { padding: "0 22px", fontSize: 15, fontWeight: 500, color: T.text } }, editableText(r.f, [A.k, "rows", k, "f"], X)),
        (r.v || []).map((v, n) => e("div", { key: n, style: { display: "flex", justifyContent: "center", alignItems: "center", height: "100%", background: n === 0 ? mix(T.accent, T.mode === "dark" ? 12 : 7, "transparent") : "transparent" } }, check(T, v)))
      ))
    )
  );
  return shell(T, C, i, inner, { total: A.total });
};

const roadmap: SlideFn = (T, C, i, X, A) => {
  const R = sec(C, A.k, EMPTY_ROADMAP);
  const items = R.items || [];
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, A.eb),
    e("div", { key: "hd", style: { maxWidth: 760 } }, h1(T, editableText(R.headline, [A.k, "headline"], X), 44),
      e("p", { key: "s", style: { margin: "16px 0 0", fontSize: 18, color: T.muted } }, editableText(R.sub, [A.k, "sub"], X, { multiline: true }))),
    e("div", { key: "tl", style: { display: "flex", gap: 20, marginTop: 34, flex: 1 } },
      items.map((it, k) => e("div", { key: k, style: { flex: 1, display: "flex", flexDirection: "column" } },
        e("div", { key: "hd", style: { display: "flex", alignItems: "center", marginBottom: 18 } },
          e("span", { key: "dot", style: { width: 16, height: 16, borderRadius: "50%", background: T.accent, flexShrink: 0, boxShadow: `0 0 0 4px ${mix(T.accent, 20, T.bg)}` } }),
          e("span", { key: "ln", style: { flex: 1, height: 2, marginLeft: 4, background: k < items.length - 1 ? mix(T.accent, 28) : "transparent" } })
        ),
        e("div", { key: "card", style: { ...cardStyle(T), borderRadius: 16, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 24px" } },
          e("div", { key: "q", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 13, letterSpacing: ".06em", color: T.accent } }, editableText(it.q, [A.k, "items", k, "q"], X)),
          e("div", { key: "t", style: { marginTop: 12, fontFamily: fD(T), fontWeight: 600, fontSize: 21, color: T.text, letterSpacing: "-0.01em" } }, editableText(it.t, [A.k, "items", k, "t"], X)),
          e("div", { key: "d", style: { marginTop: 12, fontSize: 14.5, lineHeight: 1.55, color: T.muted } }, editableText(it.d, [A.k, "items", k, "d"], X, { multiline: true }))
        )
      ))
    )
  );
  return shell(T, C, i, inner, { total: A.total });
};

const gallerySlide: SlideFn = (T, C, i, X, A) => {
  const G = sec(C, A.k, EMPTY_GALLERY);
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, A.eb),
    e("div", { key: "hd", style: { maxWidth: 840 } }, h1(T, editableText(G.headline, [A.k, "headline"], X), 44),
      e("p", { key: "s", style: { margin: "16px 0 0", fontSize: 18, color: T.muted } }, editableText(G.sub, [A.k, "sub"], X, { multiline: true }))),
    e("div", { key: "grid", style: { marginTop: 30, flex: 1, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gridTemplateRows: "1fr 1fr", gap: 16 } },
      (G.slots || []).map((s, k) => {
        // Match an uploaded image by slot id, else by position.
        const imgs = C._assets?.galleryImages || [];
        const found = imgs.find((g) => g.slot === s.id) || imgs[k];
        return e("div", { key: s.id || k, style: { gridColumn: s.span ? "span 2" : "span 1", position: "relative", borderRadius: 16, overflow: "hidden", background: T.mode === "dark" ? mix(T.surface, 72, T.bg) : mix(T.accent, 5, "#fff"), border: `1px solid ${border(T)}` } },
          found
            ? e("img", { key: "im", src: found.url, alt: s.ph, style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" } })
            : imgSlot(T, editableText(s.ph, [A.k, "slots", k, "ph"], X))
        );
      })
    )
  );
  return shell(T, C, i, inner, { total: A.total });
};

const team: SlideFn = (T, C, i, X, A) => {
  const Tm = sec(C, A.k, EMPTY_TEAM);
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, A.eb),
    h1(T, editableText(Tm.headline, [A.k, "headline"], X), 44),
    e("div", { key: "g", style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, marginTop: 30, flex: 1 } },
      (Tm.members || []).map((m, k) => e("div", { key: k, style: { ...cardStyle(T), display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, padding: "30px 26px" } },
        avatar(T, editableText(m.i, [A.k, "members", k, "i"], X)),
        e("div", { key: "tx" },
          e("div", { key: "n", style: { fontFamily: fD(T), fontWeight: 600, fontSize: 19, color: T.text, letterSpacing: "-0.01em" } }, editableText(m.n, [A.k, "members", k, "n"], X)),
          e("div", { key: "r", style: { marginTop: 4, fontSize: 13.5, fontWeight: 600, color: T.accent } }, editableText(m.r, [A.k, "members", k, "r"], X)),
          e("div", { key: "b", style: { marginTop: 11, fontSize: 13.5, lineHeight: 1.5, color: T.muted } }, editableText(m.b, [A.k, "members", k, "b"], X, { multiline: true }))
        )
      ))
    ),
    Tm.advisors ? e("div", { key: "adv", style: { marginTop: 24, paddingTop: 20, borderTop: `1px solid ${border(T)}`, fontSize: 15, color: T.muted } }, editableText(Tm.advisors, [A.k, "advisors"], X, { multiline: true })) : null
  );
  return shell(T, C, i, inner, { total: A.total });
};

const ask: SlideFn = (T, C, i, X, A) => {
  const Ak = sec(C, A.k, EMPTY_ASK);
  const use = Ak.use || [];
  const colors = [T.accent, mix(T.accent, 72), mix(T.accent2, 80), mix(T.muted, 55)];
  const bar = e("div", { key: "bar", style: { display: "flex", height: 18, borderRadius: 9, overflow: "hidden", marginBottom: 26 } },
    use.map((u, k) => e("div", { key: k, style: { width: u.p + "%", background: colors[k % colors.length] } })));
  const legend = e("div", { key: "leg", style: { display: "flex", flexDirection: "column", gap: 16 } },
    use.map((u, k) => e("div", { key: k, style: { display: "flex", alignItems: "center", gap: 14 } },
      e("span", { key: "s", style: { width: 13, height: 13, borderRadius: 4, background: colors[k % colors.length] } }),
      e("span", { key: "l", style: { flex: 1, fontSize: 16, color: T.text, fontWeight: 500 } }, editableText(u.l, [A.k, "use", k, "l"], X)),
      e("span", { key: "p", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 18, color: T.text } },
        editableText(String(u.p), [A.k, "use", k, "p"], X, { numeric: true }), "%")
    )));
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, A.eb),
    e("div", { key: "g", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, marginTop: "auto", marginBottom: "auto", alignItems: "center" } },
      e("div", { key: "l" },
        e("h1", { key: "h", style: { margin: 0, fontFamily: fD(T), fontWeight: T.serif ? 600 : 700, fontSize: 54, lineHeight: 1.02, letterSpacing: "-0.03em", color: T.text } }, editableText(Ak.headline, [A.k, "headline"], X)),
        e("p", { key: "s", style: { margin: "22px 0 0", fontSize: 18.5, lineHeight: 1.5, color: T.muted, maxWidth: 420 } }, editableText(Ak.sub, [A.k, "sub"], X, { multiline: true }))
      ),
      e("div", { key: "r", style: { ...cardStyle(T), padding: "30px 32px" } },
        e("div", { key: "t", style: { fontSize: 13, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: T.muted, marginBottom: 18 } }, A.k === "ask" ? "Use of funds" : "Allocation"),
        bar, legend
      )
    )
  );
  return shell(T, C, i, inner, { total: A.total });
};

const closing: SlideFn = (T, C, i, X, A) => {
  const Cl = sec(C, A.k, EMPTY_CLOSING);
  const deco = e("div", { key: "dc", style: { position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" } },
    e("div", { key: 1, style: { position: "absolute", left: -140, bottom: -160, width: 420, height: 420, borderRadius: "50%", background: mix(T.accent, T.mode === "dark" ? 16 : 10, "transparent"), filter: "blur(8px)" } }),
    e("div", { key: 2, style: { position: "absolute", right: -100, top: -120, width: 320, height: 320, borderRadius: "50%", background: mix(T.accent2, T.mode === "dark" ? 18 : 12, "transparent"), filter: "blur(8px)" } })
  );
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 820 } },
    eyebrow(T, A.eb),
    e("h1", { key: "h", style: { margin: 0, fontFamily: fD(T), fontWeight: T.serif ? 600 : 700, fontSize: 62, lineHeight: 1.02, letterSpacing: "-0.03em", color: T.text } }, editableText(Cl.headline, [A.k, "headline"], X)),
    e("p", { key: "s", style: { margin: "24px 0 36px", fontSize: 20, lineHeight: 1.5, color: T.muted, maxWidth: 560 } }, editableText(Cl.sub, [A.k, "sub"], X, { multiline: true })),
    e("div", { key: "c", style: { display: "flex", gap: 14, flexWrap: "wrap" } },
      X.editable
        ? e("span", { key: "m", style: { textDecoration: "none", fontFamily: fD(T), fontWeight: 600, fontSize: 16, color: T.mode === "dark" ? T.bg : "#fff", background: T.accent, padding: "13px 24px", borderRadius: 999, display: "inline-block" } }, editableText(Cl.contact, [A.k, "contact"], X))
        : e("a", { key: "m", href: "mailto:" + Cl.contact, style: { textDecoration: "none", fontFamily: fD(T), fontWeight: 600, fontSize: 16, color: T.mode === "dark" ? T.bg : "#fff", background: T.accent, padding: "13px 24px", borderRadius: 999 } }, Cl.contact),
      e("span", { key: "w", style: { fontFamily: fD(T), fontWeight: 600, fontSize: 16, color: T.text, padding: "13px 24px", borderRadius: 999, border: `1px solid ${border(T, true)}` } }, editableText(Cl.site, [A.k, "site"], X))
    )
  );
  return shell(T, C, i, inner, { deco, total: A.total });
};

// ── Sales: customer proof ────────────────────────────────────────────────────

const proof: SlideFn = (T, C, i, X, A) => {
  const P = sec(C, A.k, EMPTY_PROOF);
  const cases = P.cases || [];
  const logos = P.logos || [];
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, A.eb),
    e("div", { key: "hd", style: { maxWidth: 840 } },
      h1(T, editableText(P.headline, [A.k, "headline"], X), 44),
      e("p", { key: "s", style: { margin: "16px 0 0", fontSize: 18, lineHeight: 1.5, color: T.muted } }, editableText(P.sub, [A.k, "sub"], X, { multiline: true }))),
    e("div", { key: "cs", style: { display: "flex", gap: 20, marginTop: 32, flex: 1 } },
      cases.map((c, k) => e("div", { key: k, style: { ...cardStyle(T, k === 0), flex: 1, display: "flex", flexDirection: "column", padding: "28px 28px 24px" } },
        e("div", { key: "cust", style: { fontSize: 12, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: k === 0 ? T.accent : T.muted } }, editableText(c.c, [A.k, "cases", k, "c"], X)),
        e("div", { key: "m", style: { marginTop: 18, fontFamily: fD(T), fontWeight: 700, fontSize: 46, letterSpacing: "-0.03em", lineHeight: 1, color: T.accent } }, editableText(c.m, [A.k, "cases", k, "m"], X)),
        e("div", { key: "ml", style: { marginTop: 8, fontSize: 14, lineHeight: 1.4, color: T.muted } }, editableText(c.ml, [A.k, "cases", k, "ml"], X)),
        e("div", { key: "d", style: { marginTop: 18, fontSize: 14.5, lineHeight: 1.55, color: T.muted } }, editableText(c.d, [A.k, "cases", k, "d"], X, { multiline: true })),
        c.q
          ? e("div", { key: "q", style: { marginTop: "auto", paddingTop: 18, borderTop: `1px solid ${border(T)}`, fontSize: 14, lineHeight: 1.5, fontStyle: "italic", color: T.text } },
              "“", editableText(c.q, [A.k, "cases", k, "q"], X, { multiline: true }), "”")
          : null
      ))
    ),
    logos.length
      ? e("div", { key: "lg", style: { marginTop: 24, paddingTop: 20, borderTop: `1px solid ${border(T)}`, display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" } },
          logos.map((l, k) => e("span", { key: k, style: { fontFamily: fD(T), fontWeight: 600, fontSize: 15, letterSpacing: ".02em", color: T.muted } }, editableText(l, [A.k, "logos", k], X))))
      : null
  );
  return shell(T, C, i, inner, { total: A.total });
};

// ── Product: who it's for ────────────────────────────────────────────────────

const persona: SlideFn = (T, C, i, X, A) => {
  const P = sec(C, A.k, EMPTY_PERSONA);
  const list = (title: string, items: { k: string; t: string }[], field: string, accent: boolean): N =>
    e("div", { style: { ...cardStyle(T, accent), flex: 1, display: "flex", flexDirection: "column", padding: "26px 28px" } },
      e("div", { key: "lab", style: { fontSize: 12, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: accent ? T.accent : T.muted } }, title),
      e("div", { key: "it", style: { marginTop: 20, display: "flex", flexDirection: "column", gap: 16 } },
        (items || []).map((it, k) => e("div", { key: k, style: { display: "flex", gap: 12, alignItems: "flex-start" } },
          e("span", { key: "d", style: { width: 8, height: 8, borderRadius: "50%", marginTop: 8, flexShrink: 0, background: accent ? T.accent : mix(T.muted, 70) } }),
          e("div", { key: "t", style: { fontSize: 15, lineHeight: 1.5, color: T.muted } },
            e("span", { key: "k", style: { fontWeight: 700, color: T.text } }, editableText(it.k, [A.k, field, k, "k"], X)),
            " — ",
            editableText(it.t, [A.k, field, k, "t"], X, { multiline: true }))
        ))
      )
    );
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, A.eb),
    e("div", { key: "hd", style: { maxWidth: 880 } },
      h1(T, editableText(P.headline, [A.k, "headline"], X), 44),
      e("p", { key: "s", style: { margin: "14px 0 0", fontSize: 18, lineHeight: 1.5, color: T.muted } }, editableText(P.sub, [A.k, "sub"], X, { multiline: true }))),
    e("div", { key: "who", style: { marginTop: 22, display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" } },
      e("span", { key: "w", style: { fontFamily: fD(T), fontWeight: 600, fontSize: 17, color: T.text, padding: "11px 18px", borderRadius: 999, background: mix(T.accent, T.mode === "dark" ? 18 : 12, T.mode === "dark" ? "transparent" : "#fff"), border: `1px solid ${mix(T.accent, 34)}` } }, editableText(P.who, [A.k, "who"], X, { multiline: true })),
      e("span", { key: "c", style: { fontSize: 15, lineHeight: 1.5, color: T.muted, paddingTop: 12 } }, editableText(P.context, [A.k, "context"], X, { multiline: true }))
    ),
    e("div", { key: "cols", style: { display: "flex", gap: 20, marginTop: 24, flex: 1 } },
      list("Jobs to be done", P.jobs, "jobs", true),
      list("Today's friction", P.pains, "pains", false)
    ),
    P.quote
      ? e("div", { key: "q", style: { marginTop: 20, fontSize: 16, lineHeight: 1.5, fontStyle: "italic", color: T.text } },
          "“", editableText(P.quote, [A.k, "quote"], X, { multiline: true }), "”")
      : null
  );
  return shell(T, C, i, inner, { total: A.total });
};

// ── Vision: one idea, stated plainly ─────────────────────────────────────────

const vision: SlideFn = (T, C, i, X, A) => {
  const V = sec(C, A.k, EMPTY_VISION);
  const deco = e("div", { key: "dc", style: { position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" } },
    e("div", { key: 1, style: { position: "absolute", right: -180, top: -140, width: 520, height: 520, borderRadius: "50%", background: mix(T.accent, T.mode === "dark" ? 15 : 9, "transparent"), filter: "blur(12px)" } }),
    e("div", { key: 2, style: { position: "absolute", left: -120, bottom: -180, width: 400, height: 400, borderRadius: "50%", background: mix(T.accent2, T.mode === "dark" ? 14 : 9, "transparent"), filter: "blur(10px)" } })
  );
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 940 } },
    eyebrow(T, A.eb),
    V.horizon
      ? e("div", { key: "hz", style: { marginBottom: 18 } },
          e("span", { style: { fontFamily: fD(T), fontWeight: 600, fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase", color: T.text, padding: "8px 16px", borderRadius: 999, border: `1px solid ${mix(T.accent, 40)}`, background: mix(T.accent, T.mode === "dark" ? 14 : 9, T.mode === "dark" ? "transparent" : "#fff") } }, editableText(V.horizon, [A.k, "horizon"], X)))
      : null,
    e("h1", { key: "h", style: { margin: 0, fontFamily: fD(T), fontWeight: T.serif ? 600 : 700, fontSize: 58, lineHeight: 1.08, letterSpacing: "-0.03em", color: T.text, textWrap: "balance" } as React.CSSProperties }, editableText(V.headline, [A.k, "headline"], X, { multiline: true })),
    V.statement
      ? e("p", { key: "st", style: { margin: "26px 0 0", fontSize: 21, lineHeight: 1.5, color: T.accent, fontWeight: 500, maxWidth: 720 } }, editableText(V.statement, [A.k, "statement"], X, { multiline: true }))
      : null,
    e("p", { key: "sb", style: { margin: "18px 0 0", fontSize: 17, lineHeight: 1.55, color: T.muted, maxWidth: 660 } }, editableText(V.sub, [A.k, "sub"], X, { multiline: true })),
    (V.proofPoints || []).length
      ? e("div", { key: "pp", style: { marginTop: 40 } }, kpiTiles(T, V.proofPoints, [A.k, "proofPoints"], X, Math.min((V.proofPoints || []).length, 3)))
      : null
  );
  return shell(T, C, i, inner, { deco, total: A.total });
};

// ── Renderer table ───────────────────────────────────────────────────────────

/**
 * Renderer id → slide function. The id comes from the deck-type registry, and
 * `backend/test_deck_registry.py::test_spec_is_complete` fails if the backend
 * ever names one that is missing here.
 */
const RENDERERS: Record<RendererId, SlideFn> = {
  cover, summary, probsol, product, market, model, traction, competition,
  roadmap, gallery: gallerySlide, team, ask, closing, proof, persona, vision,
};

const DEFAULT_ORDER = slideOrder(DEFAULT_DECK_TYPE);

/** Render a single 1280×720 slide (used by the deck view and thumbnails). */
export function renderSlide(
  theme: Theme,
  data: TemplateDeckData,
  index: number,
  editCtx: EditCtx = VIEW_CTX,
  order: SlideSlot[] = DEFAULT_ORDER
): N {
  const slot = order[index] ?? order[0] ?? DEFAULT_ORDER[0];
  const fn = RENDERERS[slot.renderer] ?? cover;
  return fn(theme, data, index, editCtx, { k: slot.key, eb: slot.eyebrow, total: order.length });
}

// ── Interactive deck component ───────────────────────────────────────────────

interface TemplatedDeckProps {
  data: TemplateDeckData;
  theme: Theme;
  /** The deck's slide sequence. Defaults to the investor order, which is what
   * every project generated before multi-deck support is. */
  order?: SlideSlot[];
  /** Enables click-to-edit on the deck's text/numbers. Fullscreen present mode
   * always stays view-only regardless of this flag — presenting should never
   * be interactive. */
  editable?: boolean;
  onEdit?: (path: EditPath, value: string | number) => void;
}

export function TemplatedDeck({ data, theme, order = DEFAULT_ORDER, editable = false, onEdit }: TemplatedDeckProps): JSX.Element {
  const [si, setSi] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fsRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [fs, setFs] = useState(false);
  const [vp, setVp] = useState({ w: 1280, h: 720 });
  const [active, setActive] = useState<ActiveEdit | null>(null);

  const LAST = Math.max(0, order.length - 1);

  const editCtx: EditCtx = React.useMemo(
    () => ({
      editable,
      active,
      onActivate: (path, value, opts) => setActive({ key: path.join("."), path, value: String(value), ...opts }),
    }),
    [editable, active]
  );

  const commitEdit = (path: EditPath, value: string | number) => {
    onEdit?.(path, value);
    setActive(null);
  };
  const cancelEdit = () => setActive(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(Math.max(0.1, el.clientWidth / 1280));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A shorter deck (or a switch between deck types) can leave the cursor past
  // the end — clamp rather than rendering a blank slide.
  useEffect(() => {
    setSi((s) => Math.min(s, LAST));
  }, [LAST]);

  const next = () => setSi((s) => Math.min(s + 1, LAST));
  const prev = () => setSi((s) => Math.max(s - 1, 0));

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (active) return; // an edit input is open — let its own keydown handler own the keyboard
      if (ev.key === "ArrowRight") next();
      else if (ev.key === "ArrowLeft") prev();
      else if (ev.key === "Escape" && fs) setFs(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fs, active, LAST]);

  // Fullscreen: track viewport, lock page scroll, try native fullscreen.
  useEffect(() => {
    if (!fs) return;
    const measure = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    fsRef.current?.requestFullscreen?.().catch(() => {});
    const onFsChange = () => { if (!document.fullscreenElement) setFs(false); };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      window.removeEventListener("resize", measure);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("fullscreenchange", onFsChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [fs]);

  const fsScale = Math.max(0.1, Math.min((vp.w - 48) / 1280, (vp.h - 110) / 720));

  const dots = (
    <div className="flex items-center gap-1.5">
      {order.map((s, k) => (
        <button key={s.key} onClick={() => setSi(k)} title={s.eyebrow || s.key}
          style={{ width: k === si ? 22 : 8, height: 8, borderRadius: 999, border: "none", padding: 0, cursor: "pointer", background: k === si ? theme.accent : "rgba(120,120,140,.35)", transition: "all .18s ease" }} />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Slide stage */}
      <div ref={wrapRef} style={{ width: "100%", position: "relative" }}>
        <button
          onClick={() => setFs(true)}
          title="Fullscreen (present)"
          className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
          style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)" }}
        >
          <Maximize2 size={14} /> Fullscreen
        </button>
        <div style={{ width: "100%", height: 720 * scale, overflow: "hidden", borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}>
          <div style={{ width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            {renderSlide(theme, data, si, editCtx, order)}
          </div>
        </div>
        {editable && (
          <FloatingTextEditor active={active} containerRef={wrapRef} scale={scale} onCommit={commitEdit} onCancel={cancelEdit} />
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <button onClick={prev} disabled={si === 0}
          className="px-3 py-1.5 rounded-lg border border-border text-text-secondary text-sm disabled:opacity-40 hover:bg-surface transition-colors">
          ← Prev
        </button>
        {dots}
        <button onClick={next} disabled={si === LAST}
          className="px-3 py-1.5 rounded-lg border border-border text-text-secondary text-sm disabled:opacity-40 hover:bg-surface transition-colors">
          Next →
        </button>
      </div>

      {/* Fullscreen presentation overlay */}
      {fs && (
        <div ref={fsRef} style={{ position: "fixed", inset: 0, zIndex: 1000, background: theme.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <button onClick={() => setFs(false)} title="Exit (Esc)"
            className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ color: theme.text, background: mix(theme.accent, theme.mode === "dark" ? 18 : 12, theme.mode === "dark" ? "transparent" : "#fff"), border: `1px solid ${mix(theme.accent, 34)}` }}>
            <XIcon size={16} /> Exit
          </button>

          <div style={{ width: 1280, height: 720, transform: `scale(${fsScale})`, transformOrigin: "center center", borderRadius: 14, overflow: "hidden", boxShadow: "0 30px 90px rgba(0,0,0,.5)" }}>
            {renderSlide(theme, data, si, VIEW_CTX, order)}
          </div>

          {/* Edge nav zones */}
          <button onClick={prev} disabled={si === 0} aria-label="Previous"
            style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "12%", border: "none", background: "transparent", cursor: si === 0 ? "default" : "pointer" }} />
          <button onClick={next} disabled={si === LAST} aria-label="Next"
            style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "12%", border: "none", background: "transparent", cursor: si === LAST ? "default" : "pointer" }} />

          <div style={{ position: "absolute", bottom: 22, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            {dots}
            <span style={{ font: "400 12px var(--font-body)", color: theme.muted }}>
              {si + 1} / {order.length} · ← → to navigate · Esc to exit
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
