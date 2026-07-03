import React from "react";

const CSS = `
.ipr-prog{ display:flex; flex-direction:column; gap:8px; width:100%; }
.ipr-prog__top{ display:flex; align-items:center; justify-content:space-between;
  font-family:var(--font-body); font-size:var(--text-xs); color:var(--text-muted); }
.ipr-prog__pct{ font-family:var(--font-mono); font-weight:var(--weight-medium); color:var(--text-brand); }
.ipr-prog__track{ height:8px; border-radius:var(--radius-pill);
  background:var(--surface-sunken); overflow:hidden; }
.ipr-prog__track--sm{ height:5px; }
.ipr-prog__track--lg{ height:11px; }
.ipr-prog__fill{ height:100%; border-radius:var(--radius-pill);
  background:var(--grad-brand);
  transition:width var(--dur-slow) var(--ease-out); }
.ipr-prog__fill--striped{
  background:var(--grad-brand);
  background-image:linear-gradient(45deg,rgba(255,255,255,.18) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.18) 50%,rgba(255,255,255,.18) 75%,transparent 75%),
    linear-gradient(135deg,var(--indigo-600),var(--violet-600));
  background-size:18px 18px, 100% 100%;
  animation:ipr-prog-stripe 1s linear infinite;
}
@keyframes ipr-prog-stripe{ to{ background-position:18px 0, 0 0; } }
`;

function useInjectStyle(id: string, css: string) {
  React.useEffect(() => {
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id; s.textContent = css;
    document.head.appendChild(s);
  }, []);
}

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  label?: string;
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
}

export function ProgressBar({ value = 0, label, showValue = false, size = "md", animated = false, className = "", style, ...props }: ProgressBarProps) {
  useInjectStyle("ipr-prog-css", CSS);
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={["ipr-prog", className].filter(Boolean).join(" ")} style={style} {...props}>
      {(label || showValue) ? (
        <div className="ipr-prog__top">
          <span>{label}</span>
          {showValue ? <span className="ipr-prog__pct">{Math.round(pct)}%</span> : null}
        </div>
      ) : null}
      <div className={"ipr-prog__track" + (size !== "md" ? " ipr-prog__track--" + size : "")}>
        <div
          className={"ipr-prog__fill" + (animated ? " ipr-prog__fill--striped" : "")}
          style={{ width: pct + "%" }}
        />
      </div>
    </div>
  );
}
