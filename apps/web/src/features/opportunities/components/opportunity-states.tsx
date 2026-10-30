import { CloudOff, Compass, Radar, RefreshCw, SearchX, ShieldCheck, TriangleAlert, Zap, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ink, tint } from "../format";
import type { SourceFailure } from "../types";

/** Before the first search: explains what the page does. */
export function OpportunitiesIntro({ onLaunch }: { onLaunch: () => void }) {
  const features = [
    { icon: Target, color: "#818CF8", title: "Targeted matching", text: "Keywords like AI agents, CRM integration or chatbot find companies with real automation demand." },
    { icon: ShieldCheck, color: "#34D399", title: "Permitted sources only", text: "Reads open job portals, company pages and public registries, and follows their rules." },
    { icon: Zap, color: "#FBBF24", title: "One click to pipeline", text: "Save as Lead adds it to Leads as New. The agent then researches the company." },
  ];
  return (
    <div className="w-full rounded-xl border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-col gap-6">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Radar className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Find client projects and hiring signals</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Pick your keywords and sources, then run a search. Nothing is contacted from this page. You decide which results become leads.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {features.map(({ icon: Icon, color, title, text }) => (
            <div key={title} className="flex flex-col gap-2 rounded-lg bg-background/60 p-3.5 ring-1 ring-border">
              <div className="flex size-8 items-center justify-center rounded-lg" style={{ backgroundColor: tint(color, 16), color: ink(color) }}>
                <Icon className="size-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
        <div>
          <Button size="lg" onClick={onLaunch}>
            <Compass />
            Run search
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OpportunitiesSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Searching sources">
      <Skeleton className="h-16 w-full rounded-xl" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <Skeleton className="size-11 shrink-0 rounded-lg" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-64 max-w-full" />
                <Skeleton className="h-4 w-44" />
              </div>
            </div>
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
          <Skeleton className="h-20 rounded-lg" />
          <div className="flex justify-between">
            <div className="flex gap-2">
              <Skeleton className="h-9 w-32 rounded-lg" />
              <Skeleton className="h-9 w-20 rounded-lg" />
            </div>
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function OpportunitiesError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="mx-auto my-6 flex w-full max-w-lg flex-col items-center rounded-2xl border border-destructive/30 bg-card p-10 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-destructive/30 bg-destructive-soft">
        <CloudOff className="size-6 text-destructive" />
      </div>
      <h3 className="text-base font-medium text-foreground">Search failed</h3>
      <p className="mt-1 mb-6 max-w-sm text-sm text-muted-foreground">{message}</p>
      <Button variant="secondary" onClick={onRetry} className="group h-auto gap-2 rounded-lg border border-border px-4 py-2 hover:border-primary/40">
        <RefreshCw className="size-[18px] transition-transform duration-500 motion-safe:group-hover:rotate-180" />
        Retry search
      </Button>
    </div>
  );
}

export function NoResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-border bg-secondary">
        <SearchX className="size-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-medium text-foreground">No opportunities match</h3>
      <p className="mt-1 mb-5 max-w-sm text-sm text-muted-foreground">Try fewer keywords, a lower minimum match, or a longer posting window.</p>
      <Button variant="secondary" onClick={onReset} className="h-9 px-4">
        Reset filters
      </Button>
    </div>
  );
}

/** Some sources answered, some did not. Results from the ones that did are still shown below. */
export function PartialBanner({ failures, shown, onRetry }: { failures: SourceFailure[]; shown: number; onRetry: () => void }) {
  return (
    <div role="status" className="flex flex-col justify-between gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {failures.length} {failures.length === 1 ? "source" : "sources"} did not respond
          </p>
          <p className="text-xs text-muted-foreground">
            {failures.map((f) => `${f.label} (${f.reason.toLowerCase()})`).join("; ")}. Showing {shown} result{shown === 1 ? "" : "s"} from the others.
          </p>
        </div>
      </div>
      <Button variant="secondary" onClick={onRetry} className="h-9 shrink-0 gap-1.5 self-start px-3 sm:self-auto">
        <RefreshCw className="size-3.5" />
        Retry sources
      </Button>
    </div>
  );
}
