"use client";

import { useSyncExternalStore } from "react";

/**
 * Test mode (dry run) is read by the Settings page AND the top bar badge,
 * so it lives in a tiny shared store (persisted in localStorage).
 * TODO: replace with the real workspace setting once the backend exposes it.
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

export function setTestMode(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* storage blocked: ignore */
  }
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useTestMode() {
  return useSyncExternalStore(subscribe, read, () => false);
}
