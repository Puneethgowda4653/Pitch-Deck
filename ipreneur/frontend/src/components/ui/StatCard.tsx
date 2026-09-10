import React from "react";

const CSS = `
.ipr-stat{
  display:flex; align-items:center; gap:15px;
  background:var(--glass-2);
  -webkit-backdrop-filter:var(--glass-blur); backdrop-filter:var(--glass-blur);
  border:1px solid var(--glass-edge);
  border-radius:var(--radius-xl); padding:18px 20px;
  box-shadow:var(--glass-rim), var(--shadow-sm);
}
.ipr-stat__icon{
  width:44px; height:44px; border-radius:var(--radius-md); flex-shrink:0;
  display:inline-flex; align-items:center; justify-content:center;
  background:var(--clay-50); color:var(--clay-700);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.95), 0 1px 2px rgba(122,78,62,.10);
}
/* The one stat worth acting on gets the clay treatment. */
.ipr-stat__icon--grad{
  background:var(--clay-500); color:var(--text-on-brand);
  box-shadow:var(--clay-raise-sm);
}
.ipr-stat__body{ min-width:0; }
.ipr-stat__value{ font-family:var(--font-display); font-weight:var(--weight-extra);
  font-size:var(--text-xl); color:var(--text-strong); line-height:1.05; letter-spacing:-0.03em; }
.ipr-stat__label{ font-family:var(--font-body); font-size:var(--text-xs);
  color:var(--text-faint); margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ipr-stat__delta{ font-family:var(--font-mono); font-size:var(--text-xs); font-weight:var(--weight-medium); }
.ipr-stat__delta--up{ color:var(--green-600); }
.ipr-stat__delta--down{ color:var(--red-600); }
`;

function useInjectStyle(id: string, css: string) {
  React.useEffect(() => {
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id; s.textContent = css;
    document.head.appendChild(s);
  }, []);
}

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  value: string;
  label: string;
  delta?: { text: string; dir?: "up" | "down" };
  gradientIcon?: boolean;
}

export function StatCard({ icon, value, label, delta, gradientIcon = false, className = "", style, ...props }: StatCardProps) {
  useInjectStyle("ipr-stat-css", CSS);
  return (
    <div className={["ipr-stat", className].filter(Boolean).join(" ")} style={style} {...props}>
      {icon ? (
        <span className={"ipr-stat__icon" + (gradientIcon ? " ipr-stat__icon--grad" : "")} aria-hidden="true">{icon}</span>
      ) : null}
      <div className="ipr-stat__body">
        <div className="ipr-stat__value">{value}</div>
        <div className="ipr-stat__label">
          {label}
          {delta ? (
            <span className={"ipr-stat__delta ipr-stat__delta--" + (delta.dir || "up")}> · {delta.text}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
