"use client";

import { useSyncExternalStore } from "react";

/* One shared clock, so "18 mins ago" labels and running timers stay current without every component owning an interval. */

let clock = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribeClock(cb: () => void) {
  listeners.add(cb);
  clock = Date.now();
  if (!timer) {
    timer = setInterval(() => {
      clock = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Current time in ms, refreshed every second. Returns 0 on the server and before the first client render. */
export function useNow() {
  return useSyncExternalStore(subscribeClock, () => clock, () => 0);
}
