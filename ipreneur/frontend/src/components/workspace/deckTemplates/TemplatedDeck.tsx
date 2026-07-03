/**
 * TemplatedDeck — the 10-theme, 12-slide pitch-deck renderer.
 *
 * Ported from the Claude template artifact (React.createElement style kept to
 * stay faithful to the original layouts). Renders a fixed 1280×720 slide and
 * scales it to fit the container; includes prev/next + dot navigation.
 *
 * `renderSlide(theme, data, index)` is also exported for thumbnails.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { Theme, mix, border, fD } from "./themes";
import { TemplateDeckData, DECK_SLIDE_ORDER } from "./types";

const e = React.createElement;
type N = React.ReactNode;

// ── Shared bits ──────────────────────────────────────────────────────────────

function eyebrow(T: Theme, txt: string): N {
  return e("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 22 } },
    e("span", { key: "d", style: { width: 26, height: 3, borderRadius: 2, background: T.accent } }),
    e("span", { key: "t", style: { fontFamily: fD(T), fontSize: 13, fontWeight: 600, letterSpacing: T.upper ? ".16em" : ".04em", textTransform: T.upper ? "uppercase" : "none", color: T.accent } }, txt)
  );
}

function h1(T: Theme, txt: string, size?: number): N {
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

interface ShellOpts { noFoot?: boolean; deco?: N; pad?: number }
function shell(T: Theme, C: TemplateDeckData, no: number, inner: N, opts: ShellOpts = {}): N {
  const foot = opts.noFoot ? null : e("div", { key: "foot", style: { position: "absolute", left: opts.pad || 80, right: opts.pad || 80, bottom: 32, display: "flex", justifyContent: "space-between", alignItems: "center" } },
    logo(T, C),
    e("span", { key: "p", style: { fontFamily: fD(T), fontSize: 12, fontWeight: 500, letterSpacing: ".04em", color: T.muted } }, (no < 9 ? "0" : "") + (no + 1) + " / 12")
  );
  return e("div", { style: { position: "relative", width: 1280, height: 720, background: T.bg, color: T.text, fontFamily: T.fontB + ", sans-serif", padding: opts.pad ? `64px ${opts.pad}px 88px` : "62px 80px 88px", display: "flex", flexDirection: "column", overflow: "hidden" } },
    opts.deco || null, inner, foot);
}

function areaChart(T: Theme, series: { y: string; v: number }[], w: number, h: number): N {
  const safe = series && series.length ? series : [{ y: "", v: 1 }];
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
    safe.map((s, i) => e("text", { key: "lx" + i, x: px(i), y: h + 24, textAnchor: i === 0 ? "start" : i === n - 1 ? "end" : "middle", fontSize: 13, fontFamily: T.fontB, fill: T.muted }, s.y)),
    safe.map((s, i) => e("text", { key: "lv" + i, x: px(i), y: py(s.v) - 14, textAnchor: "middle", fontSize: 13, fontWeight: 700, fontFamily: fD(T), fill: T.text }, "$" + s.v + "M"))
  );
}

function check(T: Theme, on: boolean): N {
  if (on) return e("svg", { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none" }, e("path", { d: "M5 12.5l4 4 10-10", stroke: T.accent, strokeWidth: 2.6, strokeLinecap: "round", strokeLinejoin: "round" }));
  return e("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none" }, e("path", { d: "M7 7l10 10M17 7L7 17", stroke: T.muted, strokeWidth: 2, strokeLinecap: "round", opacity: 0.5 }));
}

function kpiTiles(T: Theme, kpis: { k: string; l: string }[], cols?: number): N {
  return e("div", { style: { display: "grid", gridTemplateColumns: `repeat(${cols || (kpis || []).length || 1},1fr)`, gap: 14 } },
    (kpis || []).map((k, i) => e("div", { key: i, style: { background: T.mode === "dark" ? mix(T.surface, 75, T.bg) : T.surface, border: `1px solid ${border(T)}`, borderRadius: 14, padding: "18px 18px 16px" } },
      e("div", { key: "k", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 30, letterSpacing: "-0.02em", color: T.accent, lineHeight: 1 } }, k.k),
      e("div", { key: "l", style: { marginTop: 8, fontSize: 13, lineHeight: 1.35, color: T.muted } }, k.l)
    ))
  );
}

// Image placeholder tile — our decks have no uploaded images yet, so render a
// themed empty-media state (icon + caption). Swap for a real <img> once images
// are wired into template_data.
function imgSlot(T: Theme, caption: string): N {
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
function avatar(T: Theme, initials: string): N {
  return e("div", { style: { width: 84, height: 84, borderRadius: "50%", padding: 3, background: mix(T.accent, T.mode === "dark" ? 22 : 13, T.mode === "dark" ? "transparent" : "#fff"), border: `1px solid ${mix(T.accent, 32)}`, flexShrink: 0 } },
    e("div", { style: { width: "100%", height: "100%", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fD(T), fontWeight: 700, fontSize: 24, color: T.accent, background: mix(T.accent, T.mode === "dark" ? 14 : 8, T.mode === "dark" ? "transparent" : "#fff") } }, initials)
  );
}

// ── Slides ───────────────────────────────────────────────────────────────────

function cover(T: Theme, C: TemplateDeckData, i: number): N {
  const deco = e("div", { key: "dc", style: { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" } },
    e("div", { key: 1, style: { position: "absolute", right: -120, top: -120, width: 460, height: 460, borderRadius: "50%", background: mix(T.accent2, T.mode === "dark" ? 22 : 16, "transparent"), filter: "blur(10px)" } }),
    e("div", { key: 2, style: { position: "absolute", right: 120, bottom: -160, width: 380, height: 380, borderRadius: "50%", background: mix(T.accent, T.mode === "dark" ? 20 : 14, "transparent"), filter: "blur(6px)" } }),
    e("div", { key: 3, style: { position: "absolute", right: 90, top: 150, width: 220, height: 220, borderRadius: "50%", border: `1.5px solid ${border(T, true)}` } })
  );
  const inner = e("div", { key: "in", style: { display: "flex", flexDirection: "column", height: "100%" } },
    e("div", { key: "top", style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
      logo(T, C),
      e("span", { key: "y", style: { fontFamily: fD(T), fontSize: 12, fontWeight: 500, letterSpacing: ".14em", textTransform: "uppercase", color: T.muted } }, C.eyebrow + " · " + C.year)
    ),
    e("div", { key: "mid", style: { marginTop: "auto", marginBottom: "auto", maxWidth: 760 } },
      eyebrow(T, C.eyebrow || "Investor Presentation"),
      e("h1", { key: "co", style: { margin: "0 0 4px", fontFamily: fD(T), fontWeight: T.serif ? 600 : 700, fontSize: 96, lineHeight: 0.96, letterSpacing: "-0.035em", color: T.text } }, C.company),
      e("p", { key: "tg", style: { margin: "22px 0 0", fontSize: 23, lineHeight: 1.4, color: T.muted, maxWidth: 560, fontWeight: 400 } }, C.tagline)
    ),
    e("div", { key: "bot", style: { display: "flex", alignItems: "center", gap: 16 } },
      e("span", { key: "r", style: { fontFamily: fD(T), fontWeight: 600, fontSize: 15, color: T.text, padding: "9px 16px", borderRadius: 999, background: mix(T.accent, T.mode === "dark" ? 18 : 12, T.mode === "dark" ? "transparent" : "#fff"), border: `1px solid ${mix(T.accent, 34)}` } }, C.round),
      e("span", { key: "c", style: { fontSize: 13, color: T.muted, letterSpacing: ".04em" } }, "Confidential")
    )
  );
  return shell(T, C, i, inner, { noFoot: true, deco });
}

function summary(T: Theme, C: TemplateDeckData, i: number): N {
  const S = C.summary;
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" } },
    eyebrow(T, "Executive summary"),
    e("div", { key: "hd", style: { maxWidth: 920 } },
      h1(T, S.headline, 50),
      e("p", { key: "l", style: { margin: "24px 0 0", fontSize: 20, lineHeight: 1.6, color: T.muted, maxWidth: 860 } }, S.lead)
    ),
    e("div", { key: "kp", style: { marginTop: 52 } }, kpiTiles(T, S.highlights || [], 4))
  );
  return shell(T, C, i, inner);
}

function probsol(T: Theme, C: TemplateDeckData, i: number): N {
  const PS = C.probsol;
  const card = (title: string, lead: string, items: { k: string; t: string }[], foot: string, solution: boolean): N =>
    e("div", { style: { flex: 1, display: "flex", flexDirection: "column", background: solution ? mix(T.accent, T.mode === "dark" ? 13 : 7, T.mode === "dark" ? "transparent" : "#fff") : (T.mode === "dark" ? mix(T.surface, 72, T.bg) : T.surface), border: `1px solid ${solution ? mix(T.accent, 42) : border(T)}`, borderRadius: 18, padding: "28px 30px" } },
      e("div", { key: "lab", style: { fontSize: 12, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: solution ? T.accent : T.muted } }, title),
      e("div", { key: "ld", style: { marginTop: 11, fontFamily: fD(T), fontWeight: 600, fontSize: 22, lineHeight: 1.2, letterSpacing: "-0.01em", color: T.text } }, lead),
      e("div", { key: "it", style: { marginTop: 24, display: "flex", flexDirection: "column", gap: 18 } },
        (items || []).map((it, k) => e("div", { key: k, style: { display: "flex", gap: 13, alignItems: "flex-start" } },
          e("span", { key: "d", style: { width: 8, height: 8, borderRadius: "50%", marginTop: 8, flexShrink: 0, background: solution ? T.accent : mix(T.muted, 70) } }),
          e("div", { key: "t", style: { fontSize: 15.5, lineHeight: 1.55, color: T.muted } },
            e("span", { key: "k", style: { fontWeight: 700, color: T.text } }, it.k),
            " — " + it.t)
        ))
      ),
      e("div", { key: "ft", style: { marginTop: "auto", paddingTop: 20, borderTop: `1px solid ${border(T)}`, display: "flex", gap: 11, alignItems: "center" } },
        e("span", { key: "b", style: { width: 24, height: 3, borderRadius: 2, flexShrink: 0, background: solution ? T.accent : mix(T.muted, 60) } }),
        e("span", { key: "t", style: { fontSize: 14.5, lineHeight: 1.45, fontWeight: 600, color: solution ? T.accent : T.text } }, foot)
      )
    );
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, "Problem & solution"),
    e("div", { key: "hd", style: { maxWidth: 860 } },
      h1(T, PS.headline, 44),
      e("p", { key: "s", style: { margin: "16px 0 0", fontSize: 18, color: T.muted } }, PS.sub)),
    e("div", { key: "cards", style: { display: "flex", gap: 22, marginTop: 26, flex: 1 } },
      card(PS.problemTitle, PS.problemLead, PS.problem, PS.problemFoot, false),
      card(PS.solutionTitle, PS.solutionLead, PS.solution, PS.solutionFoot, true)
    )
  );
  return shell(T, C, i, inner);
}

function product(T: Theme, C: TemplateDeckData, i: number): N {
  const P = C.product;
  const steps = P.steps || [];
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, "Product"),
    e("div", { key: "hd", style: { maxWidth: 820 } }, h1(T, P.headline, 46),
      e("p", { key: "s", style: { margin: "18px 0 0", fontSize: 18, lineHeight: 1.5, color: T.muted } }, P.sub)),
    e("div", { key: "st", style: { display: "flex", gap: 20, marginTop: 34, flex: 1 } },
      steps.map((s, k) => e("div", { key: k, style: { flex: 1, display: "flex", flexDirection: "column", background: T.mode === "dark" ? mix(T.surface, 72, T.bg) : T.surface, border: `1px solid ${border(T)}`, borderRadius: 18, padding: "28px 28px 26px" } },
        e("div", { key: "row", style: { display: "flex", alignItems: "center", gap: 14 } },
          e("div", { key: "n", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 17, color: T.accent, width: 46, height: 46, borderRadius: 13, background: mix(T.accent, T.mode === "dark" ? 20 : 12, T.mode === "dark" ? "transparent" : "#fff"), display: "flex", alignItems: "center", justifyContent: "center" } }, s.n),
          e("div", { key: "ln", style: { flex: 1, height: 2, background: mix(T.accent, 28) } })
        ),
        e("div", { key: "mid", style: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" } },
          e("div", { key: "t", style: { fontFamily: fD(T), fontWeight: 600, fontSize: 26, color: T.text, letterSpacing: "-0.01em" } }, s.t),
          e("div", { key: "d", style: { marginTop: 12, fontSize: 15.5, lineHeight: 1.55, color: T.muted } }, s.d)
        ),
        e("div", { key: "tg", style: { paddingTop: 16, display: "flex", flexWrap: "wrap", gap: 8 } },
          (s.tags || []).map((tg, n) => e("span", { key: n, style: { fontSize: 12.5, fontWeight: 500, color: T.muted, padding: "5px 12px", borderRadius: 999, border: `1px solid ${border(T, true)}` } }, tg)))
      ))
    )
  );
  return shell(T, C, i, inner);
}

function market(T: Theme, C: TemplateDeckData, i: number): N {
  const M = C.market;
  const rings = [{ d: 360, k: M.tam, op: T.mode === "dark" ? 0.16 : 0.1 }, { d: 248, k: M.sam, op: T.mode === "dark" ? 0.26 : 0.18 }, { d: 140, k: M.som, op: 1 }];
  const circle = e("div", { key: "cir", style: { position: "relative", width: 360, height: 360, flexShrink: 0 } },
    rings.map((r, k) => e("div", { key: k, style: { position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)", width: r.d, height: r.d, borderRadius: "50%", background: k === 2 ? T.accent : mix(T.accent, r.op * 100, T.mode === "dark" ? "transparent" : "#fff"), border: `1.5px solid ${mix(T.accent, k === 2 ? 100 : 45)}`, display: "flex", alignItems: k === 2 ? "center" : "flex-start", justifyContent: "center", paddingTop: k === 2 ? 0 : 14 } },
      e("span", { style: { fontFamily: fD(T), fontWeight: 700, fontSize: k === 2 ? 30 : 17, color: k === 2 ? (T.mode === "dark" ? T.bg : "#fff") : T.text } }, r.k?.v)
    ))
  );
  const legendItems: N[] = [M.tam, M.sam, M.som].map((r, k) => e("div", { key: k, style: { display: "flex", gap: 16, alignItems: "flex-start" } },
    e("span", { key: "sw", style: { width: 14, height: 14, borderRadius: 4, marginTop: 5, background: mix(T.accent, [40, 68, 100][k]), flexShrink: 0 } }),
    e("div", { key: "tx" },
      e("div", { key: "r", style: { display: "flex", alignItems: "baseline", gap: 10 } },
        e("span", { key: "a", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 13, letterSpacing: ".12em", color: T.accent } }, ["TAM", "SAM", "SOM"][k]),
        e("span", { key: "v", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 28, letterSpacing: "-0.02em", color: T.text } }, r?.v)
      ),
      e("div", { key: "l", style: { marginTop: 4, fontSize: 15.5, color: T.muted, lineHeight: 1.4 } }, r?.l)
    )
  ));
  legendItems.push(e("div", { key: "note", style: { marginTop: 8, padding: "14px 18px", borderRadius: 12, background: T.mode === "dark" ? mix(T.surface, 70, T.bg) : mix(T.accent, 6, "#fff"), border: `1px solid ${border(T)}`, fontSize: 14, lineHeight: 1.5, color: T.muted } }, M.note));
  const legend = e("div", { key: "leg", style: { display: "flex", flexDirection: "column", gap: 22, flex: 1 } }, legendItems);
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, "Market size"),
    h1(T, M.headline, 46),
    e("div", { key: "g", style: { display: "flex", gap: 64, alignItems: "center", marginTop: "auto", marginBottom: "auto" } }, circle, legend)
  );
  return shell(T, C, i, inner);
}

function model(T: Theme, C: TemplateDeckData, i: number): N {
  const M = C.model;
  const flowArr = M.flow || [];
  const flow = e("div", { key: "flow", style: { display: "flex", alignItems: "center", gap: 0, marginTop: 6 } },
    flowArr.map((f, k) => [
      e("div", { key: "n" + k, style: { flex: 1, textAlign: "center", padding: "13px 10px", borderRadius: 10, background: k === flowArr.length - 1 ? mix(T.accent, T.mode === "dark" ? 20 : 12, T.mode === "dark" ? "transparent" : "#fff") : (T.mode === "dark" ? mix(T.surface, 70, T.bg) : T.surface), border: `1px solid ${k === flowArr.length - 1 ? mix(T.accent, 40) : border(T)}`, fontSize: 13.5, fontWeight: 600, color: k === flowArr.length - 1 ? T.accent : T.text, fontFamily: fD(T) } }, f),
      k < flowArr.length - 1 ? e("span", { key: "ar" + k, style: { padding: "0 12px", color: T.accent, fontSize: 20, fontWeight: 700 } }, "→") : null
    ])
  );
  const streams = e("div", { key: "str", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 20, flex: 1 } },
    (M.streams || []).map((s, k) => e("div", { key: k, style: { background: T.mode === "dark" ? mix(T.surface, 70, T.bg) : T.surface, border: `1px solid ${border(T)}`, borderRadius: 16, padding: "26px 26px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18 } },
      e("div", { key: "l" },
        e("div", { key: "t", style: { fontFamily: fD(T), fontWeight: 600, fontSize: 19, color: T.text, letterSpacing: "-0.01em" } }, s.t),
        e("div", { key: "d", style: { marginTop: 8, fontSize: 14, lineHeight: 1.5, color: T.muted, maxWidth: 300 } }, s.d)
      ),
      e("div", { key: "v", style: { textAlign: "right", flexShrink: 0 } },
        e("div", { key: "a", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 34, letterSpacing: "-0.02em", color: T.accent, lineHeight: 1 } }, s.v),
        e("div", { key: "b", style: { fontSize: 12, color: T.muted, marginTop: 4 } }, s.vl)
      )
    ))
  );
  const tiers = e("div", { key: "tier", style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginTop: 20 } },
    (M.tiers || []).map((t, k) => e("div", { key: k, style: { border: `1px solid ${k === 1 ? mix(T.accent, 45) : border(T)}`, borderRadius: 13, padding: "16px 18px", background: k === 1 ? mix(T.accent, T.mode === "dark" ? 12 : 7, T.mode === "dark" ? "transparent" : "#fff") : "transparent" } },
      e("div", { key: "t", style: { fontSize: 13, fontWeight: 600, letterSpacing: ".04em", color: T.muted, textTransform: "uppercase" } }, t.t),
      e("div", { key: "p", style: { marginTop: 8, display: "flex", alignItems: "baseline", gap: 3 } },
        e("span", { key: "a", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 24, color: T.text } }, t.p),
        e("span", { key: "s", style: { fontSize: 13, color: T.muted } }, t.s)),
      e("div", { key: "d", style: { marginTop: 6, fontSize: 13.5, color: T.muted } }, t.d)
    ))
  );
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, "Business model"),
    h1(T, M.headline, 42),
    flow, streams, tiers
  );
  return shell(T, C, i, inner);
}

function traction(T: Theme, C: TemplateDeckData, i: number): N {
  const Tr = C.traction;
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, "Traction"),
    h1(T, Tr.headline, 44),
    e("div", { key: "g", style: { display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 44, marginTop: 30, alignItems: "center", flex: 1 } },
      e("div", { key: "ch" },
        e("div", { key: "lab", style: { fontSize: 13, fontWeight: 600, letterSpacing: ".04em", color: T.muted, marginBottom: 16, textTransform: "uppercase" } }, Tr.sub),
        areaChart(T, Tr.series || [], 520, 232)
      ),
      e("div", { key: "kp", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } },
        (Tr.kpis || []).map((k, n) => e("div", { key: n, style: { background: T.mode === "dark" ? mix(T.surface, 70, T.bg) : T.surface, border: `1px solid ${border(T)}`, borderRadius: 14, padding: "18px 18px" } },
          e("div", { key: "k", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 27, letterSpacing: "-0.02em", color: T.accent, lineHeight: 1 } }, k.k),
          e("div", { key: "l", style: { marginTop: 7, fontSize: 13, lineHeight: 1.35, color: T.muted } }, k.l)
        ))
      )
    )
  );
  return shell(T, C, i, inner);
}

function competition(T: Theme, C: TemplateDeckData, i: number): N {
  const Co = C.competition;
  const cols = Co.cols || [];
  const rows = Co.rows || [];
  const colW = "1fr";
  const grid = `1.6fr repeat(${Math.max(cols.length, 1)},${colW})`;
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, "Competition"),
    h1(T, Co.headline, 44),
    e("div", { key: "tbl", style: { marginTop: 34, border: `1px solid ${border(T)}`, borderRadius: 16, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" } },
      e("div", { key: "hd", style: { display: "grid", gridTemplateColumns: grid, background: T.mode === "dark" ? mix(T.surface, 80, T.bg) : mix(T.accent, 5, "#fff"), borderBottom: `1px solid ${border(T)}` } },
        e("div", { key: "f", style: { padding: "16px 22px" } }),
        cols.map((c, k) => e("div", { key: k, style: { padding: "16px 10px", textAlign: "center", fontFamily: fD(T), fontWeight: k === 0 ? 700 : 600, fontSize: 14.5, color: k === 0 ? T.accent : T.text, background: k === 0 ? mix(T.accent, T.mode === "dark" ? 12 : 7, "transparent") : "transparent" } }, c))
      ),
      rows.map((r, k) => e("div", { key: k, style: { display: "grid", gridTemplateColumns: grid, borderBottom: k < rows.length - 1 ? `1px solid ${border(T)}` : "none", flex: 1, alignItems: "center" } },
        e("div", { key: "f", style: { padding: "0 22px", fontSize: 15, fontWeight: 500, color: T.text } }, r.f),
        (r.v || []).map((v, n) => e("div", { key: n, style: { display: "flex", justifyContent: "center", alignItems: "center", height: "100%", background: n === 0 ? mix(T.accent, T.mode === "dark" ? 12 : 7, "transparent") : "transparent" } }, check(T, v)))
      ))
    )
  );
  return shell(T, C, i, inner);
}

function roadmap(T: Theme, C: TemplateDeckData, i: number): N {
  const R = C.roadmap;
  const items = R.items || [];
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, "Roadmap"),
    e("div", { key: "hd", style: { maxWidth: 760 } }, h1(T, R.headline, 44),
      e("p", { key: "s", style: { margin: "16px 0 0", fontSize: 18, color: T.muted } }, R.sub)),
    e("div", { key: "tl", style: { display: "flex", gap: 20, marginTop: 34, flex: 1 } },
      items.map((it, k) => e("div", { key: k, style: { flex: 1, display: "flex", flexDirection: "column" } },
        e("div", { key: "hd", style: { display: "flex", alignItems: "center", marginBottom: 18 } },
          e("span", { key: "dot", style: { width: 16, height: 16, borderRadius: "50%", background: T.accent, flexShrink: 0, boxShadow: `0 0 0 4px ${mix(T.accent, 20, T.bg)}` } }),
          e("span", { key: "ln", style: { flex: 1, height: 2, marginLeft: 4, background: k < items.length - 1 ? mix(T.accent, 28) : "transparent" } })
        ),
        e("div", { key: "card", style: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", background: T.mode === "dark" ? mix(T.surface, 72, T.bg) : T.surface, border: `1px solid ${border(T)}`, borderRadius: 16, padding: "24px 24px" } },
          e("div", { key: "q", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 13, letterSpacing: ".06em", color: T.accent } }, it.q),
          e("div", { key: "t", style: { marginTop: 12, fontFamily: fD(T), fontWeight: 600, fontSize: 21, color: T.text, letterSpacing: "-0.01em" } }, it.t),
          e("div", { key: "d", style: { marginTop: 12, fontSize: 14.5, lineHeight: 1.55, color: T.muted } }, it.d)
        )
      ))
    )
  );
  return shell(T, C, i, inner);
}

function gallerySlide(T: Theme, C: TemplateDeckData, i: number): N {
  const G = C.galleryS || {
    headline: "Product gallery",
    sub: "Add product screens, photos, or press to bring the story to life.",
    slots: [
      { id: "g1", ph: "Product screenshot", span: true }, { id: "g2", ph: "Mobile app" },
      { id: "g3", ph: "Product in use" }, { id: "g4", ph: "Customer / press" },
      { id: "g5", ph: "Reporting view", span: true },
    ],
  };
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, "Gallery"),
    e("div", { key: "hd", style: { maxWidth: 840 } }, h1(T, G.headline, 44),
      e("p", { key: "s", style: { margin: "16px 0 0", fontSize: 18, color: T.muted } }, G.sub)),
    e("div", { key: "grid", style: { marginTop: 30, flex: 1, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gridTemplateRows: "1fr 1fr", gap: 16 } },
      (G.slots || []).map((s, k) => {
        // Match an uploaded image by slot id, else by position.
        const imgs = C._assets?.galleryImages || [];
        const found = imgs.find((g) => g.slot === s.id) || imgs[k];
        return e("div", { key: s.id || k, style: { gridColumn: s.span ? "span 2" : "span 1", position: "relative", borderRadius: 16, overflow: "hidden", background: T.mode === "dark" ? mix(T.surface, 72, T.bg) : mix(T.accent, 5, "#fff"), border: `1px solid ${border(T)}` } },
          found
            ? e("img", { key: "im", src: found.url, alt: s.ph, style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" } })
            : imgSlot(T, s.ph)
        );
      })
    )
  );
  return shell(T, C, i, inner);
}

function team(T: Theme, C: TemplateDeckData, i: number): N {
  const Tm = C.team;
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, "Team"),
    h1(T, Tm.headline, 44),
    e("div", { key: "g", style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, marginTop: 30, flex: 1 } },
      (Tm.members || []).map((m, k) => e("div", { key: k, style: { display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, background: T.mode === "dark" ? mix(T.surface, 72, T.bg) : T.surface, border: `1px solid ${border(T)}`, borderRadius: 18, padding: "30px 26px" } },
        avatar(T, m.i),
        e("div", { key: "tx" },
          e("div", { key: "n", style: { fontFamily: fD(T), fontWeight: 600, fontSize: 19, color: T.text, letterSpacing: "-0.01em" } }, m.n),
          e("div", { key: "r", style: { marginTop: 4, fontSize: 13.5, fontWeight: 600, color: T.accent } }, m.r),
          e("div", { key: "b", style: { marginTop: 11, fontSize: 13.5, lineHeight: 1.5, color: T.muted } }, m.b)
        )
      ))
    ),
    Tm.advisors ? e("div", { key: "adv", style: { marginTop: 24, paddingTop: 20, borderTop: `1px solid ${border(T)}`, fontSize: 15, color: T.muted } }, Tm.advisors) : null
  );
  return shell(T, C, i, inner);
}

function ask(T: Theme, C: TemplateDeckData, i: number): N {
  const A = C.ask;
  const use = A.use || [];
  const colors = [T.accent, mix(T.accent, 72), mix(T.accent2, 80), mix(T.muted, 55)];
  const bar = e("div", { key: "bar", style: { display: "flex", height: 18, borderRadius: 9, overflow: "hidden", marginBottom: 26 } },
    use.map((u, k) => e("div", { key: k, style: { width: u.p + "%", background: colors[k % colors.length] } })));
  const legend = e("div", { key: "leg", style: { display: "flex", flexDirection: "column", gap: 16 } },
    use.map((u, k) => e("div", { key: k, style: { display: "flex", alignItems: "center", gap: 14 } },
      e("span", { key: "s", style: { width: 13, height: 13, borderRadius: 4, background: colors[k % colors.length] } }),
      e("span", { key: "l", style: { flex: 1, fontSize: 16, color: T.text, fontWeight: 500 } }, u.l),
      e("span", { key: "p", style: { fontFamily: fD(T), fontWeight: 700, fontSize: 18, color: T.text } }, u.p + "%")
    )));
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column" } },
    eyebrow(T, "The ask"),
    e("div", { key: "g", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, marginTop: "auto", marginBottom: "auto", alignItems: "center" } },
      e("div", { key: "l" },
        e("h1", { key: "h", style: { margin: 0, fontFamily: fD(T), fontWeight: T.serif ? 600 : 700, fontSize: 54, lineHeight: 1.02, letterSpacing: "-0.03em", color: T.text } }, A.headline),
        e("p", { key: "s", style: { margin: "22px 0 0", fontSize: 18.5, lineHeight: 1.5, color: T.muted, maxWidth: 420 } }, A.sub)
      ),
      e("div", { key: "r", style: { background: T.mode === "dark" ? mix(T.surface, 70, T.bg) : T.surface, border: `1px solid ${border(T)}`, borderRadius: 18, padding: "30px 32px" } },
        e("div", { key: "t", style: { fontSize: 13, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: T.muted, marginBottom: 18 } }, "Use of funds"),
        bar, legend
      )
    )
  );
  return shell(T, C, i, inner);
}

function closing(T: Theme, C: TemplateDeckData, i: number): N {
  const Cl = C.closing;
  const deco = e("div", { key: "dc", style: { position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" } },
    e("div", { key: 1, style: { position: "absolute", left: -140, bottom: -160, width: 420, height: 420, borderRadius: "50%", background: mix(T.accent, T.mode === "dark" ? 16 : 10, "transparent"), filter: "blur(8px)" } }),
    e("div", { key: 2, style: { position: "absolute", right: -100, top: -120, width: 320, height: 320, borderRadius: "50%", background: mix(T.accent2, T.mode === "dark" ? 18 : 12, "transparent"), filter: "blur(8px)" } })
  );
  const inner = e("div", { key: "in", style: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 820 } },
    eyebrow(T, "Thank you"),
    e("h1", { key: "h", style: { margin: 0, fontFamily: fD(T), fontWeight: T.serif ? 600 : 700, fontSize: 62, lineHeight: 1.02, letterSpacing: "-0.03em", color: T.text } }, Cl.headline),
    e("p", { key: "s", style: { margin: "24px 0 36px", fontSize: 20, lineHeight: 1.5, color: T.muted, maxWidth: 560 } }, Cl.sub),
    e("div", { key: "c", style: { display: "flex", gap: 14, flexWrap: "wrap" } },
      e("a", { key: "m", href: "mailto:" + Cl.contact, style: { textDecoration: "none", fontFamily: fD(T), fontWeight: 600, fontSize: 16, color: T.mode === "dark" ? T.bg : "#fff", background: T.accent, padding: "13px 24px", borderRadius: 999 } }, Cl.contact),
      e("span", { key: "w", style: { fontFamily: fD(T), fontWeight: 600, fontSize: 16, color: T.text, padding: "13px 24px", borderRadius: 999, border: `1px solid ${border(T, true)}` } }, Cl.site)
    )
  );
  return shell(T, C, i, inner, { deco });
}

const SLIDE_FNS = [cover, summary, probsol, product, market, model, traction, competition, roadmap, gallerySlide, team, ask, closing];
const LAST = SLIDE_FNS.length - 1;

/** Render a single 1280×720 slide (used by the deck view and thumbnails). */
export function renderSlide(theme: Theme, data: TemplateDeckData, index: number): N {
  const fn = SLIDE_FNS[index] || cover;
  return fn(theme, data, index);
}

// ── Interactive deck component ───────────────────────────────────────────────

interface TemplatedDeckProps {
  data: TemplateDeckData;
  theme: Theme;
}

export function TemplatedDeck({ data, theme }: TemplatedDeckProps): JSX.Element {
  const [si, setSi] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fsRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [fs, setFs] = useState(false);
  const [vp, setVp] = useState({ w: 1280, h: 720 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(Math.max(0.1, el.clientWidth / 1280));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const next = () => setSi((s) => Math.min(s + 1, LAST));
  const prev = () => setSi((s) => Math.max(s - 1, 0));

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "ArrowRight") next();
      else if (ev.key === "ArrowLeft") prev();
      else if (ev.key === "Escape" && fs) setFs(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fs]);

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
      {DECK_SLIDE_ORDER.map((s, k) => (
        <button key={s} onClick={() => setSi(k)} title={s}
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
            {renderSlide(theme, data, si)}
          </div>
        </div>
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
            <X size={16} /> Exit
          </button>

          <div style={{ width: 1280, height: 720, transform: `scale(${fsScale})`, transformOrigin: "center center", borderRadius: 14, overflow: "hidden", boxShadow: "0 30px 90px rgba(0,0,0,.5)" }}>
            {renderSlide(theme, data, si)}
          </div>

          {/* Edge nav zones */}
          <button onClick={prev} disabled={si === 0} aria-label="Previous"
            style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "12%", border: "none", background: "transparent", cursor: si === 0 ? "default" : "pointer" }} />
          <button onClick={next} disabled={si === LAST} aria-label="Next"
            style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "12%", border: "none", background: "transparent", cursor: si === LAST ? "default" : "pointer" }} />

          <div style={{ position: "absolute", bottom: 22, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            {dots}
            <span style={{ font: "400 12px var(--font-body)", color: theme.muted }}>
              {si + 1} / {DECK_SLIDE_ORDER.length} · ← → to navigate · Esc to exit
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
