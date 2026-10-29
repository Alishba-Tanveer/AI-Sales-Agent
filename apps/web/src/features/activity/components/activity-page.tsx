"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import { Reveal } from "@/features/overview/components/reveal";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { countByTab, matchesTab } from "../format";
import { useNow } from "@/lib/use-now";
import { useActivity } from "../hooks";
import type { ActivityJob, ActivityTab } from "../types";
import { ActivityEmpty, ActivityError, ActivitySkeleton } from "./activity-states";
import { JobDetailsDialog } from "./job-details-dialog";
import { JobRow } from "./job-row";

const PAGE_SIZE = 10;

const TABS: { id: ActivityTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "running", label: "Running" },
  { id: "failed", label: "Failed" },
  { id: "completed", label: "Completed" },
];

const COLUMNS: { label: string; width: string; align?: "center" | "right" }[] = [
  { label: "Task", width: "w-[26%]" },
  { label: "Related lead", width: "w-[19%]" },
  { label: "Agent", width: "w-[12%]" },
  { label: "Status", width: "w-[11%]" },
  { label: "Started", width: "w-[13%]" },
  { label: "Duration", width: "w-[8%]", align: "center" },
  { label: "Retries", width: "w-[6%]", align: "center" },
  { label: "", width: "w-[5%]", align: "right" },
];

export function ActivityPage() {
  const router = useRouter();
  const { state, reload, busy, retry, cancel } = useActivity();
  const now = useNow();
  const [tab, setTab] = useState<ActivityTab>("all");
  const [page, setPage] = useState(0);
  const [viewed, setViewed] = useState<ActivityJob | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const jobs = useMemo(() => (state.status === "success" ? state.jobs : []), [state]);
  const counts = useMemo(() => countByTab(jobs), [jobs]);
  const filtered = useMemo(() => jobs.filter((j) => matchesTab(j, tab)), [jobs, tab]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : current * PAGE_SIZE + 1;
  const to = current * PAGE_SIZE + rows.length;

  const pick = (next: ActivityTab) => {
    setTab(next);
    setPage(0);
  };

  // the dialog shows the latest copy of the job (e.g. after a retry), not the snapshot from when it was opened
  const viewedJob = viewed ? (jobs.find((j) => j.id === viewed.id) ?? viewed) : null;

  return (
    <main className="mx-auto w-full max-w-[1280px] p-6 lg:p-8">
      {state.status === "loading" && <ActivitySkeleton />}
      {state.status === "error" && <ActivityError message={state.message} onRetry={reload} />}

      {state.status === "success" && (
        <div className="flex w-full flex-col gap-6">
          <Reveal>
            <header>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Activity</h1>
              <p className="mt-1 text-sm text-muted-foreground">Track what your workspace is doing—from lead research and email drafting to LinkedIn syncing. Review results, retry failed tasks, and open related leads from one place.</p>
            </header>
          </Reveal>

          <Reveal delay={80} className="flex flex-col gap-6">
            <div role="tablist" aria-label="Filter activity" className="flex h-10 items-center gap-1 overflow-x-auto border-b border-border whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map(({ id, label }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    id={`activity-tab-${id}`}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    aria-controls="activity-panel"
                    onClick={() => pick(id)}
                    className={cn(
                      "-mb-px flex h-full shrink-0 cursor-pointer items-center border-b-2 px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                      active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {label} <span className="ml-1 tabular-nums">({counts[id]})</span>
                  </button>
                );
              })}
            </div>

            <section id="activity-panel" role="tabpanel" aria-labelledby={`activity-tab-${tab}`} className="overflow-hidden rounded-xl border border-border bg-card">
              {filtered.length === 0 ? (
                <ActivityEmpty tab={tab} />
              ) : (
                <>
                  <Table className="min-w-[960px] table-fixed">
                    <TableHeader className="bg-muted/60">
                      <TableRow className="h-11 border-border hover:bg-transparent">
                        {COLUMNS.map((c, i) => (
                          <TableHead
                            key={i}
                            className={cn(
                              "px-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase",
                              c.width,
                              c.align === "center" && "text-center",
                              c.align === "right" && "text-right",
                            )}
                          >
                            {c.label || <span className="sr-only">Actions</span>}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((job) => (
                        <JobRow
                          key={job.id}
                          job={job}
                          now={now}
                          busy={busy.has(job.id)}
                          onRetry={retry}
                          onCancel={cancel}
                          onView={(j) => {
                            setViewed(j);
                            setViewOpen(true);
                          }}
                          onOpenLead={(j) => j.lead.name && router.push(`/leads?search=${encodeURIComponent(j.lead.name)}`)}
                        />
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex h-14 items-center justify-between border-t border-border px-4">
                    <span className="text-xs text-muted-foreground" aria-live="polite">
                      Showing {from}-{to} of {filtered.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <PagerButton disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft className="size-3.5" />Previous</PagerButton>
                      <PagerButton disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>Next<ChevronRight className="size-3.5" /></PagerButton>
                    </div>
                  </div>
                </>
              )}
            </section>
          </Reveal>
        </div>
      )}

      <JobDetailsDialog job={viewedJob} open={viewOpen} onOpenChange={setViewOpen} now={now} />
    </main>
  );
}

function PagerButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-xs font-medium text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-muted-foreground"
    >
      {children}
    </button>
  );
}
