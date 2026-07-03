import { clsx } from "clsx";
import { CheckCircle2, Clock, Loader2, AlertCircle, FileEdit } from "lucide-react";

type ProjectStatus = "draft" | "analyzing" | "researching" | "generating" | "ready" | "error";

const statusConfig: Record<ProjectStatus, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: "Draft", color: "text-text-muted border-border", icon: FileEdit },
  analyzing: { label: "Analyzing", color: "text-info border-info/30", icon: Loader2 },
  researching: { label: "Researching", color: "text-warning border-warning/30", icon: Loader2 },
  generating: { label: "Generating", color: "text-violet border-violet/30", icon: Loader2 },
  ready: { label: "Ready", color: "text-success border-success/30", icon: CheckCircle2 },
  error: { label: "Error", color: "text-error border-error/30", icon: AlertCircle },
};

interface StatusBadgeProps {
  status: ProjectStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft;
  const Icon = config.icon;
  const isAnimated = ["analyzing", "researching", "generating"].includes(status);

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        config.color
      )}
    >
      <Icon className={clsx("w-3 h-3", isAnimated && "animate-spin")} />
      {config.label}
    </span>
  );
}
