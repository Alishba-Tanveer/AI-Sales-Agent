"use client";

import { useEffect, useState } from "react";
import { fetchOnboarding } from "@/features/onboarding/api";
import { syncRole } from "@/features/settings/api";

/**
 * Refreshes the saved company profile from the backend once when the dashboard opens, so Settings and the
 * "finish your setup" reminder read server data instead of whatever this browser happened to cache.
 * If the request fails the cached copy is used and the dashboard still renders.
 */
export function ProfileSync({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchOnboarding({ keepSessionOn401: true })
      .catch(() => {})
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Roles can change while someone is signed in (an Owner hands the workspace over). The server already applies the new
  // role on every request; this refreshes what this browser shows. On a change the page reloads so every menu and tab updates.
  useEffect(() => {
    let last = 0;
    const check = () => {
      if (document.visibilityState === "hidden" || Date.now() - last < 15_000) return;
      last = Date.now();
      syncRole()
        .then((changed) => changed && window.location.reload())
        .catch(() => {});
    };
    check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  return ready ? <>{children}</> : null;
}
