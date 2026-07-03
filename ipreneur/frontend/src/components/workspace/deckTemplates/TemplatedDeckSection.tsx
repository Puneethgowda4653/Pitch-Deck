/**
 * TemplatedDeckSection — shows the 10-template picker + the live deck, and
 * persists the user's chosen template. Rendered on a ready project that has
 * deck_content.template_data.
 */
import { useEffect, useMemo, useState } from "react";
import { THEMES, getTheme, ensureDeckFonts, DEFAULT_THEME_KEY } from "./themes";
import { TemplateDeckData } from "./types";
import { TemplatedDeck, renderSlide } from "./TemplatedDeck";

// Uploaded image URLs are relative ("/uploads/..") and served by the backend,
// not the Vite dev server — prefix them with the API origin.
const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1")
  .replace(/\/api\/v1\/?$/, "");
const absUrl = (u?: string) => (!u ? u : /^https?:\/\//.test(u) ? u : API_ORIGIN + u);

interface RawAssets {
  logoUrl?: string; logo_url?: string;
  galleryImages?: { slot: string; url: string }[];
  gallery_images?: { slot: string; url: string }[];
}

interface Props {
  data: TemplateDeckData;
  initialKey?: string | null;
  assets?: RawAssets | null;
  onPersist?: (key: string) => void;
}

export function TemplatedDeckSection({ data: rawData, initialKey, assets, onPersist }: Props) {
  useEffect(() => { ensureDeckFonts(); }, []);

  // Normalize backend assets (camel/snake) → absolute URLs, inject into deck data.
  const data = useMemo(() => {
    const logo = assets?.logoUrl ?? assets?.logo_url;
    const imgs = assets?.galleryImages ?? assets?.gallery_images ?? [];
    if (!logo && !imgs.length) return rawData;
    return {
      ...rawData,
      _assets: {
        logoUrl: absUrl(logo),
        galleryImages: imgs.map((g) => ({ slot: g.slot, url: absUrl(g.url) as string })),
      },
    };
  }, [rawData, assets]);

  const startKey = initialKey || data.theme_suggestion || DEFAULT_THEME_KEY;
  const [activeKey, setActiveKey] = useState(startKey);
  const theme = useMemo(() => getTheme(activeKey), [activeKey]);

  // If the project loads a saved key after mount, sync once.
  useEffect(() => {
    if (initialKey) setActiveKey(initialKey);
  }, [initialKey]);

  const select = (key: string) => {
    if (key === activeKey) return;
    setActiveKey(key);
    onPersist?.(key);
  };

  const THUMB_W = 150;
  const scale = THUMB_W / 1280;

  return (
    <div className="space-y-5">
      {/* ── Template picker strip ─────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 style={{ font: "600 13px var(--font-display)", color: "var(--text-strong)" }}>
            Template
          </h3>
          <span style={{ font: "400 12px var(--font-body)", color: "var(--text-muted)" }}>
            {theme.name} · {theme.mood}
          </span>
        </div>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6 }}>
          {THEMES.map((t) => {
            const selected = t.key === activeKey;
            return (
              <button
                key={t.key}
                onClick={() => select(t.key)}
                title={`${t.name} — ${t.mood}`}
                style={{
                  flexShrink: 0,
                  padding: 0,
                  borderRadius: 10,
                  overflow: "hidden",
                  cursor: "pointer",
                  background: "transparent",
                  border: selected ? `2px solid ${t.accent}` : "2px solid var(--border-subtle)",
                  boxShadow: selected ? `0 4px 16px ${t.accent}40` : "none",
                  transition: "border-color .15s ease, box-shadow .15s ease",
                }}
              >
                <div style={{ width: THUMB_W, height: 720 * scale, overflow: "hidden", position: "relative" }}>
                  <div style={{ width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                    {renderSlide(t, data, 0)}
                  </div>
                </div>
                <div style={{ padding: "5px 8px", background: "var(--surface-page)", textAlign: "left" }}>
                  <div style={{ font: "600 10.5px var(--font-body)", color: "var(--text-strong)", whiteSpace: "nowrap" }}>{t.name}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Live deck in the selected template ────────────────────── */}
      <TemplatedDeck data={data} theme={theme} />
    </div>
  );
}
