import { useEffect, useSyncExternalStore } from "react";
import { listActivity } from "./api";
import type { ActivityJob } from "./types";

export type ActivityState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; jobs: ActivityJob[] };

/**
 * One shared copy of the activity feed, so the Activity page and the sidebar badge (number of running tasks) always
 * agree, including after a Retry or Cancel, and navigating back to the page doesn't refetch.
 */
let state: ActivityState = { status: "loading" };
let requested = false;
const listeners = new Set<() => void>();

const set = (next: ActivityState) => {
  state = next;
  listeners.forEach((l) => l());
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export const activityStore = {
  /** Fetches the feed once. `force` (the Retry button) fetches again and shows the loading state. */
  load(force = false) {
    if (requested && !force) return;
    requested = true;
    if (force) set({ status: "loading" });
    listActivity()
      .then((jobs) => set({ status: "success", jobs }))
      .catch((e) => {
        requested = false; // let the next visit try again
        set({ status: "error", message: e instanceof Error ? e.message : "Something went wrong while loading activity." });
      });
  },
  patch(id: string, patch: Partial<ActivityJob>) {
    if (state.status !== "success") return;
    set({ status: "success", jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) });
  },
};

export function useActivityState(): ActivityState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** Number of running tasks, for the sidebar pill. Starts loading the feed if nothing has yet. 0 until it is known. */
export function useRunningCount(): number {
  const s = useActivityState();
  useEffect(() => {
    activityStore.load();
  }, []);
  return s.status === "success" ? s.jobs.filter((j) => j.status === "running").length : 0;
}
