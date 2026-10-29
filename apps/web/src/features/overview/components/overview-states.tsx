import Link from "next/link";
import { ArrowRight, Compass, CloudOff, ListChecks, RefreshCw, Search, UserPlus, type LucideIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";
import type { StageCount } from "../types";
import { LeadsByStage } from "./leads-by-stage";
import { RecentActivity } from "./recent-activity";
import { Reveal } from "./reveal";

/** Loading placeholder with the same layout as the loaded page. */
export function OverviewSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6" role="status" aria-label="Loading overview">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl border border-border" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-xl border border-border" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl border border-border" />
        <Skeleton className="h-64 rounded-xl border border-border" />
      </div>
    </div>
  );
}

const EMPTY_STAGES: StageCount[] = (["new", "contacted", "interested", "won", "lost", "do_not_contact"] as const).map((stage) => ({ stage, count: 0 }));

/** Same compact tile the Leads page uses, so the two pages read as one product. */
const EMPTY_KPIS = [
  { label: "Total leads", color: "var(--primary)" },
  { label: "New this week", color: "#38BDF8" },
  { label: "Pending approvals", color: "#FBBF24" },
  { label: "Replies", color: "#4ADE80" },
] as const;

const FIRST_STEPS: { title: string; text: string; href: string; icon: LucideIcon }[] = [
  { title: "Find opportunities", text: "Tell the AI who you want to reach and run a discovery session. It looks for matching prospects for you.", href: "/find-opportunities", icon: Search },
  { title: "Add or import leads", text: "Already have people in mind? Add them one by one, or import a CSV you already have.", href: "/leads", icon: UserPlus },
  { title: "Review approvals", text: "Every draft the AI writes waits here for your OK. Nothing is sent without you.", href: "/approvals", icon: ListChecks },
];

/**
 * Brand-new workspace: no leads, nothing happened yet. It has the same sections as the full Overview (numbers, stages,
 * activity), all at zero, so the page keeps its shape and fills in as work arrives. The "Get started" panel says what to do first.
 */
export function OverviewEmpty() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Reveal>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key metrics">
          {EMPTY_KPIS.map((kpi) => (
            <div
              key={kpi.label}
              className="group flex cursor-default items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 motion-safe:hover:-translate-y-0.5"
            >
              <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                <span className="size-2 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-150" style={{ backgroundColor: kpi.color }} aria-hidden />
                <span className="truncate">{kpi.label}</span>
              </p>
              <p className="text-2xl font-semibold tracking-tight text-foreground">0</p>
            </div>
          ))}
        </section>
      </Reveal>

      <Reveal delay={80}>
        <section
          className="overflow-hidden rounded-xl border border-border bg-card transition-colors duration-200 hover:border-primary/25"
          aria-labelledby="get-started-title"
        >
          <div className="flex items-start gap-4 border-b border-border p-6">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Compass className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 id="get-started-title" className="text-base font-semibold text-foreground">No pipeline activity yet</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Connect your target criteria or run a discovery session to let the AI agent identify prospects.
              </p>
            </div>
          </div>
          <ol className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
            {FIRST_STEPS.map(({ title, text, href, icon: Icon }, i) => (
              <li key={title} className="group flex flex-col gap-3 p-6 transition-colors duration-150 hover:bg-primary/5">
                <div className="flex items-center gap-3">
                  <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground" aria-hidden>{i + 1}</span>
                  <Icon className="size-[18px] text-primary transition-transform duration-200 group-hover:scale-110" aria-hidden />
                  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{text}</p>
                <Link
                  href={href}
                  className={cn(
                    buttonVariants({ variant: i === 0 ? "default" : "outline" }),
                    "mt-auto h-auto w-fit gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 motion-safe:hover:-translate-y-0.5",
                    i === 0 && "hover:bg-primary/85 hover:shadow-lg hover:shadow-primary/25",
                  )}
                >
                  {i === 0 && <Search className="size-[18px]" />}
                  {title}
                  {i !== 0 && <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal delay={160} className="grid">
          <LeadsByStage stages={EMPTY_STAGES} totalLeads={0} />
        </Reveal>
        <Reveal delay={240} className="grid">
          <RecentActivity items={[]} />
        </Reveal>
      </section>
    </div>
  );
}

export function OverviewError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="my-8 flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-card p-12 text-center"
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-destructive/30 bg-destructive-soft">
        <CloudOff className="size-6 text-destructive" />
      </div>
      <h3 className="text-base font-medium text-foreground">Failed to load workspace data</h3>
      <p className="mt-1 mb-6 max-w-sm text-sm text-muted-foreground">{message}</p>
      <Button
        variant="secondary"
        onClick={onRetry}
        className="group h-auto gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-all duration-200 hover:border-primary/40 motion-safe:hover:-translate-y-0.5"
      >
        <RefreshCw className="size-[18px] transition-transform duration-500 motion-safe:group-hover:rotate-180" />
        Retry
      </Button>
    </div>
  );
}
