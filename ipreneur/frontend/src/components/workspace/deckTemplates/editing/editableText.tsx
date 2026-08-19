/**
 * Editability markers for TemplatedDeck.tsx's text nodes.
 *
 * `editableText`/`editableSvgText` are drop-in replacements for a plain
 * string child — in view mode (X.editable === false) they return the exact
 * same string, so every existing call site that doesn't pass an EditCtx
 * (theme thumbnails, exportDeck.ts's PNG capture) is byte-identical to
 * before. In edit mode they render a clickable marker that calls
 * X.onActivate(path, value) — the actual input UI lives in
 * FloatingTextEditor.tsx, positioned over whichever marker is active.
 *
 * The marker itself stays mounted but hidden while active (visibility, not
 * display: none) so its on-screen position/size remains measurable for the
 * floating editor to anchor against.
 */
import * as React from "react";

export type EditPath = (string | number)[];

export interface ActivateOptions {
  multiline?: boolean;
  numeric?: boolean;
}

export interface ActiveEdit extends ActivateOptions {
  key: string;
  path: EditPath;
  value: string;
}

export interface EditCtx {
  editable: boolean;
  active: ActiveEdit | null;
  onActivate: (path: EditPath, value: string | number, opts?: ActivateOptions) => void;
}

export const VIEW_CTX: EditCtx = {
  editable: false,
  active: null,
  onActivate: () => {},
};

export function pathKey(path: EditPath): string {
  return path.join(".");
}

/** Editable text for plain HTML/DOM slide content. */
export function editableText(
  value: string,
  path: EditPath,
  X: EditCtx,
  opts?: ActivateOptions
): React.ReactNode {
  if (!X.editable) return value;
  const key = pathKey(path);
  const isActive = X.active?.key === key;
  return React.createElement(
    "span",
    {
      key: "et",
      "data-edit-path": key,
      className: "ipr-edit-target",
      onClick: (ev: React.MouseEvent) => {
        ev.stopPropagation();
        X.onActivate(path, value, opts);
      },
      style: {
        cursor: "text",
        visibility: isActive ? "hidden" : undefined,
      } as React.CSSProperties,
    },
    value || " "
  );
}

/** Editable text for SVG <text> content — uses <tspan>, which (like <text>)
 * implements SVGGraphicsElement, so the same click + rect-measurement
 * approach in FloatingTextEditor works unchanged. */
export function editableSvgText(
  value: string,
  path: EditPath,
  X: EditCtx,
  opts?: ActivateOptions,
  key?: string
): React.ReactNode {
  if (!X.editable) return value;
  const pKey = pathKey(path);
  const isActive = X.active?.key === pKey;
  return React.createElement(
    "tspan",
    {
      key: key ?? "et",
      "data-edit-path": pKey,
      onClick: (ev: React.MouseEvent) => {
        ev.stopPropagation();
        X.onActivate(path, value, opts);
      },
      style: {
        cursor: "text",
        visibility: isActive ? "hidden" : undefined,
      } as React.CSSProperties,
    },
    value
  );
}
