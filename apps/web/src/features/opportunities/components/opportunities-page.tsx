"use client";

import { useMemo, useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptionSelect } from "@/components/ui/option-select";
import { Reveal } from "@/features/overview/components/reveal";
import { useNow } from "@/lib/use-now";
import { DEFAULT_FILTERS } from "../constants";
import { accentAt, exportOpportunitiesCsv, sortOpportunities } from "../format";
import { useOpportunities } from "../hooks";
import type { SearchFilters, SortKey } from "../types";
import { FilterPanel } from "./filter-panel";
import { OpportunityCard } from "./opportunity-card";
import { NoResults, OpportunitiesError, OpportunitiesIntro, OpportunitiesSkeleton, PartialBanner } from "./opportunity-states";

const SORT_OPTIONS = [
  { value: "relevance", label: "Sort: Highest match" },
  { value: "newest", label: "Sort: Newest first" },
  { value: "company", label: "Sort: Company name" },
];

export function OpportunitiesPage() {
  const now = useNow();
  const { state, run, retry, busy, save, dismiss, restore } = useOpportunities();
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>("relevance");

  const items = useMemo(() => (state.status === "success" ? sortOpportunities(state.items, sort) : []), [state, sort]);
  // dismissed cards stay visible (faded, with Restore) but do not count as "found"
  const active = items.filter((o) => o.status !== "dismissed").length;

  const reset = () => setFilters(DEFAULT_FILTERS);
  const search = () => void run(filters);

  return (
    <main className="mx-auto w-full max-w-[1280px] p-6 lg:p-8">
      <div className="flex w-full flex-col gap-5">
        <Reveal>
          <header className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Find Opportunities</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                <ShieldCheck className="size-3.5 text-primary" />
                Only public and permitted sources are used
              </span>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Discover client projects, hiring signals and intent data from job portals, company pages and public registries. Save the good ones to your Leads.
            </p>
          </header>
        </Reveal>

        <Reveal delay={80} className="flex flex-col items-start gap-5 lg:flex-row">
          <FilterPanel filters={filters} onChange={setFilters} onSearch={search} searching={state.status === "loading"} />

          <section aria-live="polite" className="flex w-full min-w-0 flex-1 flex-col gap-3">
            {state.status === "idle" && <OpportunitiesIntro onLaunch={search} />}
            {state.status === "loading" && <OpportunitiesSkeleton />}
            {state.status === "error" && <OpportunitiesError message={state.message} onRetry={retry} />}

            {state.status === "success" && (
              <>
                {state.failures.length > 0 && <PartialBanner failures={state.failures} shown={state.items.length} onRetry={retry} />}

                {items.length === 0 ? (
                  <NoResults onReset={reset} />
                ) : (
                  <>
                    <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-3">
                        <span className="size-2 rounded-full bg-primary" aria-hidden />
                        <p className="text-sm font-semibold text-foreground">
                          Found {active} {active === 1 ? "opportunity" : "opportunities"}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">matching your filters</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <OptionSelect aria-label="Sort opportunities" value={sort} onValueChange={(v) => setSort(v as SortKey)} options={SORT_OPTIONS} className="w-48 text-xs" />
                        <Button variant="outline" size="lg" onClick={() => exportOpportunitiesCsv(items)}>
                          <Download />
                          Export
                        </Button>
                      </div>
                    </div>

                    <p className="px-1 text-xs text-muted-foreground">Automated outreach respects each site’s published contact rules. Nothing is sent from this page.</p>

                    <div className="flex flex-col gap-3">
                      {items.map((o, i) => (
                        <OpportunityCard key={o.id} item={o} accent={accentAt(i)} now={now} busy={busy.has(o.id)} onSave={save} onDismiss={dismiss} onRestore={restore} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </Reveal>
      </div>
    </main>
  );
}
