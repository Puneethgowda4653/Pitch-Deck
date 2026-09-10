import React from "react";

const CSS = `
.ipr-btn{
  --_h:42px; --_px:20px; --_fs:var(--text-sm);
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  height:var(--_h); padding:0 var(--_px); font-family:var(--font-display);
  font-size:var(--_fs); font-weight:var(--weight-bold);
  letter-spacing:-0.005em; line-height:1; white-space:nowrap;
  border-radius:var(--radius-md); border:1px solid transparent;
  cursor:pointer; user-select:none; text-decoration:none;
  transition:transform var(--dur-base) var(--ease-clay),
             box-shadow var(--dur-base) var(--ease-out),
             background var(--dur-base) var(--ease-out),
             color var(--dur-base) var(--ease-out),
             border-color var(--dur-base) var(--ease-out);
}
.ipr-btn:focus-visible{ outline:none; box-shadow:var(--clay-raise), var(--focus-ring); }
.ipr-btn[disabled]{ opacity:.45; cursor:not-allowed; transform:none; pointer-events:none; }

.ipr-btn--sm{ --_h:34px; --_px:14px; --_fs:var(--text-xs); border-radius:var(--radius-sm); }
.ipr-btn--lg{ --_h:52px; --_px:28px; --_fs:var(--text-base); border-radius:var(--radius-lg); }
.ipr-btn--block{ width:100%; }

/* CLAY - the primary action is the most physical thing on the page. */
.ipr-btn--primary{
  background:var(--clay-500); color:var(--text-on-brand);
  box-shadow:var(--clay-raise);
}
.ipr-btn--primary:hover:not([disabled]){
  background:var(--clay-400); transform:translateY(-1px);
  box-shadow:var(--clay-raise), var(--glow-brand);
}
.ipr-btn--primary:active:not([disabled]){ transform:translateY(1px); box-shadow:var(--clay-press); }

.ipr-btn--solid{ background:var(--clay-600); color:#FFF6F2; box-shadow:var(--clay-raise-sm); }
.ipr-btn--solid:hover:not([disabled]){ background:var(--clay-500); }
.ipr-btn--solid:active:not([disabled]){ transform:translateY(1px); box-shadow:var(--clay-press); }

/* GLASS - secondary contains rather than shouts. */
.ipr-btn--secondary{
  background:var(--glass-2); color:var(--text-strong);
  -webkit-backdrop-filter:var(--glass-blur); backdrop-filter:var(--glass-blur);
  border-color:var(--glass-edge); box-shadow:var(--glass-rim);
}
.ipr-btn--secondary:hover:not([disabled]){
  background:var(--glass-3); border-color:var(--glass-edge-hi);
}
.ipr-btn--secondary:active:not([disabled]){ transform:translateY(1px); }

/* FLAT - ghost informs, so it gets no surface at all until hovered. */
.ipr-btn--ghost{ background:transparent; color:var(--text-muted); }
.ipr-btn--ghost:hover:not([disabled]){ background:var(--surface-hover); color:var(--text-strong); }

.ipr-btn--danger{
  background:var(--danger-surface); color:var(--danger);
  border-color:var(--danger-border);
  -webkit-backdrop-filter:var(--glass-blur); backdrop-filter:var(--glass-blur);
}
.ipr-btn--danger:hover:not([disabled]){ background:rgba(255,118,108,.22); }

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
