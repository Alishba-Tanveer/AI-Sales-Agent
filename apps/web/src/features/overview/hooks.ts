"use client";

import { useEffect, useState } from "react";
import { ApiError, tokenStore } from "@/lib/api";
import { userStore } from "@/features/auth/user-store";
import { getNavCounts, getOverview } from "./api";
import type { NavCounts, OverviewData } from "./types";

export type OverviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: OverviewData };

/** Expired / rejected token -> back to the login screen. */
function handleAuthFailure(e: unknown) {
  if (e instanceof ApiError && e.status === 401) {
    tokenStore.clear();
    userStore.clear();
    window.location.replace("/login");
    return true;
  }
  return false;
}

export function useOverview() {
  const [state, setState] = useState<OverviewState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getOverview()
      .then((data) => !cancelled && setState({ status: "success", data }))
      .catch((e) => {
        if (cancelled || handleAuthFailure(e)) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Something went wrong while loading your workspace.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((a) => a + 1);
  };

  return { state, retry };
}

/** Counters for the sidebar pills. Fails silently (pills just stay hidden). */
export function useNavCounts() {
  const [counts, setCounts] = useState<NavCounts | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getNavCounts()
        .then((c) => !cancelled && setCounts(c))
        .catch(() => {});
    void load();
    // keep the pills fresh: poll, and refresh when the tab is shown again
    const timer = setInterval(load, 30_000);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return counts;
}
