import React from "react";

const CSS = `
.ipr-btn{
  --_h:40px; --_px:18px; --_fs:var(--text-sm);
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  height:var(--_h); padding:0 var(--_px); font-family:var(--font-body);
  font-size:var(--_fs); font-weight:var(--weight-semibold);
  letter-spacing:-0.005em; line-height:1; white-space:nowrap;
  border-radius:var(--radius-md); border:1px solid transparent;
  cursor:pointer; user-select:none; text-decoration:none;
  transition:transform var(--dur-fast) var(--ease-out),
             box-shadow var(--dur-base) var(--ease-out),
             background var(--dur-base) var(--ease-out),
             color var(--dur-base) var(--ease-out),
             border-color var(--dur-base) var(--ease-out);
}
.ipr-btn:focus-visible{ outline:none; box-shadow:var(--focus-ring); }
.ipr-btn:active{ transform:translateY(1px); }
.ipr-btn[disabled]{ opacity:.5; cursor:not-allowed; transform:none; pointer-events:none; }

.ipr-btn--sm{ --_h:32px; --_px:13px; --_fs:var(--text-xs); border-radius:var(--radius-sm); }
.ipr-btn--lg{ --_h:48px; --_px:24px; --_fs:var(--text-base); border-radius:var(--radius-lg); }
.ipr-btn--block{ width:100%; }

.ipr-btn--primary{ background:var(--grad-brand); color:var(--text-on-brand); box-shadow:var(--glow-brand); }
.ipr-btn--primary:hover:not([disabled]){ box-shadow:0 10px 30px rgba(123,44,191,.40); filter:saturate(1.05); }

.ipr-btn--solid{ background:var(--brand); color:var(--text-on-brand); }
.ipr-btn--solid:hover:not([disabled]){ background:var(--brand-hover); }

.ipr-btn--secondary{ background:var(--surface-card); color:var(--text-body);
  border-color:var(--border-default); box-shadow:var(--shadow-xs); }
.ipr-btn--secondary:hover:not([disabled]){ border-color:var(--border-strong); color:var(--text-strong); background:var(--surface-hover); }

.ipr-btn--ghost{ background:transparent; color:var(--text-body); }
.ipr-btn--ghost:hover:not([disabled]){ background:var(--surface-brand); color:var(--text-brand); }

.ipr-btn--danger{ background:var(--danger-surface); color:var(--danger); border-color:rgba(220,38,38,.22); }
.ipr-btn--danger:hover:not([disabled]){ background:#fbdada; }

.ipr-btn__spin{ width:15px; height:15px; border-radius:50%;
  border:2px solid currentColor; border-top-color:transparent;
  animation:ipr-btn-spin .6s linear infinite; }
@keyframes ipr-btn-spin{ to{ transform:rotate(360deg); } }
`;

function useInjectStyle(id: string, css: string) {
  React.useEffect(() => {
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = css;
    document.head.appendChild(s);
  }, []);
}

export type ButtonVariant = "primary" | "solid" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  loading = false,
  fullWidth = false,
  disabled = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  useInjectStyle("ipr-btn-css", CSS);
  const cls = [
    "ipr-btn",
    `ipr-btn--${variant}`,
    size !== "md" ? `ipr-btn--${size}` : "",
    fullWidth ? "ipr-btn--block" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button className={cls} disabled={disabled || loading} {...props}>
      {loading ? (
        <span className="ipr-btn__spin" aria-hidden="true" />
      ) : icon ? (
        <span style={{ display: "inline-flex" }} aria-hidden="true">{icon}</span>
      ) : null}
      {children ? <span>{children}</span> : null}
      {!loading && iconRight ? (
        <span style={{ display: "inline-flex" }} aria-hidden="true">{iconRight}</span>
      ) : null}
    </button>
  );
}

// Keep forwardRef export for back-compat with any existing ref usage
Button.displayName = "Button";
