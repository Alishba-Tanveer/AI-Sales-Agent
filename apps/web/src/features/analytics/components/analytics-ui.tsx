"use client";

import Link from "next/link";
import { ArrowRight, CloudOff, Minus, RefreshCw, Search, TrendingDown, TrendingUp, Users } from "lucide-react";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CARD_HOVER, ICON_POP } from "@/features/settings/components/settings-ui";
import { changeOf, formatValue, PERIODS } from "../compute";
import type { ChartBucket, FunnelStep, Metric, MetricGroup, PeriodId } from "../types";

/* ---------- period picker ---------- */

export function PeriodTabs({ value, onChange }: { value: PeriodId; onChange: (p: PeriodId) => void }) {
  return (
    <div role="radiogroup" aria-label="Period" className="inline-flex items-center rounded-lg border border-border bg-card p-1">
      {PERIODS.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={value === p.id}
          onClick={() => onChange(p.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            value === p.id ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- metric cards ---------- */

const changeTone = { success: "text-success", destructive: "text-destructive", muted: "text-muted-foreground" } as const;

function MetricCard({ metric, hasPrevious }: { metric: Metric; hasPrevious: boolean }) {
  const change = changeOf(metric);
  // the arrow shows which way the number moved; the color shows whether that is good
  const Icon = !change || change.tone === "muted" ? Minus : (metric.value ?? 0) > (metric.prev ?? 0) ? TrendingUp : TrendingDown;
  return (
    // Same tile as the Leads page: dot + heading on the left, number on the right, then one line of text underneath.
    // The text line is always exactly one line, so every tile has the same height.
    <div className="group flex min-w-0 cursor-default flex-col gap-2 rounded-xl border border-border bg-card px-5 py-4 transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 motion-safe:hover:-translate-y-0.5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          <span className="size-2 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-150" style={{ backgroundColor: metric.color }} aria-hidden />
          <span className="truncate">{metric.label}</span>
        </p>
        <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{formatValue(metric)}</p>
      </div>
      <p className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
        {metric.value === null ? (
          <span className="truncate">Not enough data yet</span>
        ) : metric.note ? (
          <span className="truncate">{metric.note}</span>
        ) : change ? (
          <>
            <span className={cn("inline-flex shrink-0 items-center gap-1 font-medium", changeTone[change.tone])}>
              <Icon className="size-3.5" aria-hidden />
              {change.text}
            </span>
            <span className="truncate">vs previous period</span>
          </>
        ) : (
          <span className="truncate">{hasPrevious ? "No earlier data" : "Across all time"}</span>
        )}
      </p>
    </div>
  );
}

const COLS: Record<number, string> = { 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" };

export function MetricSection({ group, hasPrevious, wide = true }: { group: MetricGroup; hasPrevious: boolean; wide?: boolean }) {
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-labelledby={`sec-${group.id}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-4 w-1.5 rounded-full" style={{ backgroundColor: group.color }} aria-hidden />
          <h2 id={`sec-${group.id}`} className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {group.title}
          </h2>
        </div>
        <span className="hidden text-xs text-muted-foreground sm:block">{group.subtitle}</span>
      </div>
      {group.unavailable ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-8 text-center text-sm text-muted-foreground">
          {group.unavailable} The other sections are not affected.
        </div>
      ) : (
        <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", wide && COLS[group.metrics.length])}>
          {group.metrics.map((metric) => (
            <MetricCard key={metric.key} metric={metric} hasPrevious={hasPrevious} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- charts ---------- */

function Panel({ title, aside, children, className, bodyClassName }: { title: string; aside?: string; children: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("flex flex-col rounded-xl border border-border bg-card p-6", CARD_HOVER, className)}>
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      <div className={cn("pt-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function LeadsOverTime({ series, className }: { series: ChartBucket[]; className?: string }) {
  const total = series.reduce((sum, b) => sum + b.value, 0);
  const max = Math.max(1, ...series.map((b) => b.value));
  const mid = series[Math.floor(series.length / 2)];
  const daily = series.length > 0 && series.every((b) => b.dayLabel && b.monthLabel);
  const monthGroups: Array<{ label: string; count: number }> = [];
  if (daily) {
    for (const bucket of series) {
      const label = bucket.monthLabel!;
      const last = monthGroups[monthGroups.length - 1];
      if (last?.label === label) last.count += 1;
      else monthGroups.push({ label, count: 1 });
    }
  }
  return (
    <Panel title="Leads added over time" aside={`${total.toLocaleString("en-US")} added`} className={className} bodyClassName="flex flex-1 flex-col justify-center">
      <div className="w-full">
        {total === 0 ? (
          <p className="flex h-44 items-center justify-center text-center text-sm text-muted-foreground">No leads were added in this period.</p>
        ) : (
          <>
            <div className="flex h-44 items-end gap-1" role="img" aria-label={`Leads added over time, ${total} in total`}>
              {series.map((b, i) => (
                <div key={i} className="group/bar relative flex h-full min-w-0 flex-1 items-end" title={b.hint}>
                  {daily && i > 0 && series[i - 1].monthLabel !== b.monthLabel && (
                    <span aria-hidden className="pointer-events-none absolute -left-[3px] top-0 z-10 h-full w-px bg-border/80" />
                  )}
                  <span className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover/bar:block">
                    {b.hint}
                  </span>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 z-[1] -translate-x-1/2 whitespace-nowrap text-[10px] leading-none font-medium tabular-nums text-muted-foreground"
                    style={{ bottom: b.value > 0 ? `calc(${Math.max(4, (b.value / max) * 100)}% + 4px)` : "5px" }}
                  >
                    {b.value.toLocaleString("en-US")}
                  </span>
                  <div
                    className={cn("w-full rounded-t transition-colors duration-150", b.value > 0 ? "bg-primary/70 group-hover/bar:bg-primary" : "bg-secondary")}
                    style={{ height: b.value > 0 ? `${Math.max(4, (b.value / max) * 100)}%` : "2px" }}
                  />
                </div>
              ))}
            </div>
            {daily ? (
              <div className="mt-2" aria-label="Daily dates">
                <div className="flex gap-1 text-[10px] leading-4 tabular-nums text-muted-foreground">
                  {series.map((bucket, index) => <span key={index} className="min-w-0 flex-1 text-center">{bucket.dayLabel}</span>)}
                </div>
                <div className="mt-1 flex gap-1 text-[10px] leading-4 text-muted-foreground">
                  {monthGroups.map((group, index) => <span key={`${group.label}-${index}`} style={{ flex: group.count }} className="text-center">{group.label}</span>)}
                </div>
              </div>
            ) : (
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{series[0]?.label}</span>
                {series.length > 6 && <span className="hidden sm:block">{mid?.label}</span>}
                <span>{series[series.length - 1]?.label}</span>
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const base = steps[0]?.count ?? 0;
  return (
    <Panel title="Pipeline funnel" aside="people added in this period">
      <ul className="flex flex-col gap-5">
        {steps.map((s, i) => {
          const pct = base > 0 ? (s.count / base) * 100 : 0;
          const prev = i > 0 ? steps[i - 1].count : 0;
          const conv = i > 0 && prev > 0 ? Math.round((s.count / prev) * 100) : null;
          return (
            <li key={s.label} className="group">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-foreground">
                  <span className={cn("size-2 rounded-full", ICON_POP)} style={{ backgroundColor: s.color }} aria-hidden />
                  {s.label}
                </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {s.count.toLocaleString("en-US")}
                  {conv !== null && <span className="ml-2 text-xs font-normal text-muted-foreground">{conv}% of previous</span>}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: s.color }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 text-xs text-muted-foreground">Where the people added in this period are now. Won and Interested are counted from their current stage.</p>
    </Panel>
  );
}

/* ---------- states ---------- */

export function AnalyticsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-8" role="status" aria-label="Loading analytics">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-80 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl border border-border" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl border border-border lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl border border-border" />
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl border border-border" />
        <Skeleton className="h-64 rounded-xl border border-border" />
      </div>
    </div>
  );
}

export function AnalyticsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="my-8 flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-card p-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-destructive/30 bg-destructive-soft">
        <CloudOff className="size-6 text-destructive" />
      </div>
      <h3 className="text-base font-medium text-foreground">Could not load analytics</h3>
      <p className="mt-1 mb-6 max-w-sm text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry} className="gap-2">
        <RefreshCw className="size-4" /> Try again
      </Button>
    </div>
  );
}

export function AnalyticsEmpty() {
  return (
    <div className={cn("mx-auto flex w-full max-w-xl flex-col items-center rounded-xl border border-border bg-card px-6 py-16 text-center", CARD_HOVER)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-primary/30 bg-primary-soft text-primary">
        <Users className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Not enough data yet</h2>
      <p className="mt-2 mb-6 max-w-sm text-sm text-muted-foreground">Analytics fill in automatically as you add leads, reach out and your agents get to work.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/find-opportunities" className={cn(buttonVariants(), "gap-2")}>
          <Search className="size-4" /> Find Opportunities
        </Link>
        <Link href="/leads" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
          Add leads <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
