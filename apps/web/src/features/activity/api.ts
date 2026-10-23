import { api, ApiError } from "@/lib/api";
import { buildMockActivity } from "./mock-data";
import type { ActivityJob } from "./types";

/**
 * The backend has no /api/activity routes yet, so this page runs on mock data.
 * When they ship, set in apps/web/.env.local:
 *
 *   NEXT_PUBLIC_USE_MOCK_ACTIVITY=false
 *
 * and the calls below hit the real API (JWT is attached by lib/api.ts).
 */
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_ACTIVITY !== "false";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Dev helper: open /activity?mock=empty or /activity?mock=error to preview those states. */
function mockMode() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("mock");
}

/** What a retry / cancel changes on a job. */
export type JobPatch = Partial<Pick<ActivityJob, "status" | "startedAt" | "scheduledFor" | "durationSec" | "retries" | "error" | "output">>;

/** GET /api/activity */
export async function listActivity(): Promise<ActivityJob[]> {
  if (USE_MOCK) {
    await wait(600);
    const mode = mockMode();
    if (mode === "error") throw new ApiError("The activity feed could not be loaded because the server took too long to answer.", 0);
    if (mode === "empty") return [];
    return buildMockActivity();
  }
  const res = await api<{ data: ActivityJob[] }>("/api/activity");
  return res.data;
}

/** POST /api/activity/:id/retry  -> the job as it is now (running again, retries + 1) */
export async function retryJob(job: ActivityJob): Promise<JobPatch> {
  if (USE_MOCK) {
    await wait(500);
    return { status: "running", startedAt: new Date().toISOString(), scheduledFor: null, durationSec: null, retries: Math.min(job.retries + 1, job.maxRetries), error: null };
  }
  const res = await api<{ data: JobPatch }>(`/api/activity/${job.id}/retry`, { method: "POST" });
  return res.data;
}

/** POST /api/activity/:id/cancel  -> the job as it is now (cancelled) */
export async function cancelJob(job: ActivityJob): Promise<JobPatch> {
  if (USE_MOCK) {
    await wait(400);
    const ran = job.startedAt ? Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000) : null;
    return { status: "cancelled", durationSec: ran, scheduledFor: null };
  }
  const res = await api<{ data: JobPatch }>(`/api/activity/${job.id}/cancel`, { method: "POST" });
  return res.data;
}
