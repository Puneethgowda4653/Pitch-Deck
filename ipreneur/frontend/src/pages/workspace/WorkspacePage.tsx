import { useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Play, Download, Edit3, RefreshCw, Loader2, AlertCircle, KeyRound, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

import { projectsApi } from "@/services/api/projects";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { AnalysisProgress } from "@/components/workspace/AnalysisProgress";
import { DeckPreview } from "@/components/workspace/DeckPreview";
import { TemplatedDeckSection } from "@/components/workspace/deckTemplates/TemplatedDeckSection";
import type { TemplateDeckData } from "@/components/workspace/deckTemplates/types";
import { BrandingPanel } from "@/components/workspace/BrandingPanel";
import type { Project } from "@/types";

const POLLING_MS = 3000;
const ACTIVE = new Set(["analyzing", "researching", "generating"]);

const statusTone: Record<string, BadgeTone> = {
  ready: "success",
  generating: "warning",
  analyzing: "warning",
  researching: "warning",
  draft: "neutral",
  error: "danger",
};
const statusLabel: Record<string, string> = {
  ready: "Ready",
  generating: "Generating",
  analyzing: "Analyzing",
  researching: "Researching",
  draft: "Draft",
  error: "Error",
};

const ws = {
  topbar: { position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 28px", background: "rgba(255,255,255,0.82)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: "1px solid var(--border-subtle)" } as React.CSSProperties,
  topLeft: { display: "flex", alignItems: "center", gap: 16, minWidth: 0 } as React.CSSProperties,
  backLink: { display: "inline-flex", alignItems: "center", gap: 6, font: "500 13px var(--font-body)", color: "var(--text-muted)", textDecoration: "none" } as React.CSSProperties,
  divider: { width: 1, height: 18, background: "var(--border-default)", flexShrink: 0 } as React.CSSProperties,
  projName: { font: "700 14px var(--font-display)", color: "var(--text-strong)" } as React.CSSProperties,
  projUrl: { font: "400 12px var(--font-body)", color: "var(--text-faint)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const } as React.CSSProperties,
  body: { display: "grid", gridTemplateColumns: "300px 1fr", gap: 26, maxWidth: 1180, margin: "0 auto", padding: "28px 28px 50px" } as React.CSSProperties,
  topActions: { display: "flex", gap: 10, flexShrink: 0 } as React.CSSProperties,
};

export default function WorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();

  const projectQuery: UseQueryResult<Project, Error> = useQuery<Project, Error>({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId!),
    refetchInterval: (q) => (ACTIVE.has((q.state.data as Project)?.status ?? "") ? POLLING_MS : false),
    enabled: !!projectId,
  });
  const project = projectQuery.data;

  const { data: jobStatus } = useQuery({
    queryKey: ["project-status", projectId],
    queryFn: () => projectsApi.getStatus(projectId!),
    refetchInterval: ACTIVE.has(project?.status ?? "") ? POLLING_MS : false,
    enabled: !!projectId && ACTIVE.has(project?.status ?? ""),
  });

  const { mutate: triggerAnalysis, isPending: isTriggering } = useMutation({
    mutationFn: () => projectsApi.analyze(projectId!),
    onSuccess: () => {
      toast.success("Analysis started — this takes about 2 minutes");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Failed to start analysis");
    },
  });

  const { mutate: saveTemplate } = useMutation({
    mutationFn: (templateKey: string) => projectsApi.update(projectId!, { templateKey }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
    onError: () => toast.error("Couldn't save template choice"),
  });

  // Templated decks export client-side (pixel-exact to the previewed theme);
  // TemplatedDeckSection registers its theme-aware exporter here. Non-templated
  // decks fall back to the backend PPTX render.
  const templatedExportRef = useRef<null | (() => Promise<void>)>(null);
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async () => {
    if (!projectId) return;
    setIsExporting(true);
    try {
      if (templatedExportRef.current) {
        await templatedExportRef.current();
      } else {
        const blob = await projectsApi.export(projectId, "pptx");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${project?.name ?? "pitch-deck"}.pptx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      toast.error("Export failed — please try again");
    } finally {
      setIsExporting(false);
    }
  };

  const isActive = ACTIVE.has(project?.status ?? "");
  const isReady = project?.status === "ready";
  const isDraft = project?.status === "draft";
  const isError = project?.status === "error";

  return (
    <div style={{ background: "var(--surface-page)", minHeight: "100vh" }}>
      {/* Topbar */}
      <div style={ws.topbar}>
        <div style={ws.topLeft}>
          <Link to="/dashboard" style={ws.backLink}>
            <ArrowLeft size={15} /> Dashboard
          </Link>
          <span style={ws.divider} />
          <div style={{ minWidth: 0 }}>
            <div style={ws.projName}>{project?.name || "Loading…"}</div>
            <div style={ws.projUrl}>{project?.companyUrl ?? project?.company_url ?? "No website — idea stage"}</div>
          </div>
          {project && (
            <Badge tone={statusTone[project.status] ?? "neutral"} dot>
              {statusLabel[project.status] ?? project.status}
            </Badge>
          )}
        </div>
        <div style={ws.topActions}>
          {isDraft && (
            <Button variant="primary" onClick={() => triggerAnalysis()} loading={isTriggering} icon={<Play size={15} />}>
              Generate Deck
            </Button>
          )}
          {isError && (
            <Button variant="secondary" onClick={() => triggerAnalysis()} loading={isTriggering} icon={<RefreshCw size={15} />}>
              Retry
            </Button>
          )}
          {isReady && (
            <>
              <Link to={`/projects/${projectId}/editor`}>
                <Button variant="secondary" icon={<Edit3 size={15} />}>Edit Deck</Button>
              </Link>
              <Button variant="primary" icon={<Download size={15} />} onClick={handleExport} loading={isExporting}>
                {isExporting ? "Exporting…" : "Export PPTX"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={ws.body}>
        <aside>
          {project?.brandingData && <BrandingPanel branding={project.brandingData} project={project} />}
        </aside>

        <main style={{ minWidth: 0 }}>
          <AnimatePresence mode="wait">
            {isActive && jobStatus && (
              <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <AnalysisProgress progress={jobStatus} />
              </motion.div>
            )}
            {isActive && !jobStatus && (
              <motion.div key="starting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 380 }}>
                <Loader2 size={32} style={{ color: "var(--violet-500)", marginBottom: 14 }} className="animate-spin" />
                <p style={{ font: "500 14px var(--font-body)", color: "var(--text-strong)" }}>Starting analysis…</p>
                <p style={{ font: "400 13px var(--font-body)", color: "var(--text-muted)", marginTop: 5 }}>This takes about 2 minutes</p>
              </motion.div>
            )}
            {isError && (() => {
              const errMsg = project?.errorMessage ?? project?.error_message ?? "";
              const isQuota = errMsg.includes("QUOTA_EXCEEDED") || errMsg.includes("quota") || errMsg.includes("429");
              return isQuota ? (
                <motion.div key="quota" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ border: "1px solid rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.04)", borderRadius: "var(--radius-lg)", padding: 28 }}>
                  <div style={{ display: "flex", gap: 16 }}>
                    <span style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: "rgba(245,158,11,0.12)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <KeyRound size={20} style={{ color: "#f59e0b" }} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <h2 style={{ font: "700 16px var(--font-display)", color: "#b45309", marginBottom: 6 }}>Gemini API Quota Exceeded</h2>
                      <p style={{ font: "400 13px var(--font-body)", color: "var(--text-muted)", marginBottom: 16 }}>
                        Your Gemini API key has hit the free-tier daily limit (20 requests/day) for gemini-2.5-flash. The quota resets every 24 hours.
                      </p>
                      <div style={{ display: "flex", gap: 10 }}>
                        <Button variant="secondary" onClick={() => triggerAnalysis()} loading={isTriggering} icon={<RefreshCw size={14} />}>Retry Analysis</Button>
                        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", height: 36, borderRadius: "var(--radius-md)", border: "1px solid rgba(245,158,11,0.4)", font: "500 13px var(--font-body)", color: "#b45309", textDecoration: "none" }}>
                          <ExternalLink size={14} /> Get a new API key
                        </a>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ border: "1px solid var(--danger-border, rgba(220,38,38,.25))", background: "var(--danger-surface)", borderRadius: "var(--radius-lg)", padding: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <AlertCircle size={18} style={{ color: "var(--red-600)" }} />
                    <h2 style={{ font: "600 15px var(--font-display)", color: "var(--text-strong)" }}>Project generation failed</h2>
                  </div>
                  <p style={{ font: "400 13px var(--font-body)", color: "var(--text-muted)", marginBottom: 16 }}>
                    {errMsg || "An unknown error occurred during analysis."}
                  </p>
                  <Button variant="secondary" onClick={() => triggerAnalysis()} loading={isTriggering} icon={<RefreshCw size={14} />}>Retry Analysis</Button>
                </motion.div>
              );
            })()}
            {isReady && project?.deckContent && (
              <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                {(project.deckContent as any).templateData ? (
                  <TemplatedDeckSection
                    data={(project.deckContent as any).templateData as TemplateDeckData}
                    initialKey={(project as any).templateKey}
                    assets={(project as any).assets}
                    onPersist={(key) => saveTemplate(key)}
                    fileName={project?.name ?? "pitch-deck"}
                    registerExport={(fn) => { templatedExportRef.current = fn; }}
                  />
                ) : (
                  <DeckPreview deckContent={project.deckContent} branding={project.brandingData} />
                )}
              </motion.div>
            )}
            {isDraft && !isTriggering && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 380, border: "1.5px dashed var(--border-default)", borderRadius: "var(--radius-lg)" }}>
                <p style={{ font: "500 14px var(--font-body)", color: "var(--text-strong)" }}>Ready to generate</p>
                <p style={{ font: "400 12px var(--font-body)", color: "var(--text-muted)", marginTop: 5 }}>Click "Generate Deck" above to start AI analysis</p>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
