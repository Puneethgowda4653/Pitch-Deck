/**
 * Pixel-exact PPTX export for the templated deck.
 *
 * The on-screen preview (TemplatedDeck) and the download used to be two
 * completely different renderers, so the exported file never matched the
 * theme/layout the user saw. This exporter removes that gap: it renders the
 * SAME `renderSlide(theme, data, i)` output the preview uses, at its native
 * 1280×720, captures each slide to a PNG, and drops those images full-bleed
 * onto 16:9 PPTX slides. The result is byte-for-byte what the user previewed.
 *
 * Trade-off: slides are images (not editable text in PowerPoint) — that is the
 * cost of guaranteeing an exact visual match.
 */
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import PptxGenJS from "pptxgenjs";

import { Theme, ensureDeckFonts } from "./themes";
import { TemplateDeckData, DECK_SLIDE_ORDER } from "./types";
import { renderSlide } from "./TemplatedDeck";

const SLIDE_W = 1280;
const SLIDE_H = 720;
// 16:9 in inches — matches 1280×720 exactly, so images map without distortion.
const PPTX_W = 13.333;
const PPTX_H = 7.5;

async function fontsReady(): Promise<void> {
  const fonts = (document as unknown as { fonts?: FontFaceSet }).fonts;
  if (fonts?.ready) {
    try {
      await fonts.ready;
    } catch {
      /* fonts.ready never rejects in practice; ignore just in case */
    }
  }
}

/** Wait for two animation frames so React has committed and the browser painted. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

/**
 * Render every deck slide off-screen, capture each as a PNG, and build a PPTX
 * whose slides are those exact images. Triggers a browser download.
 */
export async function exportTemplatedDeckToPptx(
  data: TemplateDeckData,
  theme: Theme,
  fileName: string
): Promise<void> {
  ensureDeckFonts();
  await fontsReady();

  // Off-screen host holding full-size slides. Positioned far off-screen (not
  // display:none) so it lays out and paints for an accurate capture.
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-100000px;top:0;width:" +
    SLIDE_W +
    "px;pointer-events:none;z-index:-1;";
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    const count = DECK_SLIDE_ORDER.length;
    root.render(
      createElement(
        "div",
        null,
        Array.from({ length: count }, (_, i) =>
          createElement(
            "div",
            {
              key: i,
              "data-slide": String(i),
              style: {
                width: SLIDE_W,
                height: SLIDE_H,
                overflow: "hidden",
                background: theme.bg,
              },
            },
            renderSlide(theme, data, i)
          )
        )
      )
    );

    await nextPaint();
    await fontsReady();

    const nodes = Array.from(
      host.querySelectorAll<HTMLElement>("[data-slide]")
    );

    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: "DECK_16x9", width: PPTX_W, height: PPTX_H });
    pptx.layout = "DECK_16x9";
    const bgColor = theme.bg.replace("#", "");

    for (const node of nodes) {
      const dataUrl = await toPng(node, {
        width: SLIDE_W,
        height: SLIDE_H,
        pixelRatio: 2, // 2× for crisp text at presentation scale
        cacheBust: true,
        backgroundColor: theme.bg,
      });
      const slide = pptx.addSlide();
      slide.background = { color: bgColor };
      slide.addImage({ data: dataUrl, x: 0, y: 0, w: PPTX_W, h: PPTX_H });
    }

    const name = fileName.toLowerCase().endsWith(".pptx")
      ? fileName
      : `${fileName}.pptx`;
    await pptx.writeFile({ fileName: name });
  } finally {
    root.unmount();
    host.remove();
  }
}
