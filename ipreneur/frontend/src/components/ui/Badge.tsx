import React from "react";

const CSS = `
.ipr-badge{
  display:inline-flex; align-items:center; gap:5px;
  font-family:var(--font-body); font-size:var(--text-xs); font-weight:var(--weight-semibold);
  line-height:1; padding:5px 9px; border-radius:var(--radius-pill);
  border:1px solid transparent; white-space:nowrap; letter-spacing:.005em;
}
.ipr-badge__dot{ width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0; }
.ipr-badge--brand{ background:var(--violet-100); color:var(--violet-700); border-color:var(--violet-200); }
.ipr-badge--neutral{ background:var(--neutral-100); color:var(--neutral-700); border-color:var(--neutral-200); }
.ipr-badge--success{ background:var(--success-surface); color:var(--green-600); border-color:rgba(22,163,74,.2); }
.ipr-badge--warning{ background:var(--warning-surface); color:var(--amber-600); border-color:rgba(224,138,0,.2); }
.ipr-badge--danger{ background:var(--danger-surface); color:var(--red-600); border-color:rgba(220,38,38,.2); }
.ipr-badge--info{ background:var(--info-surface); color:var(--blue-600); border-color:rgba(37,99,235,.2); }
.ipr-badge--solid{ background:var(--grad-brand); color:var(--text-on-brand); border-color:transparent; }
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
