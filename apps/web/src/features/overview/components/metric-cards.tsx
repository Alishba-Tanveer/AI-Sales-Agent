import { cn } from "cn";
import { formatDelta, formatNumber } from "../format";
import type { OverviewMetrics } from "../types";

type Tone = "default" | "success" | "warning" | "destructive" | "muted";

const toneText: Record<Tone, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
};

function deltaTone(n: number): Tone {
  return n > 0 ? "success" : n < 0 ? "destructive" : "muted";
}

function MetricCard({
  label,
  value,
  valueTone = "default",
  note,
  noteTone,
}: {
  label: string;
  value: string;
  valueTone?: Tone;
  note: string;
  noteTone: Tone;
}) {
  return (
    <div className="group flex cursor-default flex-col justify-between rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 motion-safe:hover:-translate-y-1">
      <span className="text-sm font-medium text-muted-foreground transition-colors duration-200 group-hover:text-foreground">
        {label}
      </span>
      <div className="mt-3">
        <div
          className={cn(
            "origin-left text-3xl font-semibold tracking-tight transition-transform duration-200 motion-safe:group-hover:scale-105",
            toneText[valueTone],
          )}
        >{value}</div>
        <div className={cn("mt-1 text-xs font-medium", toneText[noteTone])}>{note}</div>
      </div>
    </div>
  );
}

export function MetricCards({ metrics }: { metrics: OverviewMetrics }) {
  return (
    <section className="flex flex-col gap-2" aria-label="Key metrics">
      <div className="flex justify-end pr-0.5">
        <span className="text-xs text-muted-foreground">Period: Last 30 days</span>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Leads"
          value={formatNumber(metrics.totalLeads)}
          note={formatDelta(metrics.totalLeadsDelta, "from last month")}
          noteTone={deltaTone(metrics.totalLeadsDelta)}
        />
        <MetricCard
          label="New This Week"
          value={formatNumber(metrics.newThisWeek)}
          note={formatDelta(metrics.newThisWeekDelta, "vs previous week")}
          noteTone={deltaTone(metrics.newThisWeekDelta)}
        />
        <MetricCard
          label="Pending Approvals"
          value={formatNumber(metrics.pendingApprovals)}
          valueTone={metrics.pendingApprovals > 0 ? "warning" : "default"}
          note={metrics.pendingApprovals > 0 ? "Action required" : "All clear"}
          noteTone={metrics.pendingApprovals > 0 ? "warning" : "muted"}
        />
        <MetricCard
          label="Replies"
          value={formatNumber(metrics.replies)}
          note={`${metrics.replyRate.toFixed(1)}% reply rate`}
          noteTone="muted"
        />
      </div>
    </section>
  );
}
