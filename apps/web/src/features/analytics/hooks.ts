"use client";

import { useEffect, useState } from "react";
import { loadAnalytics } from "./api";
import type { RawAnalytics } from "./types";

export type AnalyticsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; raw: RawAnalytics; /** when the data arrived; the periods are measured from here */ loadedAt: number };

const SOURCE_COUNT = 5;

export function useAnalytics() {
  const [state, setState] = useState<AnalyticsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadAnalytics().then((raw) => {
      if (cancelled) return;
      // Only when nothing at all could be loaded is the whole page an error; otherwise show what we have.
      if (raw.failed.length === SOURCE_COUNT) setState({ status: "error", message: raw.firstError || "Could not load analytics." });
      else setState({ status: "ready", raw, loadedAt: Date.now() });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = () => {
    setState({ status: "loading" });
    setAttempt((a) => a + 1);
  };

  return { state, reload };
}
