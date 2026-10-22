"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TabLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-16 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function TabError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive-soft/40 px-6 py-12 text-center" role="alert">
      <TriangleAlert className="size-5 text-destructive" />
      <p className="text-sm text-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry}>Try again</Button>
    </div>
  );
}
