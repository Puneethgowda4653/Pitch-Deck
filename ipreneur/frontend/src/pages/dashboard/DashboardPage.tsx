import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, FileText, Check, Sparkles, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

import { projectsApi } from "@/services/api/projects";
import { useCurrentUser } from "@/stores/authStore";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

const page: React.CSSProperties = { padding: "34px 38px 48px", maxWidth: 1180, margin: "0 auto" };
const header: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 26 };
const h1Style: React.CSSProperties = { font: "800 32px var(--font-display)", letterSpacing: "-0.03em", color: "var(--text-strong)", margin: 0 };
const subStyle: React.CSSProperties = { marginTop: 6, font: "400 14px var(--font-body)", color: "var(--text-muted)" };
const statsGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 26 };
const toolbar: React.CSSProperties = { marginBottom: 18 };
const cardGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 };
const skeletonGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 };

export default function DashboardPage() {
  const user = useCurrentUser();
  const [tab, setTab] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list({ pageSize: 20 }),
  });

  const projects = data?.data ?? [];
  const total = projects.length;
  const readyCount = projects.filter((p) => p.status === "ready").length;
  const activeCount = projects.filter((p) =>
    ["analyzing", "researching", "generating"].includes(p.status)
  ).length;

  const filtered = projects.filter((p) => {
    if (tab === "ready") return p.status === "ready";
    if (tab === "drafts")
      return p.status === "draft" || ["analyzing", "researching", "generating"].includes(p.status);
    return true;
  });

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div style={page}>
      {/* Header */}
      <div style={header}>
        <div>
          <h1 style={h1Style}>
            Good {getGreeting()},{" "}
            <span className="ipr-gradient-text">{firstName}</span>
          </h1>
          <p style={subStyle}>
            {total === 0
              ? "Create your first AI pitch deck to get started"
              : `You have ${total} pitch deck${total !== 1 ? "s" : ""} in your workspace`}
          </p>
        </div>
        <Link to="/projects/new" style={{ flexShrink: 0 }}>
          <Button variant="primary" size="lg" icon={<Plus size={16} />}>New Deck</Button>
        </Link>
      </div>

      {/* Stats */}
      <div style={statsGrid}>
        <StatCard icon={<FileText size={18} />} value={String(total)} label="Total decks" />
        <StatCard gradientIcon icon={<Check size={18} />} value={String(readyCount)} label="Ready to pitch" />
        <StatCard icon={<Sparkles size={18} />} value={String(activeCount)} label="In progress" />
        <StatCard icon={<TrendingUp size={18} />} value="$4.6M" label="Tracked ARR" />
      </div>

      {/* Tabs */}
      <div style={toolbar}>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "all", label: "All", count: total },
            { value: "ready", label: "Ready", count: readyCount },
            { value: "drafts", label: "Drafts", count: total - readyCount },
          ]}
        />
      </div>

      {/* Project grid */}
      {isLoading ? (
        <div style={skeletonGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={48} style={{ color: "var(--violet-400)" }} />}
          title="No pitch decks yet"
          description="Drop in a company URL and watch AI generate an investor-ready deck in minutes."
          action={
            <Link to="/projects/new">
              <Button variant="primary" icon={<Plus size={16} />}>Create First Deck</Button>
            </Link>
          }
        />
      ) : (
        <div style={cardGrid}>
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
