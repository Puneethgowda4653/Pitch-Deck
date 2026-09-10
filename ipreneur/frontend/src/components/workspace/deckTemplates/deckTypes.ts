/**
 * Frontend mirror of the backend deck-type registry.
 *
 * Mirrors backend/app/decks/registry.py (slide sequences) and the renderer +
 * eyebrow half of backend/app/decks/sections.py. The backend owns the models,
 * prompts and skeletons; this side only needs to know, for each section key,
 * WHICH renderer draws it and WHAT eyebrow sits above it.
 *
 * That split is what lets one renderer serve several sections: `probsol` draws
 * the problem/solution slide, the risks/mitigations slide, and the partnership
 * "what each side brings" slide — same layout, different key, different eyebrow.
 *
 * A generated deck persists its own resolved order as `deck_content.slide_order`,
 * and `slideOrder()` prefers that over the table here — so an existing deck keeps
 * rendering the slides it was actually generated with even after this file changes.
 *
 * `backend/test_deck_registry.py::test_spec_is_complete` fails if the backend
 * names a renderer that isn't in RENDERERS over in TemplatedDeck.tsx.
 */

export type RendererId =
  | "cover" | "summary" | "probsol" | "product" | "market" | "model"
  | "traction" | "competition" | "roadmap" | "gallery" | "team" | "ask"
  | "closing" | "proof" | "persona" | "vision";

export interface SlideSlot {
  /** template_data key this slide reads, and the root of its edit paths. */
  key: string;
  renderer: RendererId;
  /** Small label above the headline. Distinguishes reused renderers. */
  eyebrow: string;
}

/** Section key → how it is drawn. Mirrors SECTION_SPECS.renderer. */
const SECTIONS: Record<string, { renderer: RendererId; eyebrow: string }> = {
  // Shared
  cover: { renderer: "cover", eyebrow: "" },
  summary: { renderer: "summary", eyebrow: "Executive summary" },
  probsol: { renderer: "probsol", eyebrow: "Problem & solution" },
  product: { renderer: "product", eyebrow: "Product" },
  market: { renderer: "market", eyebrow: "Market size" },
  model: { renderer: "model", eyebrow: "Business model" },
  traction: { renderer: "traction", eyebrow: "Traction" },
  competition: { renderer: "competition", eyebrow: "Competition" },
  roadmap: { renderer: "roadmap", eyebrow: "Roadmap" },
  galleryS: { renderer: "gallery", eyebrow: "Gallery" },
  team: { renderer: "team", eyebrow: "Team" },
  ask: { renderer: "ask", eyebrow: "The ask" },
  closing: { renderer: "closing", eyebrow: "Thank you" },

  // Sales
  proof: { renderer: "proof", eyebrow: "Proof" },
  roi: { renderer: "traction", eyebrow: "ROI & business impact" },

  // Product / demo
  persona: { renderer: "persona", eyebrow: "Who it's for" },

  // Partnership
  partnerRole: { renderer: "probsol", eyebrow: "What each side brings" },
  partnershipModel: { renderer: "model", eyebrow: "Partnership model" },
  gtm: { renderer: "roadmap", eyebrow: "Go-to-market together" },

  // Internal
  recommendation: { renderer: "summary", eyebrow: "Recommendation" },
  options: { renderer: "competition", eyebrow: "Options considered" },
  risks: { renderer: "probsol", eyebrow: "Risks & mitigations" },

  // Investor update
  period: { renderer: "summary", eyebrow: "This period" },
  wins: { renderer: "product", eyebrow: "Wins & challenges" },

  // Vision
  vision: { renderer: "vision", eyebrow: "Vision" },
  values: { renderer: "product", eyebrow: "Operating principles" },
  pillars: { renderer: "product", eyebrow: "Strategic pillars" },
};

export interface DeckTypeSpec {
  key: string;
  label: string;
  description: string;
  sections: string[];
}

export const DEFAULT_DECK_TYPE = "investor";

export const DECK_TYPES: Record<string, DeckTypeSpec> = {
  investor: {
    key: "investor",
    label: "Investor / Fundraising",
    description: "Raise capital from angels or VCs. Problem, market, traction, team, ask.",
    sections: ["cover", "summary", "probsol", "product", "market", "model",
      "traction", "competition", "roadmap", "galleryS", "team", "ask", "closing"],
  },
  sales: {
    key: "sales",
    label: "Sales / Customer",
    description: "Win a customer. Their pain, your fix, proof it works, pricing, next step.",
    sections: ["cover", "probsol", "competition", "product", "proof", "roi", "model", "roadmap", "closing"],
  },
  product: {
    key: "product",
    label: "Product / Demo",
    description: "Show the product. User, workflow, screens, differentiators, roadmap.",
    sections: ["cover", "persona", "probsol", "product", "galleryS", "competition", "roadmap", "closing"],
  },
  partnership: {
    key: "partnership",
    label: "Partnership / Collaboration",
    description: "Propose a partnership. Mutual value, model, joint GTM, economics.",
    sections: ["cover", "summary", "product", "partnerRole", "partnershipModel", "gtm", "ask", "traction", "closing"],
  },
  internal: {
    key: "internal",
    label: "Internal / Decision Memo",
    description: "Get internal buy-in. Recommendation, options, plan, resources, risks.",
    sections: ["cover", "recommendation", "probsol", "summary", "product", "options", "roadmap", "ask", "risks", "closing"],
  },
  update: {
    key: "update",
    label: "Investor Update",
    description: "Report to existing investors. Metrics, wins, challenges, asks, outlook.",
    sections: ["cover", "period", "traction", "wins", "roadmap", "market", "team", "closing"],
  },
  vision: {
    key: "vision",
    label: "Vision / Mission",
    description: "Align people on the long game. Vision, principles, pillars, horizons.",
    sections: ["cover", "vision", "summary", "values", "pillars", "roadmap", "traction", "closing"],
  },
};

/**
 * The slide sequence to render.
 *
 * `stored` is the deck's own persisted `slide_order`, which is authoritative —
 * it reflects the stage overrides actually applied at generation time and
 * survives later edits to this registry. Falls back to the deck type's default,
 * then to the investor deck (what every pre-multi-type project is).
 */
export function slideOrder(
  deckType?: string | null,
  stored?: readonly string[] | null
): SlideSlot[] {
  const keys =
    stored && stored.length
      ? stored
      : (DECK_TYPES[deckType || DEFAULT_DECK_TYPE] ?? DECK_TYPES[DEFAULT_DECK_TYPE]).sections;

  return keys
    .filter((k) => SECTIONS[k])
    .map((k) => ({ key: k, renderer: SECTIONS[k].renderer, eyebrow: SECTIONS[k].eyebrow }));
}

export function deckTypeLabel(deckType?: string | null): string {
  return (DECK_TYPES[deckType || DEFAULT_DECK_TYPE] ?? DECK_TYPES[DEFAULT_DECK_TYPE]).label;
}
