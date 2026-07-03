import React from "react";

const CSS = `
.ipr-card{
  background:var(--surface-card); border:1px solid var(--border-subtle);
  border-radius:var(--radius-lg); box-shadow:var(--shadow-sm);
  transition:transform var(--dur-base) var(--ease-out),
             box-shadow var(--dur-base) var(--ease-out),
             border-color var(--dur-base) var(--ease-out);
}
.ipr-card--pad{ padding:var(--space-6); }
.ipr-card--pad-sm{ padding:var(--space-4); }
.ipr-card--interactive{ cursor:pointer; }
.ipr-card--interactive:hover{ transform:translateY(-2px); box-shadow:var(--shadow-lg); border-color:var(--border-brand); }
.ipr-card--gradient{ position:relative; overflow:hidden; }
.ipr-card--gradient::before{ content:""; position:absolute; inset:0;
  background:var(--grad-brand-soft); opacity:.7; pointer-events:none; }
.ipr-card--gradient > *{ position:relative; }
`;

function useInjectStyle(id: string, css: string) {
  React.useEffect(() => {
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id; s.textContent = css;
    document.head.appendChild(s);
  }, []);
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "md" | "sm" | "none";
  interactive?: boolean;
  gradient?: boolean;
}

export function Card({
  padding = "md",
  interactive = false,
  gradient = false,
  className = "",
  style,
  children,
  ...props
}: CardProps) {
  useInjectStyle("ipr-card-css", CSS);
  const cls = [
    "ipr-card",
    padding === "md" ? "ipr-card--pad" : padding === "sm" ? "ipr-card--pad-sm" : "",
    interactive ? "ipr-card--interactive" : "",
    gradient ? "ipr-card--gradient" : "",
    className,
  ].filter(Boolean).join(" ");
  return <div className={cls} style={style} {...props}>{children}</div>;
}
