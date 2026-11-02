"use client";

import { useSyncExternalStore } from "react";
import type { AuthUser } from "@/features/auth/api";
import { USER_STORE_EVENT } from "@/features/auth/user-store";

const KEY = "user";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(USER_STORE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(USER_STORE_EVENT, cb);
  };
};

// useSyncExternalStore needs the same object back until the stored text changes, so the parsed user is cached by its raw text.
let cachedRaw: string | null | undefined;
let cachedUser: AuthUser | null = null;

function getSnapshot(): AuthUser | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedUser = raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      cachedUser = null;
    }
  }
  return cachedUser;
}

/**
 * The signed-in user (name, photo, role...). Re-renders whenever the stored user changes, so a photo or name saved in
 * Settings shows up in the sidebar straight away. Null on the server and the first client render.
 */
export function useStoredUser(): AuthUser | null {
  return useSyncExternalStore<AuthUser | null>(subscribe, getSnapshot, () => null);
}
