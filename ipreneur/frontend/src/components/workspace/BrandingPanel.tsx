import type { BrandingData, Project } from "@/types";
import { Avatar } from "@/components/shared/Avatar";

interface BrandingPanelProps {
  branding: BrandingData;
  project?: Project;
}

const s = {
  card: { background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)", overflow: "hidden" } as React.CSSProperties,
  head: { display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid var(--border-subtle)" } as React.CSSProperties,
  name: { font: "700 15px var(--font-display)", color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const } as React.CSSProperties,
  url: { font: "400 12px var(--font-body)", color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const } as React.CSSProperties,
  body: { padding: "6px 18px 14px" } as React.CSSProperties,
  row: (last?: boolean): React.CSSProperties => ({ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: last ? "none" : "1px solid var(--border-subtle)" }),
  key: { font: "500 12px var(--font-body)", color: "var(--text-muted)" } as React.CSSProperties,
  val: { font: "600 13px var(--font-body)", color: "var(--text-strong)" } as React.CSSProperties,
  swatch: (color: string): React.CSSProperties => ({ width: 18, height: 18, borderRadius: 6, background: color, border: "1.5px solid #fff", boxShadow: "var(--shadow-xs)" }),
  swatchRow: { display: "flex", gap: 5 } as React.CSSProperties,
  tagline: { padding: "10px 18px 14px", font: "400 12px var(--font-body)", color: "var(--text-muted)", fontStyle: "italic" as const, borderTop: "1px solid var(--border-subtle)" } as React.CSSProperties,
};

export function BrandingPanel({ branding, project }: BrandingPanelProps) {
  const companyName = branding.companyName ?? project?.name ?? "Company";
  const companyUrl = (project?.companyUrl ?? project?.company_url ?? "").replace(/^https?:\/\//, "");
  const fundingStage = branding.fundingStage ?? (branding as any).funding_stage;
  const askAmount = (branding as any).askAmountUsd ?? (branding as any).ask_amount_usd;
  const hasPalette = branding.primaryColor || branding.secondaryColor;

  return (
    <div style={s.card}>
      <div style={s.head}>
        <Avatar name={companyName} square size="lg" />
        <div style={{ minWidth: 0 }}>
          <div style={s.name}>{companyName}</div>
          {companyUrl && <div style={s.url}>{companyUrl}</div>}
        </div>
      </div>

      <div style={s.body}>
        {branding.industry && (
          <div style={s.row()}>
            <span style={s.key}>Industry</span>
            <span style={s.val}>{branding.industry}</span>
          </div>
        )}
        {fundingStage && (
          <div style={s.row()}>
            <span style={s.key}>Stage</span>
            <span style={s.val}>{fundingStage.replace(/_/g, " ")}</span>
          </div>
        )}
        {askAmount && (
          <div style={s.row()}>
            <span style={s.key}>Ask</span>
            <span style={s.val}>${Number(askAmount).toLocaleString()}</span>
          </div>
        )}
        {hasPalette && (
          <div style={s.row(!branding.tagline)}>
            <span style={s.key}>Palette</span>
            <span style={s.swatchRow}>
              {branding.primaryColor && <span style={s.swatch(branding.primaryColor)} />}
              {branding.secondaryColor && <span style={s.swatch(branding.secondaryColor)} />}
            </span>
          </div>
        )}
      </div>

      {branding.tagline && (
        <div style={s.tagline}>"{branding.tagline}"</div>
      )}
    </div>
  );
}
