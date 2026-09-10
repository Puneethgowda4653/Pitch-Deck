import React from "react";

const CSS = `
.ipr-switch{ position:relative; display:inline-flex; align-items:center; cursor:pointer; flex-shrink:0; }
.ipr-switch input{ position:absolute; opacity:0; width:0; height:0; }
/* The clearest clay object in the app: a pressed-in track, a raised thumb. */
.ipr-switch__track{
  width:48px; height:28px; border-radius:var(--radius-pill);
  background:var(--surface-sunken); border:1px solid var(--glass-edge);
  box-shadow:var(--clay-inset);
  transition:background var(--dur-base) var(--ease-out),
             border-color var(--dur-base) var(--ease-out);
  position:relative;
}
.ipr-switch__thumb{
  position:absolute; top:3px; left:3px;
  width:20px; height:20px; border-radius:50%;
  background:var(--ink-0);
  box-shadow:inset 0 -1.5px 3px rgba(122,78,62,.20), 0 2px 5px rgba(122,78,62,.28);
  transition:transform var(--dur-base) var(--ease-clay), background var(--dur-base) var(--ease-out);
}
.ipr-switch input:checked ~ .ipr-switch__track{
  background:rgba(255,122,89,.30); border-color:rgba(255,122,89,.55);
}
.ipr-switch input:checked ~ .ipr-switch__track .ipr-switch__thumb{
  transform:translateX(20px); background:var(--clay-500);
  box-shadow:inset 0 1.5px 0 rgba(255,255,255,.45), 0 3px 8px rgba(255,122,89,.50);
}
.ipr-switch input:focus-visible ~ .ipr-switch__track{ box-shadow:var(--clay-inset), var(--focus-ring); }
.ipr-switch input:disabled ~ .ipr-switch__track{ opacity:.45; cursor:not-allowed; }
`;

function useInjectStyle(id: string, css: string) {
  React.useEffect(() => {
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id; s.textContent = css;
    document.head.appendChild(s);
  }, []);
}

interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

export function Switch({ checked = false, onChange, disabled = false, id }: SwitchProps) {
  useInjectStyle("ipr-switch-css", CSS);
  const autoId = React.useId();
  const switchId = id || autoId;

  return (
    <label className="ipr-switch" htmlFor={switchId}>
      <input
        id={switchId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="ipr-switch__track">
        <span className="ipr-switch__thumb" />
      </span>
    </label>
  );
}
