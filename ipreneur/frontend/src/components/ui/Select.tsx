import React from "react";

const CSS = `
.ipr-select-wrap{ position:relative; display:flex; align-items:center; }
.ipr-select{
  width:100%; height:44px; padding:0 36px 0 14px; font-family:var(--font-body);
  font-size:var(--text-sm); color:var(--text-strong);
  background:var(--surface-card); border:1px solid var(--border-default);
  border-radius:var(--radius-md); outline:none; appearance:none; cursor:pointer;
  transition:border-color var(--dur-base) var(--ease-out),
             box-shadow var(--dur-base) var(--ease-out);
}
.ipr-select:hover{ border-color:var(--border-strong); }
.ipr-select:focus{ border-color:var(--brand); box-shadow:var(--focus-ring); }
.ipr-select:disabled{ background:var(--surface-sunken); color:var(--text-faint); cursor:not-allowed; }
.ipr-select-arrow{
  position:absolute; right:12px; pointer-events:none;
  color:var(--text-faint); display:inline-flex;
}
`;

function useInjectStyle(id: string, css: string) {
  React.useEffect(() => {
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id; s.textContent = css;
    document.head.appendChild(s);
  }, []);
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options?: (SelectOption | string)[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ label, hint, error, options = [], id, className = "", style, ...props }, ref) {
    useInjectStyle("ipr-select-css", CSS);
    const autoId = React.useId();
    const fieldId = id || autoId;

    return (
      <div className="ipr-field" style={style}>
        {label ? <label className="ipr-field__label" htmlFor={fieldId}>{label}</label> : null}
        <div className="ipr-select-wrap">
          <select id={fieldId} ref={ref} className={["ipr-select", className].filter(Boolean).join(" ")} {...props}>
            {props.placeholder && <option value="">{props.placeholder}</option>}
            {options.map((opt) => {
              const val = typeof opt === "string" ? opt : opt.value;
              const lbl = typeof opt === "string" ? opt : opt.label;
              return <option key={val} value={val}>{lbl}</option>;
            })}
          </select>
          <span className="ipr-select-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
        {error ? <span className="ipr-field__err">{error}</span> : hint ? <span className="ipr-field__hint">{hint}</span> : null}
      </div>
    );
  }
);
