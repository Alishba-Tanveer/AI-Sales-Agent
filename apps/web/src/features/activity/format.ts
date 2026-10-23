import type { ActivityJob, ActivityTab } from "./types";

export function formatDuration(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return `${m}m ${String(rest).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** "Just now", "18 mins ago", "2 hours ago", "Yesterday", "3 days ago" or "Scheduled in 2h" for queued jobs. */
export function startedLabel(job: Pick<ActivityJob, "startedAt" | "scheduledFor">, now: number) {
  if (!job.startedAt) {
    if (!job.scheduledFor) return "Queued";
    const mins = Math.max(1, Math.round((new Date(job.scheduledFor).getTime() - now) / 60_000));
    return mins < 60 ? `Scheduled in ${mins}m` : `Scheduled in ${Math.round(mins / 60)}h`;
  }
  const secs = Math.max(0, Math.round((now - new Date(job.startedAt).getTime()) / 1000));
  if (secs < 45) return "Just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return mins === 1 ? "1 min ago" : `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

export const fullDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export const retriesLabel = (job: Pick<ActivityJob, "retries" | "maxRetries">) =>
  job.retries === 0 ? "0" : `${job.retries}/${job.maxRetries}`;

export function matchesTab(job: ActivityJob, tab: ActivityTab) {
  return tab === "all" || job.status === tab;
}

export function countByTab(jobs: ActivityJob[]): Record<ActivityTab, number> {
  return {
    all: jobs.length,
    running: jobs.filter((j) => j.status === "running").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    completed: jobs.filter((j) => j.status === "completed").length,
  };
}
