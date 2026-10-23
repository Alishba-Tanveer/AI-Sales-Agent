"use client";

import { useState } from "react";
import { ArchiveRestore, Loader2, UserX } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listRemoved, restoreMember } from "../api";
import { useLoad } from "../use-load";
import type { RemovedMember } from "../types";
import { TabError, TabLoading } from "./load-states";
import { Pill, initials } from "./settings-ui";

const dateText = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/**
 * "Recently removed": people who deleted their own account or were removed by an admin, still inside the 30 day
 * window. Owners and Admins can restore them (same role as before); after the deadline they are permanently deleted.
 * The Owner never appears here: when the Owner deletes their account the whole workspace is deactivated.
 */
export function RemovedMembers({ onRestored }: { onRestored: () => void }) {
  const { state, reload, set } = useLoad(listRemoved);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (state.status === "loading") return <TabLoading label="Loading removed accounts…" />;
  if (state.status === "error") return <TabError message={state.message} onRetry={reload} />;
  const rows = state.data;

  const restore = async (m: RemovedMember) => {
    setBusyId(m.id);
    try {
      const res = await restoreMember(m.id);
      toast.success(res.message ?? `${m.name} was restored. They can sign in again.`);
      set(rows.filter((r) => r.id !== m.id));
      onRestored();
    } catch (e) {
      // e.g. the email was invited again or registered elsewhere in the meantime: the server explains why
      toast.error(e instanceof Error ? e.message : "Could not restore this account.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="removed-heading">
      <div>
        <h3 id="removed-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ArchiveRestore className="size-4 text-primary" />
          Recently removed
          {rows.length > 0 && <Pill tone="muted">{rows.length}</Pill>}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Removed or deleted accounts can be restored for 30 days. After that they are permanently deleted.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card py-8 text-xs text-muted-foreground">
          <UserX className="size-4" />
          No removed accounts right now.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table className="min-w-[720px]">
            <TableHeader className="bg-background">
              <TableRow className="hover:bg-transparent">
                {["Member", "Role", "Removed", "Time left"].map((h) => (
                  <TableHead key={h} className="px-4 text-xs font-medium tracking-wider text-muted-foreground uppercase first:px-5">{h}</TableHead>
                ))}
                <TableHead className="px-5 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => {
                const left = Math.max(0, m.daysLeft);
                const urgent = left <= 3;
                return (
                  <TableRow key={m.id} className="h-14">
                    <TableCell className="px-5 py-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-xs font-semibold text-muted-foreground">
                          {initials(m.name)}
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium text-foreground">{m.name}</span>
                          <span className="truncate text-xs text-muted-foreground">{m.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2 text-xs text-foreground">{m.role}</TableCell>
                    <TableCell className="px-4 py-2">
                      <div className="flex flex-col text-xs">
                        <span className="text-foreground">{m.reason === "SELF" ? "Deleted their own account" : `Removed by ${m.removedBy ?? "an admin"}`}</span>
                        <span className="text-muted-foreground">{dateText(m.removedAt)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", urgent ? "border-destructive/30 bg-destructive-soft text-destructive" : "border-border bg-secondary text-muted-foreground")}>
                        {left === 0 ? "Deletes today" : `${left} day${left === 1 ? "" : "s"} left`}
                      </span>
                    </TableCell>
                    <TableCell className="px-5 py-2 text-right">
                      <Button variant="outline" className="h-8 gap-1.5 px-3 text-xs" disabled={busyId !== null || !m.canRestore} title={m.canRestore ? undefined : "They deleted their own account; it can only be restored by signing in again."} onClick={() => restore(m)}>
                        {busyId === m.id ? <Loader2 className="size-3.5 animate-spin" /> : <ArchiveRestore className="size-3.5" />}
                        Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
