import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, LayoutGrid, Maximize2 } from "lucide-react";
import { clsx } from "clsx";

interface DataPoint { label: string; value: string; sublabel?: string }
interface Card      { title: string; body: string; metric?: string }
interface Column    { heading: string; points: string[]; highlight?: string }

interface Slide {
  id?: string;
  slide_number?: number;
  slide_type?: string;
  type?: string;
  layout?: string;
  title?: string;
  subtitle?: string;
  body?: string;
  content?: string;
  bullet_points?: string[];
  data_points?: DataPoint[];
  cards?: Card[];
  columns?: Column[];
  speaker_notes?: string;
}

interface DeckContent {
  deck_title?: string;
  deck_subtitle?: string;
  slides?: Slide[];
}

interface BrandingData {
  primaryColor?: string;
  secondaryColor?: string;
}

interface Props { 
  deckContent: DeckContent;
  branding?: BrandingData;
}

// Convert hex to RGBA with opacity
function hexToRgba(hex: string, opacity: number = 0.2): string {
  if (!hex || !hex.startsWith("#")) return "";
  const h = hex.slice(1);
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function DeckPreview({ deckContent, branding }: Props) {
  const slides = deckContent?.slides ?? [];
  const [active, setActive] = useState(0);
  const [view, setView] = useState<"single" | "grid">("single");
  
  // Use company colors or fallback to defaults
  const primaryColor = branding?.primaryColor || "#2540B5";
  const secondaryColor = branding?.secondaryColor || "#7B2CBF";
  
  // Professional dark slide background with company color accents
  const slideBackground = `linear-gradient(135deg, #0C0A1E 0%, #110D2A 35%, ${hexToRgba(primaryColor, 0.28)} 70%, ${hexToRgba(secondaryColor, 0.18)} 100%)`;

  if (slides.length === 0) return (
    <div className="flex flex-col items-center justify-center h-80 border border-dashed border-border rounded-2xl">
      <p className="text-text-muted text-sm">No slides generated yet</p>
    </div>
  );

  const slide = slides[active];

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-text-primary font-semibold text-base">
            {deckContent.deck_title || "Pitch Deck"}
          </h2>
          {deckContent.deck_subtitle && (
            <p className="text-text-muted text-xs mt-0.5">{deckContent.deck_subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs">{slides.length} slides</span>
          <button
            onClick={() => setView(v => v === "single" ? "grid" : "single")}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface transition-colors"
          >
            {view === "single" ? <LayoutGrid className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {view === "grid" ? (
        <GridView slides={slides} onSelect={(i) => { setActive(i); setView("single"); }} />
      ) : (
        <>
          {/* ── Slide canvas ──────────────────────────────────── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
              className={clsx(
                "relative rounded-2xl overflow-hidden",
                "border border-white/10",
                "min-h-[420px]",
              )}
              style={{ background: slideBackground }}
            >
              <SlideCanvas slide={slide} index={active} primaryColor={primaryColor} secondaryColor={secondaryColor} />
            </motion.div>
          </AnimatePresence>

          {/* ── Navigation ────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActive(i => Math.max(0, i - 1))}
              disabled={active === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-text-muted hover:text-text-secondary hover:bg-surface transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>

            {/* Dot indicators */}
            <div className="flex gap-1.5 flex-wrap justify-center max-w-xs">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={clsx(
                    "w-1.5 h-1.5 rounded-full transition-all",
                    i === active ? "bg-violet w-4" : "bg-border hover:bg-border-bright"
                  )}
                />
              ))}
            </div>

            <button
              onClick={() => setActive(i => Math.min(slides.length - 1, i + 1))}
              disabled={active === slides.length - 1}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-text-muted hover:text-text-secondary hover:bg-surface transition-colors disabled:opacity-30"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* ── Speaker notes ─────────────────────────────────── */}
          {slide.speaker_notes && (
            <div className="px-4 py-3 rounded-xl bg-surface border border-border">
              <p className="text-text-muted text-xs font-medium mb-1 uppercase tracking-wider">Speaker notes</p>
              <p className="text-text-secondary text-sm">{slide.speaker_notes}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Grid view ──────────────────────────────────────────────────────────────────

function GridView({ slides, onSelect }: { slides: Slide[]; onSelect: (i: number) => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {slides.map((slide, i) => (
        <button
          key={slide.id ?? i}
          onClick={() => onSelect(i)}
          className="text-left p-4 rounded-xl border border-border bg-surface hover:border-violet hover:bg-surface-2 transition-all group"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 rounded-md bg-brand-gradient-subtle flex items-center justify-center text-[10px] font-bold text-violet">
              {i + 1}
            </span>
            <span className="text-[10px] text-text-muted uppercase tracking-wider truncate">
              {slide.slide_type || slide.type || "slide"}
            </span>
          </div>
          <p className="text-text-primary text-xs font-semibold line-clamp-2 group-hover:text-white transition-colors">
            {slide.title || "Untitled"}
          </p>
        </button>
      ))}
    </div>
  );
}

// ── Slide canvas ───────────────────────────────────────────────────────────────

function SlideCanvas({ slide, index, primaryColor, secondaryColor }: { slide: Slide; index: number; primaryColor: string; secondaryColor: string }) {
  const layout = slide.layout || "title_bullets";
  const type = slide.slide_type || slide.type || "";

  const isCover = layout === "full_bleed" || type === "cover" || type === "closing";
  const isProblemSolution = type === "problem_solution" || layout === "two_column";

  if (isCover) return <FullBleedSlide slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />;
  if (layout === "market_sizing" || type === "financials") return <MarketSizingSlide slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />;
  if (layout === "timeline" || type === "roadmap") return <TimelineInfographic slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />;
  if (layout === "growth_curve") return <GrowthCurveInfographic slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />;
  if (layout === "process_flow" || type === "how_it_works") return <ProcessFlowInfographic slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />;
  if (layout === "customer_journey") return <CustomerJourneyInfographic slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />;
  if (layout === "big_number") return <BigNumberSlide slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />;
  if (layout === "cards") return <CardsSlide slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />;
  if (layout === "two_column" || isProblemSolution) return <TwoColumnSlide slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />;
  return <TitleBulletsSlide slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />;
}

// ── Cover / closing ────────────────────────────────────────────────────────────

function FullBleedSlide({ slide, primaryColor, secondaryColor }: { slide: Slide; primaryColor: string; secondaryColor: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] px-12 py-10 text-center relative">
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }} />
      <h1 className="text-3xl font-bold text-text-primary mb-3">{slide.title}</h1>
      {slide.subtitle && <p className="text-lg text-text-secondary mb-4">{slide.subtitle}</p>}
      {(slide.body || slide.content) && (
        <p className="text-sm text-text-muted max-w-md">{slide.body || slide.content}</p>
      )}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl opacity-50" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }} />
    </div>
  );
}

// ── Big number ────────────────────────────────────────────────────────────────

function BigNumberSlide({ slide, primaryColor, secondaryColor }: { slide: Slide; primaryColor: string; secondaryColor: string }) {
  const metrics = slide.data_points ?? [];
  return (
    <div className="p-6 min-h-[420px]">
      <SlideHeader slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />
      {metrics.length > 0 && (
        <div className={clsx(
          "grid gap-3 mt-4",
          metrics.length <= 2 ? "grid-cols-2" : metrics.length === 3 ? "grid-cols-3" : "grid-cols-4"
        )}>
          {metrics.map((dp, i) => (
            <div key={i} className="p-4 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.06)", borderColor: i % 2 === 0 ? primaryColor : secondaryColor, borderWidth: "1px" }}>
              <p className="text-2xl font-bold text-text-primary">{dp.value}</p>
              <p className="text-xs text-text-secondary mt-1">{dp.label}</p>
              {dp.sublabel && <p className="text-[10px] text-text-muted mt-0.5">{dp.sublabel}</p>}
            </div>
          ))}
        </div>
      )}
      {(slide.body || slide.content) && (
        <p className="text-sm text-text-secondary mt-4">{slide.body || slide.content}</p>
      )}
      {slide.bullet_points && slide.bullet_points.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {slide.bullet_points.slice(0, 3).map((b, i) => (
            <li key={i} className="text-xs text-text-secondary flex gap-2">
              <span style={{ color: primaryColor }} className="mt-0.5">›</span>
              <BoldText text={b} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Cards ──────────────────────────────────────────────────────────────────────

function CardsSlide({ slide, primaryColor, secondaryColor }: { slide: Slide; primaryColor: string; secondaryColor: string }) {
  const cards = slide.cards ?? [];
  const isCompetitive = slide.slide_type === "competitive_landscape";
  const CARD_ACCENTS = [primaryColor, secondaryColor, primaryColor, secondaryColor];
  const METRIC_COLORS = [primaryColor, secondaryColor, primaryColor, secondaryColor];
  // Competitive cards use warning/error tones to signal competitor weaknesses
  const COMPETITOR_ACCENTS = ["border-[#F59E0B]", "border-[#EF4444]", "border-[#F97316]", "border-[#EAB308]"];
  const COMPETITOR_WEAKNESS_COLORS = ["text-[#F59E0B]", "text-[#EF4444]", "text-[#F97316]", "text-[#EAB308]"];

  return (
    <div className="p-6 min-h-[420px]">
      <SlideHeader slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />
      {cards.length > 0 ? (
        <div className={clsx(
          "grid gap-3 mt-4",
          cards.length <= 2 ? "grid-cols-2" : cards.length === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"
        )}>
          {cards.map((card, i) => (
            <div key={i} className="p-4 rounded-xl border-t-2"
              style={{
                background: "rgba(255,255,255,0.05)",
                borderTopColor: isCompetitive ? undefined : CARD_ACCENTS[i % CARD_ACCENTS.length],
                borderLeft: "1px solid rgba(255,255,255,0.08)",
                borderRight: "1px solid rgba(255,255,255,0.08)",
                borderBottom: "1px solid rgba(255,255,255,0.08)"
              }}
            >
              {isCompetitive ? (
                // Competitive layout: competitor name BIG, weakness prominent, body small
                <>
                  <p className={clsx("text-xl font-bold mb-1", COMPETITOR_WEAKNESS_COLORS[i % COMPETITOR_WEAKNESS_COLORS.length])}>
                    {card.title}
                  </p>
                  {card.metric && (
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
                      ⚠ {card.metric}
                    </p>
                  )}
                  <p className="text-xs text-text-secondary leading-relaxed">{card.body}</p>
                </>
              ) : (
                // Standard card layout
                <>
                  <p className="text-sm font-semibold text-text-primary mb-1">{card.title}</p>
                  {card.metric && (
                    <p className="text-xl font-bold mb-1.5" style={{ color: METRIC_COLORS[i % METRIC_COLORS.length] }}>
                      {card.metric}
                    </p>
                  )}
                  <p className="text-xs text-text-secondary leading-relaxed">{card.body}</p>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <TitleBulletsSlide slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} headerless />
      )}
    </div>
  );
}

// ── Two column ────────────────────────────────────────────────────────────────

function TwoColumnSlide({ slide, primaryColor, secondaryColor }: { slide: Slide; primaryColor: string; secondaryColor: string }) {
  const cols = slide.columns ?? [];
  return (
    <div className="p-6 min-h-[420px]">
      <SlideHeader slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />
      <div className="grid grid-cols-2 gap-4 mt-4">
        {(cols.length >= 2 ? cols : [cols[0] ?? {}, cols[1] ?? {}]).slice(0, 2).map((col, i) => (
          <div key={i} className="p-4 rounded-xl border"
            style={{ background: "rgba(255,255,255,0.05)", borderColor: i === 0 ? primaryColor : secondaryColor }}>
            <p className="text-sm font-bold text-text-primary mb-2">{col.heading}</p>
            {col.highlight && (
              <p className="text-lg font-bold mb-2" style={{ color: i === 0 ? primaryColor : secondaryColor }}>
                {col.highlight}
              </p>
            )}
            <ul className="space-y-1.5">
              {(col.points ?? []).slice(0, 5).map((pt, j) => (
                <li key={j} className="text-xs text-text-secondary flex gap-1.5">
                  <span style={{ color: i === 0 ? primaryColor : secondaryColor }}>•</span>
                  <BoldText text={pt} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Market Sizing — TAM / SAM / SOM ───────────────────────────────────────────

function parseMarketValue(val: string): number {
  if (!val || val === "—") return 0;
  const m = val.match(/[\d.]+/);
  if (!m) return 0;
  const num = parseFloat(m[0]);
  const u = val.toUpperCase();
  if (u.includes("T")) return num * 1000;
  if (u.includes("B")) return num;
  if (u.includes("M")) return num / 1000;
  return num;
}

function ConcentricChart({
  tamVal, samVal, somVal,
  tamStr, samStr, somStr,
  primaryColor, secondaryColor,
}: {
  tamVal: number; samVal: number; somVal: number;
  tamStr: string; samStr: string; somStr: string;
  primaryColor: string; secondaryColor: string;
}) {
  const MAX_R = 92;
  // Radii proportional to sqrt(value) so area ∝ market size
  const tamR = MAX_R;
  const rawSam = tamVal > 0 ? MAX_R * Math.sqrt(Math.min(0.95, samVal / tamVal)) : 63;
  const rawSom = tamVal > 0 ? MAX_R * Math.sqrt(Math.min(0.9, somVal / tamVal)) : 35;
  // Enforce minimum gap so labels don't overlap
  const samR = Math.min(rawSam, tamR - 16);
  const somR = Math.min(rawSom, samR - 14);

  const cx = 110, cy = 110;

  // Label Y positions: inside each ring zone (top of zone)
  const tamLabelY = cy - tamR + 24;   // inside TAM ring (top)
  const samLabelY = cy - samR + 22;   // inside SAM ring (top)
  const somLabelY = cy + 5;           // center of SOM

  return (
    <svg width="220" height="220" viewBox="0 0 220 220">
      <defs>
        <radialGradient id="tamGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={primaryColor} stopOpacity="0.05"/>
          <stop offset="100%" stopColor={primaryColor} stopOpacity="0.22"/>
        </radialGradient>
        <radialGradient id="samGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={secondaryColor} stopOpacity="0.1"/>
          <stop offset="100%" stopColor={secondaryColor} stopOpacity="0.38"/>
        </radialGradient>
        <radialGradient id="somGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.75"/>
        </radialGradient>
      </defs>

      {/* TAM — outermost */}
      <circle cx={cx} cy={cy} r={tamR} fill="url(#tamGrad)" stroke={primaryColor} strokeWidth="2" strokeOpacity="0.55"/>
      {/* SAM — middle */}
      <circle cx={cx} cy={cy} r={samR} fill="url(#samGrad)" stroke={secondaryColor} strokeWidth="2" strokeOpacity="0.7"/>
      {/* SOM — innermost filled */}
      <circle cx={cx} cy={cy} r={somR} fill="url(#somGrad)" stroke="#0EA5E9" strokeWidth="2"/>

      {/* TAM label zone (top of outer ring) */}
      <text x={cx} y={tamLabelY}     textAnchor="middle" fill="#93C5FD" fontSize="9"  fontWeight="700" letterSpacing="1.5">TAM</text>
      <text x={cx} y={tamLabelY + 15} textAnchor="middle" fill="#BFDBFE" fontSize="16" fontWeight="800">{tamStr}</text>

      {/* SAM label zone (top of SAM circle, inside TAM) */}
      <text x={cx} y={samLabelY}     textAnchor="middle" fill="#C4B5FD" fontSize="8.5" fontWeight="700" letterSpacing="1.5">SAM</text>
      <text x={cx} y={samLabelY + 14} textAnchor="middle" fill="#DDD6FE" fontSize="14"  fontWeight="800">{samStr}</text>

      {/* SOM label (center) */}
      <text x={cx} y={somLabelY - 8}  textAnchor="middle" fill="#BAE6FD" fontSize="8"  fontWeight="700" letterSpacing="1.5">SOM</text>
      <text x={cx} y={somLabelY + 8}  textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="800">{somStr}</text>
    </svg>
  );
}

function MarketSizingSlide({ slide, primaryColor, secondaryColor }: { slide: Slide; primaryColor: string; secondaryColor: string }) {
  const dps   = slide.data_points ?? [];
  const cards = slide.cards ?? [];
  const bullets = slide.bullet_points ?? [];
  const METRIC_COLORS = [primaryColor, secondaryColor, primaryColor, secondaryColor];

  const tam  = dps[0] ?? { label: "Total Addressable Market (TAM)", value: "—", sublabel: "" };
  const sam  = dps[1] ?? { label: "Serviceable Addressable Market (SAM)", value: "—", sublabel: "" };
  const som  = dps[2] ?? { label: "Serviceable Obtainable Market (SOM)", value: "—", sublabel: "" };
  const cagr = dps[3] ?? { label: "Market CAGR", value: "—", sublabel: "" };

  const tamVal = parseMarketValue(tam.value);
  const samVal = parseMarketValue(sam.value);
  const somVal = parseMarketValue(som.value);

  return (
    <div className="p-4 min-h-[420px] flex flex-col gap-3">
      <SlideHeader slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />

      {/* ══ ROW 1: Chart + Market sizing cards ══ */}
      <div className="flex gap-4 flex-1 items-center">

        {/* LEFT — concentric circles */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <ConcentricChart
            tamVal={tamVal} samVal={samVal} somVal={somVal}
            tamStr={tam.value} samStr={sam.value} somStr={som.value}
            primaryColor={primaryColor} secondaryColor={secondaryColor}
          />
          {/* CAGR badge */}
          <div className="flex items-center gap-2 bg-[#052e16]/80 border border-[#22C55E]/50 rounded-lg px-4 py-1.5 w-full justify-center">
            <span className="text-[9px] font-black text-[#86EFAC] tracking-[2px]">CAGR</span>
            <span className="text-xl font-black text-[#22C55E]">{cagr.value}</span>
            {cagr.sublabel && <span className="text-[9px] text-[#86EFAC]/60 ml-1 leading-tight max-w-[80px]">{cagr.sublabel}</span>}
          </div>
        </div>

        {/* RIGHT — TAM/SAM/SOM breakdown */}
        <div className="flex flex-col gap-2 flex-1">
          <p className="text-[9px] font-bold text-text-muted tracking-widest uppercase mb-0.5">Market Opportunity</p>
          {[
            { dp: tam, color: primaryColor, tag: "TAM" },
            { dp: sam, color: secondaryColor, tag: "SAM" },
            { dp: som, color: "#0EA5E9", tag: "SOM" },
          ].map(({ dp, color, tag }) => (
            <div key={tag} className="flex items-stretch rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-1 flex-shrink-0" style={{ background: color }} />
              <div className="flex items-center gap-3 px-3 py-2 flex-1">
                <div className="flex-shrink-0">
                  <p className="text-[8px] font-black tracking-[2px]" style={{ color }}>{tag}</p>
                  <p className="text-[20px] font-black leading-tight" style={{ color }}>{dp.value}</p>
                </div>
                <div className="border-l border-border pl-2.5 min-w-0">
                  <p className="text-[10px] font-semibold text-text-secondary leading-snug">
                    {dp.label.replace(/\(.*?\)/g, "").trim()}
                  </p>
                  {dp.sublabel && <p className="text-[9px] text-text-muted mt-0.5 leading-snug">{dp.sublabel}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ ROW 2: Company current financials (from founder inputs) ══ */}
      {cards.length > 0 && (
        <div>
          <p className="text-[9px] font-bold text-text-muted tracking-widest uppercase mb-1.5">Company Financials</p>
          <div className={clsx("grid gap-2", cards.length === 1 ? "grid-cols-1" : cards.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
            {cards.slice(0, 3).map((card, i) => (
              <div key={i} className="rounded-lg px-3 py-2.5 text-center" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${METRIC_COLORS[i % 3]}44` }}>
                <p className="text-[9px] font-bold text-text-muted tracking-wide uppercase">{card.title}</p>
                <p className="text-[22px] font-black leading-tight mt-0.5" style={{ color: METRIC_COLORS[i % 3] }}>
                  {card.metric}
                </p>
                <p className="text-[9px] text-text-muted mt-0.5">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ ROW 3: 3-year revenue projection ══ */}
      {bullets.length > 0 && (
        <div>
          <p className="text-[9px] font-bold text-text-muted tracking-widest uppercase mb-1.5">Revenue Projections</p>
          <div className="grid grid-cols-3 gap-2">
            {bullets.slice(0, 3).map((b, i) => (
              <div key={i} className="rounded-lg px-3 py-2"
                style={{ background: "rgba(255,255,255,0.05)", borderTop: `2px solid ${METRIC_COLORS[i]}`, border: `1px solid rgba(255,255,255,0.08)` }}>
                <p className="text-[10px] text-text-secondary leading-snug"><BoldText text={b} /></p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Title + bullets ────────────────────────────────────────────────────────────

function TitleBulletsSlide({ slide, headerless, primaryColor = "#2540B5", secondaryColor = "#7B2CBF" }: { slide: Slide; headerless?: boolean; primaryColor?: string; secondaryColor?: string }) {
  const bullets = slide.bullet_points ?? [];
  const body = slide.body || slide.content || "";
  return (
    <div className={headerless ? "" : "p-6 min-h-[420px]"}>
      {!headerless && <SlideHeader slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />}
      {body && <p className="text-sm text-text-secondary mt-3 mb-3">{body}</p>}
      {bullets.length > 0 && (
        <ul className="mt-3 space-y-2">
          {bullets.slice(0, 7).map((b, i) => (
            <li key={i} className="flex gap-2 text-sm text-text-secondary">
              <span style={{ color: primaryColor }} className="mt-0.5 flex-shrink-0">›</span>
              <BoldText text={b} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Shared header ──────────────────────────────────────────────────────────────

function TimelineInfographic({ slide, primaryColor, secondaryColor }: { slide: Slide; primaryColor: string; secondaryColor: string }) {
  const milestones = slide.bullet_points ?? [];
  
  return (
    <div className="p-6 min-h-[420px] flex flex-col">
      <SlideHeader slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />
      <div className="flex-1 flex items-center justify-center mt-6">
        <svg width="100%" height="200" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid meet">
          {/* Timeline line */}
          <line x1="50" y1="100" x2="750" y2="100" stroke={primaryColor} strokeWidth="3" opacity="0.3" />
          
          {/* Milestones */}
          {milestones.slice(0, 5).map((milestone, i) => {
            const x = 50 + (i * 140);
            const isAlt = i % 2 === 1;
            const textY = isAlt ? 60 : 140;
            
            return (
              <g key={i}>
                {/* Circle */}
                <circle cx={x} cy="100" r="12" fill={i % 2 === 0 ? primaryColor : secondaryColor} opacity="0.8" />
                <circle cx={x} cy="100" r="8" fill="white" />
                
                {/* Text */}
                <text
                  x={x}
                  y={textY}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="#6B7280"
                >
                  {milestone.replace(/\*\*/g, '').substring(0, 15)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Growth curve ───────────────────────────────────────────────────────────────

function GrowthCurveInfographic({ slide, primaryColor, secondaryColor }: { slide: Slide; primaryColor: string; secondaryColor: string }) {
  const dataPoints = slide.data_points ?? [];
  
  // Extract numeric values
  const values = dataPoints.map((dp, i) => ({
    label: dp.label,
    value: parseInt(String(dp.value).replace(/[^0-9]/g, '')) || (i + 1) * 30,
    sublabel: dp.sublabel,
  }));
  
  const maxValue = Math.max(...values.map(v => v.value), 100);
  const padding = 60;
  const width = 700;
  const height = 300;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 1.5;
  
  // Generate curve path
  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1 || 1)) * graphWidth;
    const y = padding + graphHeight - (v.value / maxValue) * graphHeight;
    return { x, y, ...v };
  });
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  
  return (
    <div className="p-6 min-h-[420px] flex flex-col">
      <SlideHeader slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />
      <div className="flex-1 flex items-center justify-center mt-6">
        <svg width="100%" height="300" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((ratio, i) => (
            <line
              key={`grid-${i}`}
              x1={padding}
              y1={padding + ratio * graphHeight}
              x2={padding + graphWidth}
              y2={padding + ratio * graphHeight}
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.1"
              className="text-text-muted"
            />
          ))}
          
          {/* Axes */}
          <line x1={padding} y1={padding} x2={padding} y2={padding + graphHeight} stroke={primaryColor} strokeWidth="2" />
          <line x1={padding} y1={padding + graphHeight} x2={padding + graphWidth} y2={padding + graphHeight} stroke={primaryColor} strokeWidth="2" />
          
          {/* Curve with gradient fill */}
          <defs>
            <linearGradient id="growthGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={primaryColor} stopOpacity="0.4" />
              <stop offset="100%" stopColor={primaryColor} stopOpacity="0.1" />
            </linearGradient>
          </defs>
          
          {/* Area under curve */}
          <path
            d={`${pathD} L ${padding + graphWidth} ${padding + graphHeight} L ${padding} ${padding + graphHeight} Z`}
            fill="url(#growthGradient)"
          />
          
          {/* Curve line */}
          <path d={pathD} stroke={primaryColor} strokeWidth="3" fill="none" opacity="0.8" />
          
          {/* Data points and labels */}
          {points.map((p, i) => (
            <g key={`point-${i}`}>
              <circle cx={p.x} cy={p.y} r="5" fill={i % 2 === 0 ? primaryColor : secondaryColor} />
              <text x={p.x} y={p.y - 15} textAnchor="middle" fontSize="11" fontWeight="700" className="text-text-primary fill-current">
                {p.value}
              </text>
              <text x={p.x} y={padding + graphHeight + 20} textAnchor="middle" fontSize="10" className="text-text-secondary fill-current">
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── Process flow ───────────────────────────────────────────────────────────────

function ProcessFlowInfographic({ slide, primaryColor, secondaryColor }: { slide: Slide; primaryColor: string; secondaryColor: string }) {
  const steps = slide.bullet_points ?? [];
  
  return (
    <div className="p-6 min-h-[420px] flex flex-col">
      <SlideHeader slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />
      <div className="flex-1 flex flex-col items-center justify-center mt-6">
        <div className="flex items-center justify-center gap-2 w-full flex-wrap">
          {steps.slice(0, 5).map((step, i) => (
            <div key={i} className="flex items-center">
              <div
                className="flex items-center justify-center w-12 h-12 rounded-lg font-bold text-white text-sm"
                style={{ background: i % 2 === 0 ? primaryColor : secondaryColor }}
              >
                {i + 1}
              </div>
              <div className="ml-3 mr-3">
                <p className="text-sm font-semibold text-text-primary">{step.replace(/\*\*/g, '').substring(0, 30)}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="text-2xl" style={{ color: primaryColor }}>→</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Customer journey ───────────────────────────────────────────────────────────

function CustomerJourneyInfographic({ slide, primaryColor, secondaryColor }: { slide: Slide; primaryColor: string; secondaryColor: string }) {
  const stages = slide.columns?.flatMap(c => c.points) ?? slide.bullet_points ?? [];
  
  const journeyStages = [
    { name: "Awareness", color: primaryColor },
    { name: "Consideration", color: secondaryColor },
    { name: "Decision", color: primaryColor },
    { name: "Adoption", color: secondaryColor },
    { name: "Advocacy", color: primaryColor },
  ];
  
  return (
    <div className="p-6 min-h-[420px] flex flex-col">
      <SlideHeader slide={slide} primaryColor={primaryColor} secondaryColor={secondaryColor} />
      <div className="flex-1 flex flex-col items-center justify-center mt-6 gap-4">
        {journeyStages.map((stage, i) => (
          <div key={i} className="w-full max-w-md">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold" style={{ background: stage.color }}>
                {i + 1}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-text-primary">{stage.name}</h4>
                <p className="text-sm text-text-secondary">
                  {stages[i]?.replace(/\*\*/g, '') || `Stage ${i + 1} of customer journey`}
                </p>
              </div>
            </div>
            {i < journeyStages.length - 1 && (
              <div className="ml-8 h-8 border-l-2" style={{ borderColor: primaryColor }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Slide header ──────────────────────────────────────────────────────────────

function SlideHeader({ slide, primaryColor, secondaryColor }: { slide: Slide; primaryColor: string; secondaryColor: string }) {
  const rawType = slide.slide_type || slide.type || "";
  const tag = rawType === "problem_solution"
    ? "PROBLEM & SOLUTION"
    : rawType.replace(/_/g, " ").toUpperCase();
  return (
    <div className="mb-1">
      {tag && (
        <p className="text-[9px] font-black tracking-[3px] mb-1.5 uppercase" style={{ color: primaryColor }}>
          {tag}
        </p>
      )}
      <h3 className="text-xl font-bold text-white leading-tight mb-1">{slide.title}</h3>
      {slide.subtitle && <p className="text-sm mt-0.5 text-text-secondary">{slide.subtitle}</p>}
      <div className="mt-2 h-0.5 rounded-full" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor}, transparent)` }} />
    </div>
  );
}

// ── Bold text renderer ("**bold** normal") ─────────────────────────────────────

function BoldText({ text }: { text: string }) {
  if (!text.includes("**")) return <span>{text}</span>;
  const parts = text.split("**");
  return (
    <span>
      {parts.map((p, i) =>
        i % 2 === 1 ? <strong key={i} className="text-text-primary font-semibold">{p}</strong> : <span key={i}>{p}</span>
      )}
    </span>
  );
}
