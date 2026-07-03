import type { ReactNode } from "react";
import { StatCard } from "@/components/ui/StatCard";

interface Stat {
  label: string;
  value: string;
  icon: ReactNode;
  gradientIcon?: boolean;
}

interface StatsBarProps {
  stats: Stat[];
}

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
      {stats.map(({ label, value, icon, gradientIcon }, i) => (
        <StatCard key={i} icon={icon} value={value} label={label} gradientIcon={gradientIcon} />
      ))}
    </div>
  );
}
