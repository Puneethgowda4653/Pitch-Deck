import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Undo2 } from "lucide-react";
import toast from "react-hot-toast";

import { projectsApi } from "@/services/api/projects";
import { Button } from "@/components/ui/Button";
import { TemplatedDeckSection } from "@/components/workspace/deckTemplates/TemplatedDeckSection";
import type { TemplateDeckData } from "@/components/workspace/deckTemplates/types";
import type { EditPath } from "@/components/workspace/deckTemplates/editing/editableText";
import { setByPath } from "@/components/workspace/deckTemplates/editing/setByPath";

const ep = {
  topbar: { position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 28px", background: "rgba(255,255,255,0.82)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: "1px solid var(--border-subtle)" } as React.CSSProperties,
  topLeft: { display: "flex", alignItems: "center", gap: 16, minWidth: 0 } as React.CSSProperties,
  backLink: { display: "inline-flex", alignItems: "center", gap: 6, font: "500 13px var(--font-body)", color: "var(--text-muted)", textDecoration: "none" } as React.CSSProperties,
  divider: { width: 1, height: 18, background: "var(--border-default)", flexShrink: 0 } as React.CSSProperties,
  projName: { font: "700 14px var(--font-display)", color: "var(--text-strong)" } as React.CSSProperties,
  dirtyDot: { display: "inline-flex", alignItems: "center", gap: 6, font: "500 12px var(--font-body)", color: "var(--warning, #B45309)" } as React.CSSProperties,
  topActions: { display: "flex", gap: 10, flexShrink: 0, alignItems: "center" } as React.CSSProperties,
  body: { maxWidth: 1180, margin: "0 auto", padding: "28px 28px 50px" } as React.CSSProperties,
  notReady: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 12, textAlign: "center" } as React.CSSProperties,
};

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const [draft, setDraft] = useState<TemplateDeckData | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const originalRef = useRef<TemplateDeckData | null>(null);
  const seededRef = useRef(false);

  // Seed the draft once from the loaded project — guarded so a background
  // refetch (e.g. after saving) never clobbers in-progress edits.
  useEffect(() => {
    if (seededRef.current || !project) return;
    const td = (project.deckContent as any)?.templateData as TemplateDeckData | undefined;
    if (!td) return;
    setDraft(td);
    originalRef.current = td;
    seededRef.current = true;
  }, [project]);

  const handleEdit = useCallback((path: EditPath, value: string | number) => {
    setDraft((d) => (d ? setByPath(d, path, value) : d));
    setIsDirty(true);
  }, []);

  const handleDiscard = () => {
    if (originalRef.current) setDraft(originalRef.current);
    setIsDirty(false);
  };

  const saveMutation = useMutation({
    mutationFn: (next: TemplateDeckData) => projectsApi.update(projectId!, { templateData: next }),
    onSuccess: (_project, variables) => {
      originalRef.current = variables;
      setIsDirty(false);
      toast.success("Changes saved");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: () => toast.error("Couldn't save your edits — please try again"),
  });

  const { mutate: saveTemplate } = useMutation({
    mutationFn: (templateKey: string) => projectsApi.update(projectId!, { templateKey }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
    onError: () => toast.error("Couldn't save template choice"),
  });

  // Warn on tab close/refresh while there are unsaved edits. In-app navigation
  // guarding is limited to the back-link below — this app uses plain
  // BrowserRouter, not a data router, so useBlocker isn't available.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
      ev.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleBackClick = (ev: React.MouseEvent) => {
    if (isDirty && !window.confirm("You have unsaved changes. Leave without saving?")) {
      ev.preventDefault();
    }
  };

  if (isLoading || !project) {
    return <div style={ep.body}>Loading…</div>;
  }

  if (project.status !== "ready") {
    return (
      <div style={ep.body}>
        <div style={ep.notReady}>
          <p style={{ font: "600 15px var(--font-body)", color: "var(--text-strong)" }}>
            This deck isn't ready to edit yet
          </p>
          <p style={{ font: "400 13px var(--font-body)", color: "var(--text-muted)" }}>
            Generate the deck first, then come back here to edit its text.
          </p>
          <Link to={`/projects/${projectId}`}>
            <Button variant="secondary" icon={<ArrowLeft size={15} />}>Back to project</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div style={ep.body}>
        <div style={ep.notReady}>
          <p style={{ font: "600 15px var(--font-body)", color: "var(--text-strong)" }}>
            Nothing to edit here
          </p>
          <p style={{ font: "400 13px var(--font-body)", color: "var(--text-muted)" }}>
            This deck doesn't have the richer template data this editor needs.
          </p>
          <Link to={`/projects/${projectId}`}>
            <Button variant="secondary" icon={<ArrowLeft size={15} />}>Back to project</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--surface-page)", minHeight: "100vh" }}>
      <div style={ep.topbar}>
        <div style={ep.topLeft}>
          <Link to={`/projects/${projectId}`} onClick={handleBackClick} style={ep.backLink}>
            <ArrowLeft size={15} /> {project.name}
          </Link>
          <span style={ep.divider} />
          <span style={{ font: "500 13px var(--font-body)", color: "var(--text-muted)" }}>Editing deck text</span>
          {isDirty && (
            <span style={ep.dirtyDot}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
              Unsaved changes
            </span>
          )}
        </div>
        <div style={ep.topActions}>
          <Button variant="secondary" icon={<Undo2 size={15} />} disabled={!isDirty} onClick={handleDiscard}>
            Discard
          </Button>
          <Button
            variant="primary"
            icon={<Check size={15} />}
            disabled={!isDirty}
            loading={saveMutation.isPending}
            onClick={() => draft && saveMutation.mutate(draft)}
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div style={ep.body}>
        <TemplatedDeckSection
          data={draft}
          initialKey={(project as any).templateKey}
          assets={(project as any).assets}
          onPersist={(key) => saveTemplate(key)}
          editable
          onEdit={handleEdit}
        />
      </div>
    </div>
  );
}
