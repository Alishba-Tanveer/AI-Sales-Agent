"use client";

import { useEffect, useState } from "react";
import { fetchOnboarding } from "@/features/onboarding/api";

/**
 * Refreshes the saved company profile from the backend once when the dashboard opens, so Settings and the
 * "finish your setup" reminder read server data instead of whatever this browser happened to cache.
 * If the request fails the cached copy is used and the dashboard still renders.
 */
export function ProfileSync({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchOnboarding()
      .catch(() => {})
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return ready ? <>{children}</> : null;
}
