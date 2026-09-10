import React from "react";

const CSS = `
.ipr-badge{
  display:inline-flex; align-items:center; gap:6px;
  font-family:var(--font-body); font-size:var(--text-xs); font-weight:var(--weight-semibold);
  line-height:1; padding:5px 11px; border-radius:var(--radius-pill);
  border:1px solid transparent; white-space:nowrap; letter-spacing:.01em;
  -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px);
}
.ipr-badge__dot{ width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0; }
.ipr-badge--brand{ background:var(--clay-50); color:var(--clay-800); border-color:rgba(255,122,89,.34); }
.ipr-badge--neutral{ background:var(--glass-2); color:var(--text-muted); border-color:var(--glass-edge); }
.ipr-badge--success{ background:var(--success-surface); color:var(--green-600); border-color:rgba(64,214,143,.30); }
.ipr-badge--warning{ background:var(--warning-surface); color:var(--amber-600); border-color:rgba(255,195,107,.30); }
.ipr-badge--danger{ background:var(--danger-surface); color:var(--red-600); border-color:var(--danger-border); }
.ipr-badge--info{ background:var(--info-surface); color:var(--blue-600); border-color:rgba(110,165,255,.30); }
.ipr-badge--solid{ background:var(--clay-500); color:var(--text-on-brand);
  border-color:transparent; box-shadow:var(--clay-raise-sm); }
`;

function useInjectStyle(id: string, css: string) {
  React.useEffect(() => {
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id; s.textContent = css;
    document.head.appendChild(s);
  }, []);
}

export type BadgeTone = "brand" | "neutral" | "success" | "warning" | "danger" | "info" | "solid";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  icon?: React.ReactNode;
}

export function Badge({ tone = "brand", dot = false, icon, className = "", children, ...props }: BadgeProps) {
  useInjectStyle("ipr-badge-css", CSS);
  const cls = ["ipr-badge", `ipr-badge--${tone}`, className].filter(Boolean).join(" ");
  return (
    <span className={cls} {...props}>
      {dot ? <span className="ipr-badge__dot" /> : null}
      {icon ? <span style={{ display: "inline-flex" }} aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}
