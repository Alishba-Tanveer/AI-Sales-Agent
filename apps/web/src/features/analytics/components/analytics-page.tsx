"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/features/overview/components/reveal";
import { HOVER_BUTTONS, TONES } from "@/features/settings/components/settings-ui";
import { cn } from "cn";
import { buildAnalytics, PERIODS, toCsv } from "../compute";
import { useAnalytics } from "../hooks";
import { SOURCE_LABEL, type AnalyticsView, type PeriodId, type RawAnalytics } from "../types";
import { AnalyticsEmpty, AnalyticsError, AnalyticsSkeleton, Funnel, LeadsOverTime, MetricSection, PeriodTabs } from "./analytics-ui";

function downloadCsv(view: AnalyticsView) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([toCsv(view)], { type: "text/csv;charset=utf-8" }));
  link.download = `analytics-${view.periodLabel.toLowerCase().replace(/\s+/g, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function Notice({ raw, cut, onRetry }: { raw: RawAnalytics; cut: boolean; onRetry: () => void }) {
  if (raw.failed.length === 0 && !cut) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-soft p-3.5 text-sm text-muted-foreground">
      <p className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <span>
          {raw.failed.length > 0 && (
            <>
              <span className="font-medium text-foreground">Some data could not be loaded: {raw.failed.map((k) => SOURCE_LABEL[k]).join(", ")}.</span> Those numbers show a dash.{" "}
            </>
          )}
          {cut && "The server returned only part of your leads, so lead numbers may be low."}
        </span>
      </p>
      {raw.failed.length > 0 && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function AnalyticsPage() {
  const { state, reload } = useAnalytics();
  const searchParams = useSearchParams();
  const periodParam: PeriodId = PERIODS.find((p) => p.id === searchParams.get("period"))?.id ?? "7d";
  const [period, setPeriod] = useState<PeriodId>(periodParam);
  const [syncedPeriodParam, setSyncedPeriodParam] = useState<PeriodId>(periodParam);
  // /analytics?period=30d (top-bar search) switches the period, also when the page is already open.
  if (syncedPeriodParam !== periodParam) { setSyncedPeriodParam(periodParam); setPeriod(periodParam); }
  const view = useMemo(() => (state.status === "ready" ? buildAnalytics(state.raw, period, state.loadedAt) : null), [state, period]);

  const byId = (id: string) => view?.groups.find((g) => g.id === id);
  const leads = byId("leads");
  const outreach = byId("outreach");
  const agent = byId("agent");
  const linkedin = byId("linkedin");

  return (
    <main className={cn("mx-auto w-full max-w-[1600px] p-6 lg:p-8", HOVER_BUTTONS)}>
      {state.status === "loading" && <AnalyticsSkeleton />}
      {state.status === "error" && <AnalyticsError message={state.message} onRetry={reload} />}

      {state.status === "ready" && view && (
        <div className="flex w-full flex-col gap-8">
          <Reveal>
            <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
              <div className="min-w-0 space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
                <p className="text-sm text-muted-foreground">How your pipeline, outreach, agents and LinkedIn are performing.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <PeriodTabs value={period} onChange={setPeriod} />
                <Button variant="default" onClick={() => downloadCsv(view)} className={cn("gap-2", TONES.pink.btn)} disabled={view.empty}>
                  <Download className="size-4" /> Export
                </Button>
                <Button variant="outline" size="icon" onClick={reload} aria-label="Refresh analytics" className={TONES.success.btn}>
                  <RefreshCw className="size-4" />
                </Button>
              </div>
            </header>
          </Reveal>

          <Notice raw={state.raw} cut={view.leadsCut} onRetry={reload} />

          {view.empty ? (
            <AnalyticsEmpty />
          ) : (
            <>
              {leads && (
                <Reveal delay={60}>
                  <MetricSection group={leads} hasPrevious={view.hasPrevious} />
                </Reveal>
              )}

              <Reveal delay={120}>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <LeadsOverTime series={view.series} className="lg:col-span-2" />
                  <Funnel steps={view.funnel} />
                </div>
              </Reveal>

              <Reveal delay={180}>
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                  {outreach && <MetricSection group={outreach} hasPrevious={view.hasPrevious} wide={false} />}
                  {agent && <MetricSection group={agent} hasPrevious={view.hasPrevious} wide={false} />}
                </div>
              </Reveal>

              {linkedin && (
                <Reveal delay={240}>
                  <MetricSection group={linkedin} hasPrevious={view.hasPrevious} />
                </Reveal>
              )}

              <p className="border-t border-border pt-5 text-xs text-muted-foreground">
                Only recorded events are shown. Leads and outreach count the people added in the selected period, wherever they are in your pipeline now.
              </p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
