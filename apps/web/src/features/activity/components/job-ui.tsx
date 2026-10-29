import {
  Building2,
  CalendarClock,
  CircleAlert,
  Clock,
  Compass,
  Loader2,
  Mail,
  UserRound,
  RefreshCw,
  ScanSearch,
  Search,
  Send,
  Ban,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import type { ActivityJob, JobKind, JobStatus } from "../types";

export const KIND_ICON: Record<JobKind, LucideIcon> = {
  research: Search,
  draft: Mail,
  sync: RefreshCw,
  enrich: Building2,
  invite: Send,
  analyze: ScanSearch,
  discover: Compass,
  followup: CalendarClock,
  lead: UserRound,
};

/** One theme color per kind of task, shared by the Activity page and the Overview feed. */
export const KIND_TONE: Record<JobKind, string> = { research: "text-sky-500", draft: "text-violet-500", sync: "text-teal-500", enrich: "text-amber-500", invite: "text-pink-500", analyze: "text-indigo-500", discover: "text-emerald-500", followup: "text-orange-500", lead: "text-primary" };

/** Icon in front of the task name. Status wins over kind for running / failed / queued / cancelled. */
export function JobIcon({ job, className }: { job: Pick<ActivityJob, "kind" | "status">; className?: string }) {
  const base = cn("size-4 shrink-0", className);
  switch (job.status) {
    case "running":
      return <Loader2 className={cn(base, "animate-spin text-primary")} aria-hidden />;
    case "failed":
      return <CircleAlert className={cn(base, "text-destructive")} aria-hidden />;
    case "queued":
      return <Clock className={cn(base, "text-warning")} aria-hidden />;
    case "cancelled":
      return <Ban className={cn(base, "text-muted-foreground")} aria-hidden />;
    default: {
      const Icon = KIND_ICON[job.kind];
      return <Icon className={cn(base, KIND_TONE[job.kind])} aria-hidden />;
    }
  }
}

const STATUS: Record<JobStatus, { label: string; badge: string; dot: string }> = {
  completed: { label: "Completed", badge: "border-success/30 bg-success-soft text-success", dot: "bg-success" },
  running: { label: "Running", badge: "border-primary/30 bg-primary-soft text-primary", dot: "bg-primary motion-safe:animate-pulse" },
  failed: { label: "Failed", badge: "border-destructive/30 bg-destructive-soft text-destructive", dot: "bg-destructive" },
  queued: { label: "Queued", badge: "border-warning/30 bg-warning-soft text-warning", dot: "bg-warning" },
  cancelled: { label: "Cancelled", badge: "border-border bg-secondary text-muted-foreground", dot: "bg-muted-foreground" },
};

export const statusLabel = (s: JobStatus) => STATUS[s].label;

export function StatusPill({ status, className }: { status: JobStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold", s.badge, className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
