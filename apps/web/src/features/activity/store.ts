import { useEffect, useSyncExternalStore } from "react";
import { USER_STORE_EVENT, userStore } from "@/features/auth/user-store";
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
let activeOrganizationId: string | null = null;
let requestVersion = 0;
const listeners = new Set<() => void>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let authListenerReady = false;

const set = (next: ActivityState) => {
  state = next;
  listeners.forEach((l) => l());
};

const subscribe = (cb: () => void) => {
  ensureAuthListener();
  listeners.add(cb);
  if (!pollTimer) pollTimer = setInterval(() => activityStore.refresh(), 15_000);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };
};

function currentOrganizationId() {
  return userStore.get()?.organization.id ?? null;
}

function changeOrganizationScope() {
  const next = currentOrganizationId();
  if (next === activeOrganizationId) return false;
  activeOrganizationId = next;
  requested = false;
  requestVersion += 1; // responses started for the prior workspace must never populate this feed
  set({ status: "loading" });
  return true;
}

function onSessionChanged() {
  const changed = changeOrganizationScope();
  if (changed && activeOrganizationId) activityStore.load(true);
}

function ensureAuthListener() {
  if (typeof window === "undefined" || authListenerReady) return;
  authListenerReady = true;
  window.addEventListener(USER_STORE_EVENT, onSessionChanged);
  window.addEventListener("storage", (event) => {
    if (event.key === "user" || event.key === null) onSessionChanged();
  });
  changeOrganizationScope();
}

export const activityStore = {
  /** Fetches the feed once. `force` (the Retry button) fetches again and shows the loading state. */
  load(force = false) {
    ensureAuthListener();
    changeOrganizationScope();
    const organizationId = activeOrganizationId;
    if (!organizationId) {
      requested = false;
      set({ status: "loading" });
      return;
    }
    if (requested && !force) return;
    requested = true;
    const version = ++requestVersion;
    if (force) set({ status: "loading" });
    listActivity()
      .then((jobs) => {
        if (activeOrganizationId === organizationId && requestVersion === version) set({ status: "success", jobs });
      })
      .catch((e) => {
        if (activeOrganizationId !== organizationId || requestVersion !== version) return;
        requested = false; // let the next visit try again
        set({ status: "error", message: e instanceof Error ? e.message : "Something went wrong while loading activity." });
      });
  },
  /** Refreshes silently so running background jobs update without replacing the page with a loading screen. */
  refresh() {
    ensureAuthListener();
    if (changeOrganizationScope()) {
      if (activeOrganizationId) activityStore.load(true);
      return;
    }
    if (state.status !== "success") return;
    const organizationId = activeOrganizationId;
    if (!organizationId) return;
    const version = ++requestVersion;
    listActivity()
      .then((jobs) => {
        if (activeOrganizationId === organizationId && requestVersion === version) set({ status: "success", jobs });
      })
      .catch(() => { /* Keep the last successful feed during transient polling errors. */ });
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
