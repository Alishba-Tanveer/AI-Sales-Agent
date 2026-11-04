"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteOpportunity, listOpportunities, saveOpportunityAsLead, searchOpportunities, setDismissed } from "./api";
import { currentSearchOwner, loadSavedFilters, saveFilters } from "./storage";
import type { Opportunity, SearchFilters, SourceFailure } from "./types";

/**
 * idle     = the team has not found anything yet (the page explains what to do)
 * loading  = a search is running, or the shared results are being loaded
 * success  = results to show. They are the workspace's results, so every teammate sees the same list.
 */
export type OpportunitiesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; items: Opportunity[]; failures: SourceFailure[] };

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

let cachedState: OpportunitiesState = { status: "idle" };
let cachedFilters: SearchFilters | null = null;
let cachedOwner: string | null = null;

/** Keeps the in-memory copy tied to the signed-in user (a different person on the same browser starts clean). */
function syncOwner() {
  const owner = currentSearchOwner();
  if (owner !== cachedOwner) {
    cachedOwner = owner;
    cachedState = { status: "idle" };
    cachedFilters = loadSavedFilters();
  }
}

export function getCachedOpportunityFilters(): SearchFilters | null {
  syncOwner();
  return cachedFilters;
}

export function useOpportunities() {
  const [state, setState] = useState<OpportunitiesState>(() => {
    syncOwner();
    return cachedState;
  });
  /** ids with a save / dismiss / restore / delete in flight (their buttons are disabled) */
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const lastFilters = useRef<SearchFilters | null>(cachedFilters);
  const version = useRef(0);
  const searching = useRef(false);

  const updateState = useCallback((next: OpportunitiesState | ((prev: OpportunitiesState) => OpportunitiesState)) => {
    setState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      cachedState = resolved;
      return resolved;
    });
  }, []);

  /**
   * Loads what the team has already found. Runs when the page opens (so a teammate who never searched sees results
   * instead of an empty page) and again when the tab comes back into view. It never replaces a search in progress.
   */
  const loadShared = useCallback(
    async (silent: boolean) => {
      if (searching.current) return;
      const mine = ++version.current;
      if (!silent) updateState((s) => (s.status === "success" ? s : { status: "loading" }));
      try {
        const items = await listOpportunities();
        if (mine !== version.current || searching.current) return;
        // keep failures from a search this person just ran; a plain reload has none
        updateState((s) => (items.length === 0 ? { status: "idle" } : { status: "success", items, failures: s.status === "success" ? s.failures : [] }));
      } catch (e) {
        if (mine !== version.current || searching.current) return;
        // a failed background refresh keeps whatever is already on screen
        if (silent) return;
        updateState({ status: "error", message: errorText(e, "Could not load the saved opportunities.") });
      }
    },
    [updateState],
  );

  useEffect(() => {
    // started from a timer callback, not in the effect body, so the loading state is not set synchronously inside the effect
    const first = setTimeout(() => void loadShared(cachedState.status === "success"), 0);
    const onVisible = () => document.visibilityState === "visible" && void loadShared(true);
    document.addEventListener("visibilitychange", onVisible);
    // background refresh only while the tab is actually on screen
    const timer = setInterval(() => document.visibilityState === "visible" && void loadShared(true), 60_000);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [loadShared]);

  const run = useCallback(
    async (filters: SearchFilters) => {
      lastFilters.current = filters;
      cachedFilters = filters;
      saveFilters(filters);
      const mine = ++version.current; // a slower, older search must never overwrite a newer one
      searching.current = true;
      updateState({ status: "loading" });
      try {
        const result = await searchOpportunities(filters);
        // the server also stores every result, so teammates and later visits see this list too
        if (mine === version.current) updateState({ status: "success", ...result });
      } catch (e) {
        if (mine === version.current) updateState({ status: "error", message: errorText(e, "Something went wrong while searching.") });
      } finally {
        if (mine === version.current) searching.current = false;
      }
    },
    [updateState],
  );

  /** Re-run the last search (Retry / Retry sources). With no search to repeat, just reload the shared list. */
  const retry = useCallback(() => {
    if (lastFilters.current) void run(lastFilters.current);
    else void loadShared(false);
  }, [run, loadShared]);

  // The actions below are memoised so the result cards (which are React.memo) are not redrawn on every render.
  const patch = useCallback(
    (id: string, change: Partial<Opportunity>) =>
      updateState((s) => (s.status === "success" ? { ...s, items: s.items.map((o) => (o.id === id ? { ...o, ...change } : o)) } : s)),
    [updateState],
  );

  const track = useCallback(async (o: Opportunity, task: () => Promise<void>) => {
    setBusy((b) => new Set(b).add(o.id));
    try {
      await task();
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(o.id);
        return next;
      });
    }
  }, []);

  const save = useCallback(
    (o: Opportunity) =>
    track(o, async () => {
      // the server reads the company's website for an email / LinkedIn first, which can take a few seconds
      const toastId = toast.loading(`Checking ${o.company}'s website for an email or LinkedIn…`);
      try {
        const { leadId } = await saveOpportunityAsLead(o);
        patch(o.id, { status: "saved", leadId });
        toast.success(`${o.company} saved to Leads.`, { id: toastId });
      } catch (e) {
        toast.error(errorText(e, "Could not save this lead."), { id: toastId, duration: 9000 });
      }
    }),
    [track, patch],
  );

  const dismiss = useCallback(
    (o: Opportunity) =>
    track(o, async () => {
      try {
        await setDismissed(o, true);
        patch(o.id, { status: "dismissed" });
      } catch (e) {
        toast.error(errorText(e, "Could not dismiss this opportunity."));
      }
    }),
    [track, patch],
  );

  const restore = useCallback(
    (o: Opportunity) =>
    track(o, async () => {
      try {
        await setDismissed(o, false);
        patch(o.id, { status: "open" });
        toast.success("Opportunity restored.");
      } catch (e) {
        toast.error(errorText(e, "Could not restore this opportunity."));
      }
    }),
    [track, patch],
  );

  /** Permanently removes the result for the whole team. Called straight from the bin icon, no confirmation step. */
  const remove = useCallback(
    (o: Opportunity) =>
    track(o, async () => {
      try {
        await deleteOpportunity(o);
        updateState((s) => {
          if (s.status !== "success") return s;
          const items = s.items.filter((x) => x.id !== o.id);
          return items.length === 0 && s.failures.length === 0 ? { status: "idle" } : { ...s, items };
        });
        toast.success("Opportunity deleted.");
      } catch (e) {
        toast.error(errorText(e, "Could not delete this opportunity."));
      }
    }),
    [track, updateState],
  );

  return { state, run, retry, busy, save, dismiss, restore, remove };
}
