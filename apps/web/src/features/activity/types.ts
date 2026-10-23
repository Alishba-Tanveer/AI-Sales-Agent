export type JobStatus = "completed" | "running" | "failed" | "queued" | "cancelled";

export type JobKind = "research" | "draft" | "sync" | "enrich" | "invite" | "analyze" | "discover" | "followup";

export type AgentName = "General Agent" | "LinkedIn Agent";

/** Tabs on the Activity page. Queued and cancelled jobs only show under "All". */
export type ActivityTab = "all" | "running" | "failed" | "completed";

/**
 * One background job the AI agent ran (or will run).
 * Proposed backend contract:  GET /api/activity  ->  { data: ActivityJob[] }  (newest first)
 */
export type ActivityJob = {
  id: string;
  kind: JobKind;
  /** "Research lead: Daniel Hughes" */
  title: string;
  /** Lead the job belongs to. `name` is null for jobs that are not about one person (syncs, discovery runs). */
  lead: { id: string | null; name: string | null; context: string };
  agent: AgentName;
  status: JobStatus;
  /** ISO. null while queued. */
  startedAt: string | null;
  /** ISO. Only for queued jobs that are scheduled for later. */
  scheduledFor: string | null;
  /** seconds. null while queued, and for running jobs (the page counts up from startedAt). */
  durationSec: number | null;
  retries: number;
  maxRetries: number;
  /** What the job produced (completed jobs). */
  output: string | null;
  /** Why it failed (failed jobs). */
  error: string | null;
};
