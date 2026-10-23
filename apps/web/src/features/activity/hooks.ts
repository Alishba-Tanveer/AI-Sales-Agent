"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { cancelJob, retryJob } from "./api";
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

  return { state, reload, busy, retry, cancel };
}
