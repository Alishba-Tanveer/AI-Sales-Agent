"use client";

import { cn } from "cn";
import { getUsage } from "../api";
import { useLoad } from "../use-load";
import type { UsageInfo } from "../types";
import { TabError, TabLoading } from "./load-states";
import { CARD_HOVER, Pill } from "./settings-ui";

function Bar({ pct, danger, thin }: { pct: number; danger?: boolean; thin?: boolean }) {
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-secondary", thin ? "h-1.5" : "h-2")}>
      <div className={cn("h-full rounded-full transition-all duration-300", danger ? "bg-destructive" : "bg-primary")} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

const pctOf = (value: number, max: number) => (max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0);

export function UsageTab({ onOpenOutreach }: { onOpenOutreach: () => void }) {
  const { state, reload } = useLoad(getUsage);
  if (state.status === "loading") return <TabLoading label="Loading usage and limits…" />;
  if (state.status === "error") return <TabError message={state.message} onRetry={reload} />;
  return <UsageView usage={state.data} onOpenOutreach={onOpenOutreach} />;
}

function UsageView({ usage, onOpenOutreach }: { usage: UsageInfo; onOpenOutreach: () => void }) {
  const limitHit = usage.dailyCap > 0 && usage.sentToday >= usage.dailyCap;
  const sentPct = pctOf(usage.sentToday, usage.dailyCap);
  const reqPct = pctOf(usage.requestsToday, usage.requestsDailyLimit);

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Usage</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Review today’s email sending and AI request totals.</p>
      </div>

      <section className={cn("flex flex-col gap-4 rounded-xl border border-border bg-card p-6", CARD_HOVER)}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Today&apos;s sending</h3>
          {limitHit && <Pill tone="destructive">Limit Reached</Pill>}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">Emails sent today: {usage.sentToday} of {usage.dailyCap}</span>
            <span className="text-muted-foreground">{sentPct}%</span>
          </div>
          <Bar pct={sentPct} danger={limitHit} />
          {limitHit && <p role="alert" className="pt-1 text-xs font-medium text-destructive">Daily limit reached. Sending resumes tomorrow.</p>}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="text-muted-foreground">Resets at midnight</span>
          <button type="button" onClick={onOpenOutreach} className="font-medium text-primary hover:underline">
            Change the daily limit in Outreach Strategy
          </button>
        </div>
      </section>

      <section className={cn("flex flex-col gap-4 rounded-xl border border-border bg-card p-6", CARD_HOVER)}>
        <h3 className="text-sm font-semibold text-foreground">AI requests</h3>
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Requests today: {usage.requestsToday} of {usage.requestsDailyLimit}</span>
            <span className="font-mono text-muted-foreground">{usage.requestsDailyLimit > 0 ? ((usage.requestsToday / usage.requestsDailyLimit) * 100).toFixed(1) : "0.0"}%</span>
          </div>
          <Bar pct={reqPct} thin />
        </div>
      </section>
    </div>
  );
}
