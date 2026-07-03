import React from "react";

const CSS = `
.ipr-field{ display:flex; flex-direction:column; gap:7px; }
.ipr-field__label{ font-family:var(--font-body); font-size:var(--text-sm);
  font-weight:var(--weight-semibold); color:var(--text-strong); }
.ipr-field__hint{ font-size:var(--text-xs); color:var(--text-faint); }
.ipr-field__err{ font-size:var(--text-xs); color:var(--danger); font-weight:var(--weight-medium); }

.ipr-input-wrap{ position:relative; display:flex; align-items:center; }
.ipr-input-wrap__icon{ position:absolute; left:13px; display:inline-flex;
  color:var(--text-faint); pointer-events:none; }
.ipr-input{
  width:100%; height:44px; padding:0 14px; font-family:var(--font-body);
  font-size:var(--text-sm); color:var(--text-strong);
  background:var(--surface-card); border:1px solid var(--border-default);
  border-radius:var(--radius-md); outline:none;
  transition:border-color var(--dur-base) var(--ease-out),
             box-shadow var(--dur-base) var(--ease-out);
}
.ipr-input::placeholder{ color:var(--text-faint); }
.ipr-input:hover{ border-color:var(--border-strong); }
.ipr-input:focus{ border-color:var(--brand); box-shadow:var(--focus-ring); }
.ipr-input--icon{ padding-left:40px; }
.ipr-input--err{ border-color:var(--danger); }
.ipr-input--err:focus{ box-shadow:0 0 0 3px rgba(220,38,38,.18); }
.ipr-input:disabled{ background:var(--surface-sunken); color:var(--text-faint); cursor:not-allowed; }
textarea.ipr-input{ height:auto; padding:11px 14px; resize:vertical; line-height:1.5; }
`;

function useInjectStyle(id: string, css: string) {
  React.useEffect(() => {
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id; s.textContent = css;
    document.head.appendChild(s);
  }, []);
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
  multiline?: boolean;
  rows?: number;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, hint, error, icon, id, multiline = false, rows = 4, className = "", style, ...props }, ref) {
    useInjectStyle("ipr-input-css", CSS);
    const autoId = React.useId();
    const fieldId = id || autoId;
    const inputCls = ["ipr-input", icon ? "ipr-input--icon" : "", error ? "ipr-input--err" : "", className].filter(Boolean).join(" ");

    return (
      <div className="ipr-field" style={style}>
        {label ? <label className="ipr-field__label" htmlFor={fieldId}>{label}</label> : null}
        <div className="ipr-input-wrap">
          {icon && !multiline ? <span className="ipr-input-wrap__icon" aria-hidden="true">{icon}</span> : null}
          {multiline ? (
            <textarea id={fieldId} className={inputCls} rows={rows} {...(props as any)} />
          ) : (
            <input id={fieldId} ref={ref} className={inputCls} {...props} />
          )}
        </div>
        {error ? <span className="ipr-field__err">{error}</span> : hint ? <span className="ipr-field__hint">{hint}</span> : null}
      </div>
    );
  }
);
