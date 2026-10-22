"use client";

import { useCallback, useEffect, useState } from "react";

export type LoadState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

/** Runs `fn` on mount (and again on reload). Used by the Settings tabs to load their data from the API. */
export function useLoad<T>(fn: () => Promise<T>) {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fn()
      .then((data) => !cancelled && setState({ status: "ready", data }))
      .catch((e) => !cancelled && setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong." }));
    return () => {
      cancelled = true;
    };
    // fn is a stable module-level function in every caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((a) => a + 1);
  }, []);

  /** Replace the loaded data without showing the spinner (after a save). */
  const set = useCallback((data: T) => setState({ status: "ready", data }), []);

  return { state, reload, set };
}
