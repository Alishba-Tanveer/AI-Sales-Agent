"use client";

import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { userStore } from "@/features/auth/user-store";
import { AttentionCard } from "@/features/overview/components/attention-card";
import { LeadsByStage } from "@/features/overview/components/leads-by-stage";
import { MetricCards } from "@/features/overview/components/metric-cards";
import { OverviewEmpty, OverviewError, OverviewSkeleton } from "@/features/overview/components/overview-states";
import { RecentActivity } from "@/features/overview/components/recent-activity";
import { Reveal } from "@/features/overview/components/reveal";
import { firstName, greeting } from "@/features/overview/format";
import { useOverview } from "@/features/overview/hooks";

export default function OverviewPage() {
  const { state, retry } = useOverview();
  const name = firstName(userStore.get()?.name);

  return (
    <main className="mx-auto w-full max-w-[1600px] p-6 lg:p-8">
      {state.status === "loading" && <OverviewSkeleton />}

      {state.status === "error" && <OverviewError message={state.message} onRetry={retry} />}

      {state.status === "success" && state.data.metrics.totalLeads === 0 && (
        <div className="flex w-full flex-col gap-6">
          <Reveal>
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex flex-col">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {greeting()}
                  {name && `, ${name}`}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">Your workspace is ready. Here is how to get your first leads in.</p>
              </div>
              <Link
                href="/find-opportunities"
                className={cn(
                  buttonVariants(),
                  "group h-auto gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 hover:bg-primary/85 hover:shadow-lg hover:shadow-primary/25 motion-safe:hover:-translate-y-0.5",
                )}
              >
                <Search className="size-[18px] transition-transform duration-200 group-hover:scale-110" />
                Find Opportunities
              </Link>
            </header>
          </Reveal>
          <OverviewEmpty />
        </div>
      )}

      {state.status === "success" && state.data.metrics.totalLeads > 0 && (
        <div className="flex w-full flex-col gap-6">
          <Reveal>
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex flex-col">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {greeting()}
                  {name && `, ${name}`}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">Here is what needs you today.</p>
              </div>
              <Link
                href="/approvals"
                className={cn(
                  buttonVariants(),
                  "group h-auto gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 hover:bg-primary/85 hover:shadow-lg hover:shadow-primary/25 motion-safe:hover:-translate-y-0.5",
                )}
              >
                Review Approvals
                <ArrowRight className="size-[18px] transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </header>
          </Reveal>

          <Reveal delay={80}>
            <MetricCards metrics={state.data.metrics} />
          </Reveal>
          <Reveal delay={160}>
            <AttentionCard items={state.data.attention} />
          </Reveal>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Reveal delay={240} className="grid">
              <LeadsByStage stages={state.data.stages} totalLeads={state.data.metrics.totalLeads} />
            </Reveal>
            <Reveal delay={320} className="grid">
              <RecentActivity items={state.data.activity} />
            </Reveal>
          </section>
        </div>
      )}
    </main>
  );
}
