/**
 * Shared data contract for the templated pitch deck.
 *
 * The backend generation pass emits a `template_data` object in exactly this
 * shape (stored on deck_content.template_data). The 10-theme renderer in
 * TemplatedDeck.tsx consumes it directly — no lossy adapter.
 *
 * Keep this in sync with the JSON schema in
 * backend/app/agents/master/master_agent.py (_build_generation_prompt).
 */

export interface Stat {
  v: string; // big value, e.g. "$1.8T", "63%"
  l: string; // supporting label
}

// User-uploaded assets, overlaid on the deck at render time (absolute URLs).
export interface DeckAssets {
  logoUrl?: string;
  galleryImages?: { slot: string; url: string }[];
}

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

  summary: {
    headline: string;
    lead: string;
    highlights: { k: string; l: string }[]; // 4 KPI tiles
  };

  probsol: {
    headline: string;
    sub: string;
    problemTitle: string;
    problemLead: string;
    solutionTitle: string;
    solutionLead: string;
    problem: { k: string; t: string }[];  // 3 items: k = bold lead, t = rest
    solution: { k: string; t: string }[]; // 3 items
    problemFoot: string;
    solutionFoot: string;
  };

  product: {
    headline: string;
    sub: string;
    steps: { n: string; t: string; d: string; tags: string[] }[]; // 3 items: n = "01".."03", tags = chips
  };

  market: {
    headline: string;
    tam: Stat;
    sam: Stat;
    som: Stat;
    note: string; // bottom-up methodology note
  };

  model: {
    headline: string;
    flow: string[]; // 3–4 nodes of the revenue flow
    streams: { t: string; d: string; v: string; vl: string }[]; // 2 items; v = "~70%", vl = "of revenue"
    tiers: { t: string; p: string; s: string; d: string }[];    // 3 pricing tiers; p = "$499", s = "/mo"
  };

  traction: {
    headline: string;
    sub: string; // chart axis label, e.g. "ARR growth ($M)"
    series: { y: string; v: number }[]; // 5–6 points; y = period label, v = numeric ($M)
    kpis: { k: string; l: string }[];   // 4 KPI tiles
  };

  competition: {
    headline: string;
    cols: string[];               // [own company, comp1, comp2, comp3] — 4 columns
    rows: { f: string; v: boolean[] }[]; // 5 feature rows; v aligns with cols
  };

  roadmap: {
    headline: string;
    sub: string;
    items: { q: string; t: string; d: string }[]; // 4 milestones; q = "Q1 2026"
  };

  galleryS: {
    headline: string;
    sub: string;
    // 5 image slots laid out in a 4-col × 2-row grid; span = double-width tile.
    // ph = placeholder caption (rendered until a real image is supplied).
    slots: { id: string; ph: string; span?: boolean }[];
  };

  team: {
    headline: string;
    members: { i: string; n: string; r: string; b: string }[]; // i = initials, n = name, r = role, b = bio
    advisors: string;
  };

  ask: {
    headline: string;
    sub: string;
    use: { l: string; p: number }[]; // use-of-funds; p = percent (should total ~100)
  };

  closing: {
    headline: string;
    sub: string;
    contact: string; // email
    site: string;    // website
  };
}

export const DECK_SLIDE_ORDER = [
  "cover", "summary", "probsol", "product", "market", "model",
  "traction", "competition", "roadmap", "gallery", "team", "ask", "closing",
] as const;
