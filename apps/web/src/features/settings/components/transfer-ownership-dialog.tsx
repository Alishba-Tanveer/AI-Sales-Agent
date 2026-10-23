"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Loader2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logoutUser } from "@/features/auth/api";
import { transferOwnership } from "../api";
import type { TeamMember } from "../types";
import { PersonAvatar, TONES } from "./settings-ui";

/**
 * The Owner picks someone from the team and presses the button. The server makes that person the Owner and this
 * person an Admin and revokes this person's sessions, so after a short confirmation the app signs them out. When they
 * sign in again they are an Admin. The new Owner can hand ownership back or to anyone else the same way.
 */
export function TransferOwnershipDialog({
  open,
  onOpenChange,
  candidates,
  initialId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Active members who can receive ownership (not the Owner, not pending invites). */
  candidates: TeamMember[];
  /** Pre-selected member, when opened from a row's menu or role dropdown. */
  initialId?: string | null;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneName, setDoneName] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedId(initialId && candidates.some((m) => m.id === initialId) ? initialId : null);
    setError(null);
    setBusy(false);
    setDoneName(null);
    // only when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selected = candidates.find((m) => m.id === selectedId) ?? null;

  const close = (o: boolean) => {
    if (busy || doneName) return; // can't be dismissed while the transfer runs or the sign-out is pending
    onOpenChange(o);
  };

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await transferOwnership(selected.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not transfer ownership. Please try again.");
      setBusy(false);
      return;
    }
    // Done on the server: this person's sessions are already revoked. Show the result for a moment, then sign out.
    setDoneName(selected.name);
    window.setTimeout(async () => {
      await logoutUser();
      router.replace("/login");
    }, 2200);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" showCloseButton={!busy && !doneName}>
        {doneName ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className={cn("flex size-11 items-center justify-center rounded-full border", TONES.success.tile)}>
              <Check className="size-5" />
            </span>
            <div className="space-y-1">
              <DialogTitle className="text-base font-semibold text-foreground">{doneName} is now the Owner</DialogTitle>
              <DialogDescription className="leading-relaxed">You are now an Admin. Signing you out… sign in again to continue.</DialogDescription>
            </div>
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3 pr-8">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border", TONES.primary.tile)}>
                  <Crown className="size-[18px]" />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <DialogTitle className="text-base font-semibold text-foreground">Transfer ownership</DialogTitle>
                  <DialogDescription className="leading-relaxed">Choose who becomes the Owner of this workspace.</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {candidates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                There is nobody to hand ownership to yet. Invite someone and let them accept first; ownership can only go to an active team member.
              </p>
            ) : (
              <div role="radiogroup" aria-label="New Owner" className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-0.5">
                {candidates.map((m) => {
                  const on = m.id === selectedId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={busy}
                      onClick={() => setSelectedId(m.id)}
                      className={cn(
                        "group flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-background p-3 text-left outline-none transition-all duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
                        on ? "border-primary bg-primary-soft/60" : "border-border hover:border-primary/40 hover:bg-muted/60",
                      )}
                    >
                      <PersonAvatar name={m.name} id={m.id} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-foreground">{m.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{m.email} · {m.role}</span>
                      </span>
                      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent")}>
                        <Check className="size-3" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-xs leading-relaxed text-warning">
              You will be signed out right away. When you sign in again you will be an Admin, and {selected ? selected.name : "the person you choose"} will have the Owner controls (usage limits, ownership, deleting the workspace). Only the Owner can give ownership back.
            </div>

            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

            <DialogFooter>
              <Button variant="outline" disabled={busy} onClick={() => close(false)}>Cancel</Button>
              <Button disabled={!selected || busy} onClick={submit} className="gap-1.5 font-semibold">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Crown className="size-4" />}
                Transfer ownership
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
