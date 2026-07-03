import { Link } from "react-router-dom";
import { Globe, Clock, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import type { BrandingData, Project } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

interface Props {
  project: Project;
}

const statusTone: Record<string, BadgeTone> = {
  ready: "success",
  generating: "warning",
  analyzing: "warning",
  researching: "warning",
  draft: "neutral",
  error: "danger",
};

const statusLabel: Record<string, string> = {
  ready: "Ready",
  generating: "Generating",
  analyzing: "Analyzing",
  researching: "Researching",
  draft: "Draft",
  error: "Error",
};

const s = {
  inner: { padding: 18, display: "flex", flexDirection: "column" as const, gap: 14 },
  top: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, minWidth: 0 },
  nameWrap: { minWidth: 0, flex: 1 },
  name: { font: "700 15px var(--font-display)", color: "var(--text-strong)", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" },
  urlRow: { display: "flex", alignItems: "center", gap: 5, marginTop: 5, minWidth: 0 },
  urlText: { font: "400 12px var(--font-body)", color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, flex: 1 },
  swatches: { display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" as const },
  dot: (color: string): React.CSSProperties => ({ width: 18, height: 18, borderRadius: 99, background: color, border: "1.5px solid #fff", boxShadow: "var(--shadow-xs)", flexShrink: 0 }),
  industry: { font: "500 11px var(--font-body)", color: "var(--text-muted)", background: "var(--surface-sunken)", padding: "3px 9px", borderRadius: 99 } as React.CSSProperties,
  foot: { display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--border-subtle)" },
  time: { display: "flex", alignItems: "center", gap: 5, font: "400 12px var(--font-body)", color: "var(--text-faint)" },
};

export function ProjectCard({ project }: Props) {
  const companyUrl = (project.companyUrl ?? project.company_url ?? "").replace(/^https?:\/\//, "");
  const branding = project.brandingData as BrandingData | undefined;
  const updatedAt = project.updatedAt ?? project.updated_at;
  const tone = statusTone[project.status] ?? "neutral";
  const label = statusLabel[project.status] ?? project.status;

  return (
    <Link to={`/projects/${project.id}`} style={{ display: "block", textDecoration: "none", minWidth: 0, overflow: "hidden" }}>
      <Card padding="none" interactive style={{ overflow: "hidden", minWidth: 0 }}>
        <div style={s.inner}>
          <div style={s.top}>
            <div style={s.nameWrap}>
              <div style={s.name}>{project.name}</div>
              <div style={s.urlRow}>
                <Globe size={12} style={{ flexShrink: 0, color: "var(--text-faint)" }} />
                <span style={s.urlText}>{companyUrl || "—"}</span>
              </div>
            </div>
            <Badge tone={tone} dot style={{ flexShrink: 0 }}>{label}</Badge>
          </div>

          <div style={s.swatches}>
            {branding?.primaryColor && <span style={s.dot(branding.primaryColor)} />}
            {branding?.secondaryColor && <span style={s.dot(branding.secondaryColor)} />}
            {branding?.industry && <span style={s.industry}>{branding.industry}</span>}
            {!branding?.primaryColor && !branding?.secondaryColor && !branding?.industry && (
              <span style={{ font: "400 12px var(--font-body)", color: "var(--text-faint)" }}>No branding yet</span>
            )}
          </div>

          <div style={s.foot}>
            <span style={s.time}>
              <Clock size={12} />
              {updatedAt ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true }) : "—"}
            </span>
            <ChevronRight size={15} style={{ color: "var(--text-faint)" }} />
          </div>
        </div>
      </Card>
    </Link>
  );
}
