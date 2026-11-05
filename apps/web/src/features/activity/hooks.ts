"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { cancelJob, deleteJob, retryJob } from "./api";
import { activityStore, useActivityState } from "./store";
import type { ActivityJob } from "./types";

export type { ActivityState } from "./store";

export function useActivity() {
  const state = useActivityState();
  /** job ids with a retry / cancel in flight (their menu is disabled) */
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    activityStore.load();
  }, []);

  const reload = () => activityStore.load(true);

  const act = useCallback(async (job: ActivityJob, call: typeof retryJob, success: string, failure: string) => {
    setBusy((b) => new Set(b).add(job.id));
    try {
      activityStore.patch(job.id, await call(job));
      toast.success(success);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : failure);
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(job.id);
        return next;
      });
    }
  }, []);

  const retry = useCallback((job: ActivityJob) => act(job, retryJob, `Retrying "${job.title}"`, "Could not retry this task."), [act]);
  const cancel = useCallback((job: ActivityJob) => act(job, cancelJob, `Cancelled "${job.title}"`, "Could not cancel this task."), [act]);
  const remove = useCallback(async (job: ActivityJob) => {
    setBusy((b) => new Set(b).add(job.id));
    try { await deleteJob(job); activityStore.remove(job.id); toast.success("Activity deleted"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete this activity."); }
    finally { setBusy((b) => { const n = new Set(b); n.delete(job.id); return n; }); }
  }, []);

  return { state, reload, busy, retry, cancel, remove };
}
