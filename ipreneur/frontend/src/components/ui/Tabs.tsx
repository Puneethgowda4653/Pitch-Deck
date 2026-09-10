import React from "react";

const CSS = `
.ipr-tabs{ display:flex; gap:3px; background:var(--surface-sunken);
  border:1px solid var(--glass-edge); box-shadow:var(--clay-inset);
  border-radius:var(--radius-lg); padding:4px; width:fit-content; }
.ipr-tab{
  display:inline-flex; align-items:center; gap:7px;
  height:34px; padding:0 16px; border-radius:var(--radius-sm);
  font-family:var(--font-display); font-size:var(--text-sm); font-weight:var(--weight-semibold);
  color:var(--text-muted); border:none; background:transparent; cursor:pointer;
  transition:background var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out),
             box-shadow var(--dur-base) var(--ease-out);
  white-space:nowrap;
}
.ipr-tab:hover{ color:var(--text-strong); }
/* The active tab is the thing you pressed, so it rises out of the well. */
.ipr-tab--active{
  background:var(--glass-3); color:var(--text-strong);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.95), 0 3px 8px rgba(122,78,62,.16);
}
.ipr-tab__count{
  font-family:var(--font-mono); font-size:10px; font-weight:var(--weight-semibold);
  background:var(--glass-2); color:var(--text-faint);
  padding:2px 7px; border-radius:var(--radius-pill);
}
.ipr-tab--active .ipr-tab__count{ background:var(--clay-50); color:var(--clay-800); }
`;

function useInjectStyle(id: string, css: string) {
  React.useEffect(() => {
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id; s.textContent = css;
    document.head.appendChild(s);
  }, []);
}

interface Tab {
  value: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ tabs, value, onChange, className = "" }: TabsProps) {
  useInjectStyle("ipr-tabs-css", CSS);
  return (
    <div className={["ipr-tabs", className].filter(Boolean).join(" ")} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={value === tab.value}
          className={"ipr-tab" + (value === tab.value ? " ipr-tab--active" : "")}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count !== undefined ? <span className="ipr-tab__count">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
