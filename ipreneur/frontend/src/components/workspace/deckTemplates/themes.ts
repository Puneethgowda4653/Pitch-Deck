/**
 * The 10 deck themes, ported from the Claude template artifact (TH array).
 * Each theme is a design-token set applied to the shared 12-slide renderer.
 */

export interface Theme {
  key: string;
  name: string;
  mood: string;
  mode: "dark" | "light";
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  fontD: string; // display font
  fontB: string; // body font
  upper: boolean; // uppercase eyebrows
  serif: boolean;
}

export const THEMES: Theme[] = [
  { key: "meridian", name: "Meridian Navy", mood: "Classic VC", mode: "dark", bg: "#0A1838", surface: "#102350", text: "#EAF0FF", muted: "#9DB0D6", accent: "#5B8DEF", accent2: "#62D6C4", fontD: "Space Grotesk", fontB: "Inter", upper: true, serif: false },
  { key: "onyx", name: "Onyx Coral", mood: "Minimalist", mode: "dark", bg: "#141519", surface: "#1E2027", text: "#F5F5F6", muted: "#A1A3AD", accent: "#FF6B53", accent2: "#FFC178", fontD: "Archivo", fontB: "Inter", upper: true, serif: false },
  { key: "abyss", name: "Abyss Teal", mood: "Deep tech", mode: "dark", bg: "#04212A", surface: "#0A3340", text: "#E6F6F4", muted: "#8DB8B6", accent: "#27D2C1", accent2: "#56B8FF", fontD: "Sora", fontB: "IBM Plex Sans", upper: false, serif: false },
  { key: "nocturne", name: "Nocturne Violet", mood: "Modern SaaS", mode: "dark", bg: "#130D2C", surface: "#1F1745", text: "#F1ECFF", muted: "#A99FCB", accent: "#9A7BFF", accent2: "#FF8FCB", fontD: "Outfit", fontB: "Inter", upper: false, serif: false },
  { key: "forest", name: "Forest Lime", mood: "Growth", mode: "dark", bg: "#0B1D15", surface: "#112C20", text: "#E9F3EC", muted: "#92B5A1", accent: "#3FBF7A", accent2: "#C4E25F", fontD: "Manrope", fontB: "Manrope", upper: false, serif: false },
  { key: "verdant", name: "Verdant", mood: "Fintech light", mode: "light", bg: "#F5F8F4", surface: "#FFFFFF", text: "#152319", muted: "#566359", accent: "#1F8A5B", accent2: "#5FA63C", fontD: "Plus Jakarta Sans", fontB: "Inter", upper: false, serif: false },
  { key: "indigo", name: "Indigo SaaS", mood: "Modern SaaS", mode: "light", bg: "#F4F4FB", surface: "#FFFFFF", text: "#15152E", muted: "#5C5C78", accent: "#4F46E5", accent2: "#0EA5B7", fontD: "DM Sans", fontB: "DM Sans", upper: false, serif: false },
  { key: "editorial", name: "Editorial Mono", mood: "Premium serif", mode: "light", bg: "#FAFAF7", surface: "#FFFFFF", text: "#121211", muted: "#6B6B63", accent: "#16150F", accent2: "#C2410C", fontD: "Newsreader", fontB: "Inter", upper: false, serif: true },
  { key: "terra", name: "Terracotta", mood: "Warm earth", mode: "light", bg: "#FBF4EC", surface: "#FFFFFF", text: "#2A1D14", muted: "#7C6A5B", accent: "#C2683D", accent2: "#7C8B4F", fontD: "Bricolage Grotesque", fontB: "Inter", upper: false, serif: false },
  { key: "slate", name: "Slate Amber", mood: "Corporate", mode: "light", bg: "#F3F6F8", surface: "#FFFFFF", text: "#162033", muted: "#586677", accent: "#E08A0B", accent2: "#2563EB", fontD: "Schibsted Grotesk", fontB: "Inter", upper: true, serif: false },
];

export const DEFAULT_THEME_KEY = "meridian";

export function getTheme(key?: string | null): Theme {
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}

// ── Token helpers (ported from the artifact) ─────────────────────────────────

export function mix(c: string, pct: number, base?: string): string {
  return `color-mix(in srgb, ${c} ${pct}%, ${base || "transparent"})`;
}

export function border(T: Theme, strong?: boolean): string {
  return T.mode === "dark"
    ? `rgba(255,255,255,${strong ? 0.16 : 0.1})`
    : `rgba(15,23,42,${strong ? 0.14 : 0.09})`;
}

export function fD(T: Theme): string {
  return `${T.fontD}, ${T.serif ? "Georgia, serif" : "sans-serif"}`;
}

// Google Fonts used across all themes — loaded once on demand.
export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Sora:wght@400;500;600;700;800&family=Archivo:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=Newsreader:wght@400;500;600;700&family=Bricolage+Grotesque:wght@400;500;600;700;800&family=Schibsted+Grotesk:wght@400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap";

export function ensureDeckFonts(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("deck-template-fonts")) return;
  const link = document.createElement("link");
  link.id = "deck-template-fonts";
  link.rel = "stylesheet";
  link.href = GOOGLE_FONTS_HREF;
  document.head.appendChild(link);
}
