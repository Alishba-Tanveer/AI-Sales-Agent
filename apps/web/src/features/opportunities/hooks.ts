"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { saveOpportunityAsLead, searchOpportunities, setDismissed } from "./api";
import { currentSearchOwner, loadSavedSearch, saveSearch } from "./storage";
import type { Opportunity, SearchFilters, SourceFailure } from "./types";

export type OpportunitiesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; items: Opportunity[]; failures: SourceFailure[] };

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

let cachedState: OpportunitiesState = { status: "idle" };
let cachedFilters: SearchFilters | null = null;
let cachedOwner: string | null = null;

/**
 * Brings the in-memory copy in line with the signed-in user and, after a page reload, restores the last finished
 * search from this browser's storage. Results stay until a new search is run.
 */
function syncFromStorage() {
  const owner = currentSearchOwner();
  if (owner !== cachedOwner) {
    cachedOwner = owner;
    cachedState = { status: "idle" };
    cachedFilters = null;
  }
  if (cachedState.status === "idle") {
    const saved = loadSavedSearch();
    if (saved) {
      cachedState = { status: "success", items: saved.items, failures: saved.failures };
      cachedFilters = saved.filters;
    }
  }
}

export function getCachedOpportunityFilters(): SearchFilters | null {
  syncFromStorage();
  return cachedFilters;
}

export function useOpportunities() {
  const [state, setState] = useState<OpportunitiesState>(() => {
    syncFromStorage();
    return cachedState;
  });
  /** ids with a save / dismiss / restore in flight (their buttons are disabled) */
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const lastFilters = useRef<SearchFilters | null>(cachedFilters);
  const version = useRef(0);

  const updateState = useCallback((next: OpportunitiesState | ((prev: OpportunitiesState) => OpportunitiesState)) => {
    setState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      cachedState = resolved;
      // only a finished search is kept; a search in progress or a failed one never replaces the saved results
      if (resolved.status === "success" && cachedFilters) saveSearch({ filters: cachedFilters, items: resolved.items, failures: resolved.failures });
      return resolved;
    });
  }, []);

  const run = useCallback(async (filters: SearchFilters) => {
    lastFilters.current = filters;
    cachedFilters = filters;
    const mine = ++version.current; // a slower, older search must never overwrite a newer one
    updateState({ status: "loading" });
    try {
      const result = await searchOpportunities(filters);
      if (mine === version.current) updateState({ status: "success", ...result });
    } catch (e) {
      if (mine === version.current) updateState({ status: "error", message: errorText(e, "Something went wrong while searching.") });
    }
  }, [updateState]);

  /** Re-run the last search (Retry / Retry sources). */
  const retry = useCallback(() => {
    if (lastFilters.current) void run(lastFilters.current);
  }, [run]);

  const patch = (id: string, change: Partial<Opportunity>) =>
    updateState((s) => (s.status === "success" ? { ...s, items: s.items.map((o) => (o.id === id ? { ...o, ...change } : o)) } : s));

  const track = async (o: Opportunity, task: () => Promise<void>) => {
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
  };

  const save = (o: Opportunity) =>
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
    });

  const dismiss = (o: Opportunity) =>
    track(o, async () => {
      try {
        await setDismissed(o, true);
        patch(o.id, { status: "dismissed" });
      } catch (e) {
        toast.error(errorText(e, "Could not dismiss this opportunity."));
      }
    });

  const restore = (o: Opportunity) =>
    track(o, async () => {
      try {
        await setDismissed(o, false);
        patch(o.id, { status: "open" });
        toast.success("Opportunity restored.");
      } catch (e) {
        toast.error(errorText(e, "Could not restore this opportunity."));
      }
    });

  return { state, run, retry, busy, save, dismiss, restore };
}
