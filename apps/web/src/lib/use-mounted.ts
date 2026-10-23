"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false on the server and during hydration, true afterwards. Use it to read browser-only data (localStorage)
 * without a setState-in-effect and without a server/client markup mismatch.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
