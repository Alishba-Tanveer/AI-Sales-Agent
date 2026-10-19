"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { setTestMode, useTestMode } from "../test-mode";
import { SENT_TODAY } from "../mock-data";
import { Pill, Switch } from "./settings-ui";

type Preview = "normal" | "limit" | "test";

function Bar({ pct, danger, thin }: { pct: number; danger?: boolean; thin?: boolean }) {
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-secondary", thin ? "h-1.5" : "h-2")}>
      <div className={cn("h-full rounded-full transition-all duration-300", danger ? "bg-destructive" : "bg-primary")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function UsageTab({ dailyCap, onOpenOutreach }: { dailyCap: number; onOpenOutreach: () => void }) {
  const testMode = useTestMode();
  const [limitHit, setLimitHit] = useState(false);
  const [aiLimit, setAiLimit] = useState("5.00");

  const sent = limitHit ? dailyCap : Math.min(SENT_TODAY, dailyCap);
  const pct = Math.min(100, Math.round((sent / dailyCap) * 100));
  const active: Preview = limitHit ? "limit" : testMode ? "test" : "normal";

  const preview = (p: Preview) => {
    setLimitHit(p === "limit");
    setTestMode(p === "test");
  };

  const saveAiLimit = () => {
    const n = Number(aiLimit);
    if (!Number.isFinite(n) || n <= 0) return void toast.error("Enter an amount greater than $0.");
    setAiLimit(n.toFixed(2));
    toast.success("Monthly AI limit saved successfully");
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold text-foreground">Usage and Limits</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Manage operational boundaries, dry run simulations, and outbound allocations.</p>
        </div>
        <div role="group" aria-label="Preview state" className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {(
            [
              ["normal", "Normal"],
              ["limit", "Limit Reached"],
              ["test", "Test Mode"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => preview(id)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-all",
                active === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Test mode (dry run)</h3>
            <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
              When on, nothing is actually sent. Emails go through the whole flow but are only saved as test sends.
            </p>
          </div>
          <Switch
            checked={testMode}
            label="Test mode"
            onChange={(v) => {
              setTestMode(v);
              toast(v ? "Test mode enabled: dry run only" : "Test mode disabled: live sending active");
            }}
          />
        </div>
        {testMode && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-xs font-medium text-warning">
            <TriangleAlert className="size-4" />
            Test mode is on. No emails will be sent.
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Today&apos;s sending</h3>
          {limitHit && <Pill tone="destructive">Limit Reached</Pill>}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">Emails sent today: {sent} of {dailyCap}</span>
            <span className="text-muted-foreground">{pct}%</span>
          </div>
          <Bar pct={pct} danger={limitHit} />
          {limitHit && <p role="alert" className="pt-1 text-xs font-medium text-destructive">Daily limit reached. Sending resumes tomorrow.</p>}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="text-muted-foreground">Resets at midnight</span>
          <button type="button" onClick={onOpenOutreach} className="font-medium text-primary hover:underline">
            Change the daily limit in Outreach Strategy
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">AI usage</h3>
            <Pill tone="primary">Free tier</Pill>
          </div>
          <span className="text-xs text-muted-foreground">Resets in 11 days</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">AI spending this month: $0.00 of ${aiLimit} limit</span>
            <span className="text-muted-foreground">0%</span>
          </div>
          <Bar pct={0} />
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
                className="h-9 w-full rounded-lg border border-input bg-transparent pr-3 pl-6 font-mono text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </div>
            <Button className="h-9 px-4 text-xs font-semibold" onClick={saveAiLimit}>Save</Button>
          </div>
          <p className="text-xs text-muted-foreground">AI drafting stops when the limit is reached.</p>
        </div>
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Requests today: 38 of 250</span>
            <span className="font-mono text-muted-foreground">15.2%</span>
          </div>
          <Bar pct={15.2} thin />
        </div>
      </section>
    </div>
  );
}
