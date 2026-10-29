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
    <div className="group flex h-full min-w-0 cursor-default items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-5 transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 motion-safe:hover:-translate-y-1">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-medium text-muted-foreground transition-colors duration-200 group-hover:text-foreground">
          {label}
        </span>
        <span className={cn("text-xs font-medium", toneText[noteTone])}>{note}</span>
      </div>
      <span
        className={cn(
          "origin-right shrink-0 text-3xl font-semibold leading-none tracking-tight tabular-nums transition-transform duration-200 motion-safe:group-hover:scale-105",
          toneText[valueTone],
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function MetricCards({ metrics }: { metrics: OverviewMetrics }) {
  return (
    <section className="flex flex-col gap-3" aria-label="Key metrics">
      <div className="flex items-center justify-end">
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Period: Last 30 days</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
