"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { getUsage, saveAiLimit } from "../api";
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

/** The AI spend counter resets on the 1st of every month. */
function daysUntilReset() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 86_400_000));
}

export function UsageTab({ onOpenOutreach }: { onOpenOutreach: () => void }) {
  const { state, reload, set } = useLoad(getUsage);
  if (state.status === "loading") return <TabLoading label="Loading usage and limits…" />;
  if (state.status === "error") return <TabError message={state.message} onRetry={reload} />;
  return <UsageView usage={state.data} onUsage={set} onOpenOutreach={onOpenOutreach} />;
}

function UsageView({ usage, onUsage, onOpenOutreach }: { usage: UsageInfo; onUsage: (u: UsageInfo) => void; onOpenOutreach: () => void }) {
  const [aiLimit, setAiLimit] = useState(usage.aiLimit.toFixed(2));
  const [savingLimit, setSavingLimit] = useState(false);

  const limitHit = usage.dailyCap > 0 && usage.sentToday >= usage.dailyCap;
  const sentPct = pctOf(usage.sentToday, usage.dailyCap);
  const aiPct = pctOf(usage.aiSpendThisMonth, usage.aiLimit);
  const reqPct = pctOf(usage.requestsToday, usage.requestsDailyLimit);

  const saveLimit = async () => {
    const n = Number(aiLimit);
    if (!Number.isFinite(n) || n <= 0) return void toast.error("Enter an amount greater than $0.");
    setSavingLimit(true);
    try {
      const next = await saveAiLimit(n);
      onUsage(next);
      setAiLimit(next.aiLimit.toFixed(2));
      toast.success("Monthly AI limit saved successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the AI limit.");
    } finally {
      setSavingLimit(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Usage and Limits</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Manage your daily sending limit and monthly AI spend.</p>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">AI usage</h3>
            <Pill tone="primary">Free tier</Pill>
          </div>
          <span className="text-xs text-muted-foreground">Resets in {daysUntilReset()} days</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">AI spending this month: ${usage.aiSpendThisMonth.toFixed(2)} of ${usage.aiLimit.toFixed(2)} limit</span>
            <span className="text-muted-foreground">{aiPct}%</span>
          </div>
          <Bar pct={aiPct} danger={aiPct >= 100} />
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <label htmlFor="ai-limit" className="text-xs font-medium text-muted-foreground">Monthly AI spending limit</label>
          <div className="flex items-center gap-2">
            <div className="relative max-w-xs flex-1">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <input
                id="ai-limit"
                inputMode="decimal"
                value={aiLimit}
                onChange={(e) => setAiLimit(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveLimit()}
                className="h-9 w-full rounded-lg border border-input bg-transparent pr-3 pl-6 font-mono text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </div>
            <Button className="h-9 px-4 text-xs font-semibold" disabled={savingLimit} onClick={saveLimit}>
              {savingLimit && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">AI drafting stops when the limit is reached.</p>
        </div>
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
