import React from "react";

const CSS = `
.ipr-avatar{
  display:inline-flex; align-items:center; justify-content:center;
  flex-shrink:0; overflow:hidden;
  font-family:var(--font-body); font-weight:var(--weight-semibold);
  background:var(--violet-100); color:var(--violet-700);
  border-radius:50%;
}
.ipr-avatar--square{ border-radius:var(--radius-md); }
.ipr-avatar--sm{ width:28px; height:28px; font-size:var(--text-xs); }
.ipr-avatar--md{ width:36px; height:36px; font-size:var(--text-sm); }
.ipr-avatar--lg{ width:46px; height:46px; font-size:var(--text-base); }
.ipr-avatar img{ width:100%; height:100%; object-fit:cover; }
`;

function useInjectStyle(id: string, css: string) {
  React.useEffect(() => {
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id; s.textContent = css;
    document.head.appendChild(s);
  }, []);
}

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  square?: boolean;
  src?: string;
}

export function Avatar({ name, size = "md", square = false, src }: AvatarProps) {
  useInjectStyle("ipr-avatar-css", CSS);
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const cls = [
    "ipr-avatar",
    `ipr-avatar--${size}`,
    square ? "ipr-avatar--square" : "",
  ].filter(Boolean).join(" ");

  return (
    <span className={cls} aria-label={name}>
      {src ? <img src={src} alt={name} /> : initials}
    </span>
  );
}
