import { CloudOff, RefreshCw, Activity, CircleCheck, TriangleAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityTab } from "../types";

/** Loading placeholder with the same layout as the loaded page. */
export function ActivitySkeleton() {
  return (
    <div className="flex w-full flex-col gap-6" role="status" aria-label="Loading activity">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-10 w-full max-w-md rounded-lg" />
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Skeleton className="h-11 rounded-none" />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex h-14 items-center gap-4 border-t border-border px-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="hidden h-4 w-20 md:block" />
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActivityError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="my-8 flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-card p-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-destructive/30 bg-destructive-soft">
        <CloudOff className="size-6 text-destructive" />
      </div>
      <h3 className="text-base font-medium text-foreground">Failed to load activity</h3>
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

const EMPTY: Record<ActivityTab, { icon: typeof Activity; title: string; text: string }> = {
  all: { icon: Activity, title: "No activity yet", text: "When the AI agent researches leads, drafts emails or syncs LinkedIn, every job will show up here." },
  running: { icon: Loader2, title: "Nothing is running", text: "No background tasks are in progress right now." },
  failed: { icon: TriangleAlert, title: "No failed tasks", text: "Everything the agent tried has worked. Failures will appear here with the reason and a Retry action." },
  completed: { icon: CircleCheck, title: "No completed tasks yet", text: "Finished jobs will be listed here." },
};

export function ActivityEmpty({ tab }: { tab: ActivityTab }) {
  const { icon: Icon, title, text } = EMPTY[tab];
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-border bg-secondary">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
