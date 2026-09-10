/**
 * Shared data contract for the templated deck.
 *
 * The backend generation pass emits a `template_data` object in exactly this
 * shape (stored on deck_content.template_data). The 10-theme renderer in
 * TemplatedDeck.tsx consumes it directly — no lossy adapter.
 *
 * Every section is OPTIONAL: which ones a deck carries depends on its deck
 * type (see deckTypes.ts). A sales deck has `proof` and `roi` but no `team`;
 * an internal memo has `options` and `risks` but no `market`. Read sections
 * through `sec()` rather than directly, so a slide renders with sane defaults
 * instead of throwing when its section is absent.
 *
 * Keep in sync with backend/app/decks/sections.py, which owns the pydantic
 * models these mirror. `backend/test_deck_registry.py` guards the backend half.
 */

export interface Stat {
  v: string; // big value, e.g. "$1.8T", "63%"
  l: string; // supporting label
}

export interface KpiTile {
  k: string; // big number
  l: string; // short label
}

export interface LeadItem {
  k: string; // 1-3 word bold lead
  t: string; // the rest
}

// User-uploaded assets, overlaid on the deck at render time (absolute URLs).
export interface DeckAssets {
  logoUrl?: string;
  galleryImages?: { slot: string; url: string }[];
}

// ── Section shapes ───────────────────────────────────────────────────────────

export interface SummaryData {
  headline: string;
  lead: string;
  highlights: KpiTile[];
}

export interface ProbSolData {
  headline: string;
  sub: string;
  problemTitle: string;
  problemLead: string;
  solutionTitle: string;
  solutionLead: string;
  problem: LeadItem[];
  solution: LeadItem[];
  problemFoot: string;
  solutionFoot: string;
}

export interface ProductData {
  headline: string;
  sub: string;
  steps: { n: string; t: string; d: string; tags: string[] }[];
}

export interface MarketData {
  headline: string;
  tam: Stat;
  sam: Stat;
  som: Stat;
  note: string;
}

export interface ModelData {
  headline: string;
  flow: string[];
  streams: { t: string; d: string; v: string; vl: string }[];
  tiers: { t: string; p: string; s: string; d: string }[];
}

export interface TractionData {
  headline: string;
  sub: string;                        // chart axis label
  series: { y: string; v: number }[]; // y = period label, v = numeric
  kpis: KpiTile[];
}

export interface CompetitionData {
  headline: string;
  cols: string[];                       // [own column, then the alternatives]
  rows: { f: string; v: boolean[] }[];  // v aligns with cols
}

export interface RoadmapData {
  headline: string;
  sub: string;
  items: { q: string; t: string; d: string }[];
}

export interface GalleryData {
  headline: string;
  sub: string;
  // Laid out in a 4-col × 2-row grid; span = double-width tile.
  // ph = placeholder caption (rendered until a real image is supplied).
  slots: { id: string; ph: string; span?: boolean }[];
}

export interface TeamData {
  headline: string;
  members: { i: string; n: string; r: string; b: string }[];
  advisors: string;
}

export interface AskData {
  headline: string;
  sub: string;
  use: { l: string; p: number }[]; // p = percent (should total ~100)
}

export interface ClosingData {
  headline: string;
  sub: string;
  contact: string;
  site: string;
}

export interface ProofData {
  headline: string;
  sub: string;
  cases: { c: string; m: string; ml: string; d: string; q: string }[];
  logos: string[];
}

export interface PersonaData {
  headline: string;
  sub: string;
  who: string;
  context: string;
  jobs: LeadItem[];
  pains: LeadItem[];
  quote: string;
}

export interface VisionData {
  headline: string;
  sub: string;
  statement: string;
  horizon: string;
  proofPoints: KpiTile[];
}

// ── The deck ─────────────────────────────────────────────────────────────────

export interface TemplateDeckData {
  company: string;
  mark: string;     // 1–2 char logo monogram, e.g. "F"

  // Injected by TemplatedDeckSection at render time (not from the LLM).
  _assets?: DeckAssets;
  tagline: string;
  eyebrow: string;  // e.g. "Investor Presentation"
  year: string;     // e.g. "2026"
  round: string;    // e.g. "Series A · Raising $12M"

  // Optional: backend's suggested theme key (one of THEMES[].key). The user
  // can always override via the picker.
  theme_suggestion?: string;

  // Shared sections
  summary?: SummaryData;
  probsol?: ProbSolData;
  product?: ProductData;
  market?: MarketData;
  model?: ModelData;
  traction?: TractionData;
  competition?: CompetitionData;
  roadmap?: RoadmapData;
  galleryS?: GalleryData;
  team?: TeamData;
  ask?: AskData;
  closing?: ClosingData;

  // Sales
  proof?: ProofData;
  roi?: TractionData;

  // Product / demo
  persona?: PersonaData;

  // Partnership
  partnerRole?: ProbSolData;
  partnershipModel?: ModelData;
  gtm?: RoadmapData;

  // Internal
  recommendation?: SummaryData;
  options?: CompetitionData;
  risks?: ProbSolData;

  // Investor update
  period?: SummaryData;
  wins?: ProductData;

  // Vision
  vision?: VisionData;
  values?: ProductData;
  pillars?: ProductData;
}

// ── Safe section access ──────────────────────────────────────────────────────

/**
 * Read a section by key, filled in from `fallback`.
 *
 * Sections are optional and a renderer is reused across several of them
 * (`probsol` also draws `risks` and `partnerRole`), so slides address their
 * data by key rather than by field. Merging over a fallback means a section
 * that is missing — or present but missing a field the model made optional —
 * still renders rather than throwing mid-deck.
 */
export function sec<T extends object>(
  C: TemplateDeckData,
  key: string,
  fallback: T
): T {
  const raw = (C as unknown as Record<string, unknown>)[key];
  if (!raw || typeof raw !== "object") return fallback;
  return { ...fallback, ...(raw as Partial<T>) } as T;
}

// Per-shape defaults, so every renderer can assume its arrays and strings exist.
export const EMPTY_SUMMARY: SummaryData = { headline: "", lead: "", highlights: [] };
export const EMPTY_PROBSOL: ProbSolData = {
  headline: "", sub: "", problemTitle: "", problemLead: "",
  solutionTitle: "", solutionLead: "", problem: [], solution: [],
  problemFoot: "", solutionFoot: "",
};
export const EMPTY_PRODUCT: ProductData = { headline: "", sub: "", steps: [] };
export const EMPTY_MARKET: MarketData = {
  headline: "", tam: { v: "", l: "" }, sam: { v: "", l: "" }, som: { v: "", l: "" }, note: "",
};
export const EMPTY_MODEL: ModelData = { headline: "", flow: [], streams: [], tiers: [] };
export const EMPTY_TRACTION: TractionData = { headline: "", sub: "", series: [], kpis: [] };
export const EMPTY_COMPETITION: CompetitionData = { headline: "", cols: [], rows: [] };
export const EMPTY_ROADMAP: RoadmapData = { headline: "", sub: "", items: [] };
export const EMPTY_GALLERY: GalleryData = {
  headline: "Product gallery",
  sub: "Add product screens, photos, or press to bring the story to life.",
  slots: [
    { id: "g1", ph: "Product screenshot", span: true }, { id: "g2", ph: "Mobile app" },
    { id: "g3", ph: "Product in use" }, { id: "g4", ph: "Customer / press" },
    { id: "g5", ph: "Reporting view", span: true },
  ],
};
export const EMPTY_TEAM: TeamData = { headline: "", members: [], advisors: "" };
export const EMPTY_ASK: AskData = { headline: "", sub: "", use: [] };
export const EMPTY_CLOSING: ClosingData = { headline: "", sub: "", contact: "", site: "" };
export const EMPTY_PROOF: ProofData = { headline: "", sub: "", cases: [], logos: [] };
export const EMPTY_PERSONA: PersonaData = {
  headline: "", sub: "", who: "", context: "", jobs: [], pains: [], quote: "",
};
export const EMPTY_VISION: VisionData = {
  headline: "", sub: "", statement: "", horizon: "", proofPoints: [],
};

/**
 * The investor deck's section order.
 *
 * Kept as the default for decks generated before `slide_order` was persisted —
 * those are all investor decks, and this is the exact order they were built
 * against. New code should resolve the order via `slideOrder()` in deckTypes.ts.
 */
export const DECK_SLIDE_ORDER = [
  "cover", "summary", "probsol", "product", "market", "model",
  "traction", "competition", "roadmap", "galleryS", "team", "ask", "closing",
] as const;
