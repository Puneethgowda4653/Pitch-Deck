import React from "react";

const CSS = `
.ipr-card{
  background:var(--glass-2);
  -webkit-backdrop-filter:var(--glass-blur); backdrop-filter:var(--glass-blur);
  border:1px solid var(--glass-edge);
  border-radius:var(--radius-xl);
  box-shadow:var(--glass-rim), var(--shadow-md);
  transition:transform var(--dur-base) var(--ease-clay),
             box-shadow var(--dur-base) var(--ease-out),
             border-color var(--dur-base) var(--ease-out),
             background var(--dur-base) var(--ease-out);
}
.ipr-card--pad{ padding:var(--space-6); }
.ipr-card--pad-sm{ padding:var(--space-4); }
.ipr-card--interactive{ cursor:pointer; }
.ipr-card--interactive:hover{
  transform:translateY(-3px);
  background:var(--glass-3);
  border-color:var(--glass-edge-hi);
  box-shadow:var(--glass-rim), var(--shadow-lg);
}
/* A wash of brand light BEHIND the glass, not a gradient laid on top. */
.ipr-card--gradient{ position:relative; overflow:hidden; }
.ipr-card--gradient::before{ content:""; position:absolute; inset:0;
  background:radial-gradient(120% 100% at 12% 0%, rgba(255,122,89,.22) 0%, transparent 66%);
  pointer-events:none; }
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
