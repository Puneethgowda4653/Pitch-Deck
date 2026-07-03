import React from "react";

const CSS = `
.ipr-tabs{ display:flex; gap:2px; background:var(--surface-sunken);
  border-radius:var(--radius-md); padding:3px; width:fit-content; }
.ipr-tab{
  display:inline-flex; align-items:center; gap:6px;
  height:32px; padding:0 14px; border-radius:var(--radius-sm);
  font-family:var(--font-body); font-size:var(--text-sm); font-weight:var(--weight-medium);
  color:var(--text-muted); border:none; background:transparent; cursor:pointer;
  transition:background var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out),
             box-shadow var(--dur-base) var(--ease-out);
  white-space:nowrap;
}
.ipr-tab:hover{ color:var(--text-body); }
.ipr-tab--active{
  background:var(--surface-card); color:var(--text-strong);
  box-shadow:var(--shadow-xs);
}
.ipr-tab__count{
  font-family:var(--font-mono); font-size:10px; font-weight:var(--weight-semibold);
  background:var(--neutral-200); color:var(--text-muted);
  padding:1px 6px; border-radius:var(--radius-pill);
}
.ipr-tab--active .ipr-tab__count{ background:var(--violet-100); color:var(--violet-700); }
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
