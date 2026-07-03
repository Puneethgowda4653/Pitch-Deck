import React from "react";

const CSS = `
.ipr-switch{ position:relative; display:inline-flex; align-items:center; cursor:pointer; flex-shrink:0; }
.ipr-switch input{ position:absolute; opacity:0; width:0; height:0; }
.ipr-switch__track{
  width:42px; height:24px; border-radius:var(--radius-pill);
  background:var(--neutral-300); border:1px solid var(--neutral-300);
  transition:background var(--dur-base) var(--ease-out),
             border-color var(--dur-base) var(--ease-out);
  position:relative;
}
.ipr-switch__thumb{
  position:absolute; top:3px; left:3px;
  width:16px; height:16px; border-radius:50%;
  background:#fff; box-shadow:var(--shadow-xs);
  transition:transform var(--dur-base) var(--ease-out);
}
.ipr-switch input:checked ~ .ipr-switch__track{ background:var(--grad-brand); border-color:var(--violet-600); }
.ipr-switch input:checked ~ .ipr-switch__track .ipr-switch__thumb{ transform:translateX(18px); }
.ipr-switch input:focus-visible ~ .ipr-switch__track{ box-shadow:var(--focus-ring); }
.ipr-switch input:disabled ~ .ipr-switch__track{ opacity:.5; cursor:not-allowed; }
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
