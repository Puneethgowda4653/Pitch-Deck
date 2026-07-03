import { Check, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import type { JobProgress } from "@/types";
import { JOB_STEP_ORDER, JOB_STEP_LABELS } from "@/constants";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface Props {
  progress: JobProgress;
}

const s = {
  card: { background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)", padding: 26 } as React.CSSProperties,
  head: { display: "flex", alignItems: "center", gap: 13, marginBottom: 22 } as React.CSSProperties,
  mark: { width: 38, height: 38, borderRadius: "var(--radius-md)", background: "var(--grad-brand)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0, boxShadow: "var(--glow-brand)" } as React.CSSProperties,
  title: { font: "700 17px var(--font-display)", color: "var(--text-strong)" } as React.CSSProperties,
  sub: { marginTop: 3, font: "400 13px var(--font-body)", color: "var(--text-muted)" } as React.CSSProperties,
  steps: { display: "flex", flexDirection: "column", gap: 6, marginTop: 24 } as React.CSSProperties,
  step: (cur: boolean, pend: boolean): React.CSSProperties => ({ display: "flex", alignItems: "center", gap: 14, padding: "10px 13px", borderRadius: "var(--radius-md)", border: "1px solid transparent", transition: "var(--transition)", opacity: pend ? 0.4 : 1, ...(cur ? { background: "var(--surface-sunken)", borderColor: "var(--border-subtle)" } : {}) }),
  icon: (done: boolean, cur: boolean): React.CSSProperties => ({ width: 26, height: 26, borderRadius: 99, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...(done ? { background: "var(--success-surface)", color: "var(--green-600)" } : cur ? { background: "var(--grad-brand)", color: "#fff" } : { background: "var(--surface-sunken)", color: "var(--text-faint)", border: "1px solid var(--border-subtle)" }) }),
  label: (cur: boolean): React.CSSProperties => ({ flex: 1, font: `${cur ? 600 : 500} 14px var(--font-body)`, color: cur ? "var(--text-strong)" : "var(--text-muted)" }),
  statusDone: { font: "500 12px var(--font-body)", color: "var(--green-600)" } as React.CSSProperties,
  statusCur: { font: "500 12px var(--font-mono)", color: "var(--text-brand)" } as React.CSSProperties,
  errBox: { display: "flex", alignItems: "flex-start", gap: 10, marginTop: 20, background: "var(--danger-surface)", border: "1px solid rgba(220,38,38,.2)", borderRadius: "var(--radius-md)", padding: "12px 14px" } as React.CSSProperties,
};

export function AnalysisProgress({ progress }: Props) {
  const currentStepIndex = JOB_STEP_ORDER.indexOf(
    (progress.currentStep ?? progress.current_step) as any
  );
  const totalPct = progress.totalProgress ?? progress.total_progress ?? 0;
  const stepPct = progress.stepProgress ?? progress.step_progress ?? 0;

  return (
    <div style={s.card}>
      <div style={s.head}>
        <span style={s.mark}><Sparkles size={18} /></span>
        <div>
          <div style={s.title}>AI analysis in progress</div>
          <div style={s.sub}>{progress.message || (JOB_STEP_ORDER[currentStepIndex] ? JOB_STEP_LABELS[JOB_STEP_ORDER[currentStepIndex]] + "…" : "Starting…")}</div>
        </div>
      </div>

      <ProgressBar value={totalPct} label="Overall progress" showValue animated />

      <div style={s.steps}>
        {JOB_STEP_ORDER.map((step, i) => {
          const done = i < currentStepIndex;
          const cur = i === currentStepIndex;
          const pend = i > currentStepIndex;
          return (
            <div key={step} style={s.step(cur, pend)}>
              <span style={s.icon(done, cur)}>
                {done ? <Check size={13} /> : cur ? <Loader2 size={13} className="animate-spin" /> : <span style={{ font: "600 11px var(--font-mono)" }}>{i + 1}</span>}
              </span>
              <span style={s.label(cur)}>{JOB_STEP_LABELS[step]}</span>
              {done && <span style={s.statusDone}>Done</span>}
              {cur && stepPct > 0 && <span style={s.statusCur}>{stepPct}%</span>}
              {cur && stepPct === 0 && <span style={s.statusCur}>Working…</span>}
            </div>
          );
        })}
      </div>

      {progress.status === "failed" && progress.error && (
        <div style={s.errBox}>
          <AlertCircle size={15} style={{ color: "var(--red-600)", flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ font: "600 13px var(--font-body)", color: "var(--red-600)" }}>Analysis failed</p>
            <p style={{ font: "400 12px var(--font-body)", color: "var(--text-muted)", marginTop: 3 }}>{progress.error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
