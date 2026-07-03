// ── Job pipeline step definitions ────────────────────────────────────────────

export const JOB_STEP_ORDER = [
  "crawling",
  "extracting",
  "researching",
  "analyzing",
  "generating",
  "rendering",
  "uploading",
] as const;

export const JOB_STEP_LABELS: Record<string, string> = {
  crawling: "Crawling website",
  extracting: "Extracting brand identity",
  researching: "Researching market",
  analyzing: "Analyzing investor potential",
  generating: "Generating slide content",
  rendering: "Rendering presentation",
  uploading: "Finalizing & saving",
};
