// ─── Application Constants ────────────────────────────────────────────────────

export const APP_NAME = "iPreneur";
export const APP_TAGLINE = "AI Pitch Deck Studio";
export const APP_VERSION = "1.0.0";

// ─── Slide Templates ──────────────────────────────────────────────────────────

export const DEFAULT_SLIDE_ORDER = [
  "cover",
  "problem",
  "solution",
  "market",
  "product",
  "traction",
  "business_model",
  "go_to_market",
  "competition",
  "team",
  "financials",
  "ask",
] as const;

export const SLIDE_TYPE_LABELS: Record<string, string> = {
  cover: "Cover",
  problem: "Problem",
  solution: "Solution",
  market: "Market Opportunity",
  product: "Product / Demo",
  traction: "Traction",
  business_model: "Business Model",
  go_to_market: "Go-to-Market",
  competition: "Competitive Landscape",
  team: "Team",
  financials: "Financials",
  ask: "The Ask",
  custom: "Custom",
};

// ─── Job Steps ────────────────────────────────────────────────────────────────

export const JOB_STEP_LABELS: Record<string, string> = {
  crawling: "Crawling website",
  extracting_branding: "Extracting brand identity",
  researching: "Researching market & competitors",
  generating_content: "Generating deck content",
  rendering_ppt: "Rendering presentation",
  uploading: "Finalizing & uploading",
};

export const JOB_STEP_ORDER = [
  "crawling",
  "extracting_branding",
  "researching",
  "generating_content",
  "rendering_ppt",
  "uploading",
] as const;

// ─── Design System Tokens ─────────────────────────────────────────────────────

export const BRAND_COLORS = {
  obsidian: "#0A0716",
  deepPurple: "#130D26",
  electricBlue: "#2540B5",
  violet: "#7B2CBF",
  gradientStart: "#2540B5",
  gradientEnd: "#7B2CBF",
  surface: "#1A1130",
  border: "#2A1F45",
  textPrimary: "#F5F3FF",
  textSecondary: "#9B8EC4",
  textMuted: "#5C4E7A",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
} as const;

// ─── API Routes ───────────────────────────────────────────────────────────────

export const API_ROUTES = {
  auth: {
    login: "/api/v1/auth/login",
    register: "/api/v1/auth/register",
    logout: "/api/v1/auth/logout",
    refresh: "/api/v1/auth/refresh",
    me: "/api/v1/auth/me",
  },
  projects: {
    list: "/api/v1/projects",
    create: "/api/v1/projects",
    get: (id: string) => `/api/v1/projects/${id}`,
    update: (id: string) => `/api/v1/projects/${id}`,
    delete: (id: string) => `/api/v1/projects/${id}`,
    analyze: (id: string) => `/api/v1/projects/${id}/analyze`,
    status: (id: string) => `/api/v1/projects/${id}/status`,
  },
  decks: {
    get: (id: string) => `/api/v1/decks/${id}`,
    updateSlide: (deckId: string, slideId: string) =>
      `/api/v1/decks/${deckId}/slides/${slideId}`,
    reorder: (deckId: string) => `/api/v1/decks/${deckId}/reorder`,
    export: (deckId: string) => `/api/v1/decks/${deckId}/export`,
  },
  presentations: {
    get: (id: string) => `/api/v1/presentations/${id}`,
    download: (id: string) => `/api/v1/presentations/${id}/download`,
  },
} as const;

// ─── Plan Limits ──────────────────────────────────────────────────────────────

export const PLAN_LIMITS = {
  free: {
    projectsPerMonth: 1,
    slidesPerDeck: 10,
    exportsPerMonth: 1,
    teamMembers: 1,
  },
  starter: {
    projectsPerMonth: 5,
    slidesPerDeck: 15,
    exportsPerMonth: 10,
    teamMembers: 1,
  },
  pro: {
    projectsPerMonth: 20,
    slidesPerDeck: 25,
    exportsPerMonth: 50,
    teamMembers: 5,
  },
  enterprise: {
    projectsPerMonth: -1, // unlimited
    slidesPerDeck: 40,
    exportsPerMonth: -1,
    teamMembers: -1,
  },
} as const;
