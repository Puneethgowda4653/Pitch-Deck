import React from "react";

const CSS = `
.ipr-field{ display:flex; flex-direction:column; gap:8px; }
.ipr-field__label{ font-family:var(--font-display); font-size:var(--text-sm);
  font-weight:var(--weight-semibold); color:var(--text-strong); letter-spacing:-0.01em; }
.ipr-field__hint{ font-size:var(--text-xs); color:var(--text-faint); }
.ipr-field__err{ font-size:var(--text-xs); color:var(--danger); font-weight:var(--weight-medium); }

.ipr-input-wrap{ position:relative; display:flex; align-items:center; }
.ipr-input-wrap__icon{ position:absolute; left:15px; display:inline-flex;
  color:var(--text-faint); pointer-events:none; }
/* Fields are pressed INTO the surface — the inverse of a clay button. */
.ipr-input{
  width:100%; height:48px; padding:0 16px; font-family:var(--font-body);
  font-size:var(--text-sm); color:var(--text-strong);
  background:var(--surface-sunken); border:1px solid var(--glass-edge);
  border-radius:var(--radius-md); outline:none;
  box-shadow:var(--clay-inset);
  transition:border-color var(--dur-base) var(--ease-out),
             box-shadow var(--dur-base) var(--ease-out),
             background var(--dur-base) var(--ease-out);
}
.ipr-input::placeholder{ color:var(--text-faint); }
.ipr-input:hover{ border-color:var(--border-strong); }
.ipr-input:focus{ border-color:var(--border-brand); box-shadow:var(--clay-inset), var(--focus-ring); }
.ipr-input--icon{ padding-left:44px; }
.ipr-input--err{ border-color:var(--danger); }
.ipr-input--err:focus{ box-shadow:var(--clay-inset), 0 0 0 3px rgba(255,118,108,.24); }
.ipr-input:disabled{ opacity:.5; cursor:not-allowed; }
textarea.ipr-input{ height:auto; padding:13px 16px; resize:vertical; line-height:1.55; }
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

export const Input = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
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
            <textarea id={fieldId} ref={ref as React.Ref<HTMLTextAreaElement>} className={inputCls} rows={rows} {...(props as any)} />
          ) : (
            <input id={fieldId} ref={ref as React.Ref<HTMLInputElement>} className={inputCls} {...props} />
          )}
        </div>
        {error ? <span className="ipr-field__err">{error}</span> : hint ? <span className="ipr-field__hint">{hint}</span> : null}
      </div>
    );
  }
);
