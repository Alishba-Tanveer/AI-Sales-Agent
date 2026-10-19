import Link from "next/link";
import { Compass, CloudOff, RefreshCw, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";

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

/** Brand-new workspace: no leads, nothing happened yet. */
export function OverviewEmpty() {
  return (
    <div className="my-8 flex flex-col items-center justify-center rounded-xl border border-border bg-card p-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-border bg-secondary">
        <Compass className="size-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-medium text-foreground">No pipeline activity yet</h3>
      <p className="mt-1 mb-6 max-w-sm text-sm text-muted-foreground">
        Connect your target criteria or run a discovery session to let the AI agent identify prospects.
      </p>
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
