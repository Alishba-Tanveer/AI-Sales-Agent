import { api } from "@/lib/api";
import type { ActivityJob } from "./types";

/** What a retry / cancel changes on a job. */
export type JobPatch = Partial<Pick<ActivityJob, "status" | "startedAt" | "scheduledFor" | "durationSec" | "retries" | "error" | "output">>;

/** GET /api/activity */
export async function listActivity(): Promise<ActivityJob[]> {
  const res = await api<{ data: ActivityJob[] }>("/api/activity");
  return res.data;
}

/** POST /api/activity/:id/retry  -> the job as it is now (running again, retries + 1) */
export async function retryJob(job: ActivityJob): Promise<JobPatch> {
  const res = await api<{ data: JobPatch }>(`/api/activity/${job.id}/retry`, { method: "POST" });
  return res.data;
}

/** POST /api/activity/:id/cancel  -> the job as it is now (cancelled) */
export async function cancelJob(job: ActivityJob): Promise<JobPatch> {
  const res = await api<{ data: JobPatch }>(`/api/activity/${job.id}/cancel`, { method: "POST" });
  return res.data;
}
