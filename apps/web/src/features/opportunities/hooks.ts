"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { saveOpportunityAsLead, searchOpportunities, setDismissed } from "./api";
import type { Opportunity, SearchFilters, SourceFailure } from "./types";

export type OpportunitiesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; items: Opportunity[]; failures: SourceFailure[] };

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export function useOpportunities() {
  const [state, setState] = useState<OpportunitiesState>({ status: "idle" });
  /** ids with a save / dismiss / restore in flight (their buttons are disabled) */
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const lastFilters = useRef<SearchFilters | null>(null);
  const version = useRef(0);

  const run = useCallback(async (filters: SearchFilters) => {
    lastFilters.current = filters;
    const mine = ++version.current; // a slower, older search must never overwrite a newer one
    setState({ status: "loading" });
    try {
      const result = await searchOpportunities(filters);
      if (mine === version.current) setState({ status: "success", ...result });
    } catch (e) {
      if (mine === version.current) setState({ status: "error", message: errorText(e, "Something went wrong while searching.") });
    }
  }, []);

  /** Re-run the last search (Retry / Retry sources). */
  const retry = useCallback(() => {
    if (lastFilters.current) void run(lastFilters.current);
  }, [run]);

  const patch = (id: string, change: Partial<Opportunity>) =>
    setState((s) => (s.status === "success" ? { ...s, items: s.items.map((o) => (o.id === id ? { ...o, ...change } : o)) } : s));

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
      try {
        const { leadId } = await saveOpportunityAsLead(o);
        patch(o.id, { status: "saved", leadId });
        toast.success(`${o.company} saved to Leads.`);
      } catch (e) {
        toast.error(errorText(e, "Could not save this lead."));
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
