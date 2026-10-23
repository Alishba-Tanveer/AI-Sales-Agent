"use client";

import { useSyncExternalStore } from "react";
import { USER_STORE_EVENT } from "@/features/auth/user-store";
import { currentRole, type AppRole } from "@/lib/permissions";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(USER_STORE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(USER_STORE_EVENT, cb);
  };
};

/**
 * The signed-in person's role, or null on the server / first client render (the role lives in localStorage, which the
 * server can't see, so the first render must match the server). Updates when the stored user changes.
 */
export function useRole(): AppRole | null {
  return useSyncExternalStore<AppRole | null>(subscribe, currentRole, () => null);
}
