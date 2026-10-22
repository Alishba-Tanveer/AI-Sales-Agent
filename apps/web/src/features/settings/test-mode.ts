"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api";

/**
 * Test mode (dry run) is a workspace setting stored on the backend (GET/PUT /api/settings/test-mode).
 * The Settings page AND the top bar badge both read it, so it lives in a tiny shared store.
 * localStorage only mirrors the last known server value so the badge doesn't flicker on page load;
 * the server value is fetched when the dashboard mounts (see useTestMode).
 */
const KEY = "test-mode";
const listeners = new Set<() => void>();

const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** Update the local mirror and notify the badge / switch. */
export function cacheTestMode(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* storage blocked: ignore */
  }
  listeners.forEach((l) => l());
}

type TestModeDto = { data: { testMode: boolean }; message?: string };

let inflight: Promise<void> | null = null;

/** GET /api/settings/test-mode  (de-duplicated; failures keep the last known value) */
export function syncTestMode() {
  // background request: a rejected token must never sign the person out from here (same rule as ProfileSync)
  inflight ??= api<TestModeDto>("/api/settings/test-mode", { keepSessionOn401: true })
    .then((r) => cacheTestMode(!!r.data.testMode))
    .catch(() => {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** PUT /api/settings/test-mode. Throws when the save fails, so the switch stays where it was. */
export async function saveTestMode(on: boolean) {
  const res = await api<TestModeDto>("/api/settings/test-mode", { method: "PUT", body: JSON.stringify({ testMode: on }) });
  cacheTestMode(!!res.data.testMode);
  return res.message;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useTestMode() {
  useEffect(() => {
    void syncTestMode();
  }, []);
  return useSyncExternalStore(subscribe, read, () => false);
}
