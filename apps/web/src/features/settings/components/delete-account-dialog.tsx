"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Check, Crown, Loader2, Trash2, UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logoutUser } from "@/features/auth/api";
import { currentRole } from "@/lib/permissions";
import { deleteAccount, listTeam } from "../api";
import type { TeamMember } from "../types";
import { PersonAvatar, Pill, TONES } from "./settings-ui";

/**
 * Delete account. Nobody types a password or the word DELETE: the person is signed in and is asked one clear question.
 *
 *   Admin / Member        "Delete your account?"  Yes -> signed out, No -> closes.
 *   Owner with a team     "What should happen to the business?"
 *                           Delete the whole business  -> one more Yes / No
 *                           Transfer ownership         -> pick a team member -> "Transfer & delete my account"
 *   Owner, nobody else    nobody to hand it to, so it is a plain Yes / No that deletes the business
 *
 * Every path ends the same way: the server signs the person out and they land on the sign-in page. Signing in again
 * within 30 days offers to restore.
 */
type Step = "confirm" | "choose" | "pick" | "confirm-workspace";

export function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const isOwner = currentRole() === "OWNER";
  const [step, setStep] = useState<Step>("confirm");
  const [team, setTeam] = useState<TeamMember[] | null>(null); // owner only: people who could take over
  const [teamError, setTeamError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // An Owner needs the team list to know which question to ask, so it loads as soon as the popup opens.
  useEffect(() => {
    if (!open || !isOwner) return;
    let cancelled = false;
    listTeam()
      .then((all) => !cancelled && setTeam(all.filter((m) => m.status === "Active" && m.role !== "Owner")))
      .catch((e) => !cancelled && setTeamError(e instanceof Error ? e.message : "Could not load your team."));
    return () => {
      cancelled = true;
    };
  }, [open, isOwner]);

  const reset = () => {
    setStep("confirm");
    setSelectedId(null);
    setError(null);
    setTeam(null);
    setTeamError(null);
  };

  const close = (o: boolean) => {
    if (busy) return;
    if (!o) reset();
    onOpenChange(o);
  };

  const submit = async (choice: { transferToId?: string; deleteWorkspace?: boolean } = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await deleteAccount(choice);
      toast.success(res.message);
      // the server already revoked this token; this just clears the local session
      await logoutUser();
      router.replace("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete your account.");
      setBusy(false);
    }
  };

  const hasTeam = !!team && team.length > 0;
  const waiting = isOwner && !team && !teamError;
  // Which screen is really showing. An Owner with nobody to hand over to skips the choice and goes straight to the plain confirm.
  const screen: Step = isOwner && hasTeam ? (step === "confirm" ? "choose" : step) : "confirm";

  const title =
    screen === "pick" ? "Choose the new Owner" : screen === "choose" ? "Delete account" : isOwner ? "Delete your workspace?" : "Delete your account?";

  const body =
    screen === "choose"
      ? "You are the Owner of this workspace, so you need to decide what happens to it."
      : screen === "pick"
        ? "They get full Owner rights. Then your own account is deleted and you are signed out."
        : isOwner
          ? `${hasTeam ? "Your whole team loses access, and everything" : "Everything"} (campaigns, leads and drafts) is deleted after 30 days. You can restore it within 30 days by signing in.`
          : "You can restore it within 30 days by signing in. After that it is gone for good.";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3 pr-8">
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border", screen === "pick" ? TONES.primary.tile : TONES.destructive.tile)}>
              {screen === "pick" ? <Crown className="size-[18px]" /> : <Trash2 className="size-[18px]" />}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <DialogTitle className="text-base font-semibold text-foreground">{title}</DialogTitle>
              <DialogDescription className="leading-relaxed">{body}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {waiting && (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking your team…
          </div>
        )}

        {/* Owner with a team: delete everything, or hand it over */}
        {screen === "choose" && (
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setStep("pick")}
              className="flex w-full cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3.5 text-left outline-none transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary-soft text-primary">
                <UserRoundCog className="size-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Transfer ownership</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">Give the business to a team member. Your team keeps working and only your own account is deleted.</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStep("confirm-workspace")}
              className="flex w-full cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3.5 text-left outline-none transition-colors hover:border-destructive/50 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-destructive-soft text-destructive">
                <Building2 className="size-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Delete the whole business</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">Everything is deleted for everyone on your team.</span>
              </span>
            </button>
          </div>
        )}

        {/* Owner chose "transfer": pick who takes over */}
        {screen === "pick" && team && (
          <ul role="radiogroup" aria-label="New Owner" className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {team.map((m) => {
              const on = selectedId === m.id;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={busy}
                    onClick={() => setSelectedId(m.id)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                      on ? "border-primary bg-primary-soft/40" : "border-border bg-background hover:border-primary/40",
                    )}
                  >
                    <PersonAvatar name={m.name} id={m.id} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="[overflow-wrap:anywhere] text-sm font-medium text-foreground">{m.name}</span>
                      <span className="[overflow-wrap:anywhere] text-xs text-muted-foreground">{m.email}</span>
                    </span>
                    <Pill tone="muted">{m.role}</Pill>
                    <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border-2", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/60")}>
                      {on && <Check className="size-2.5" strokeWidth={4} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {teamError && <p role="alert" className="text-xs text-destructive">{teamError}</p>}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

        {!waiting && (
          <DialogFooter>
            {screen === "choose" && (
              <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
            )}

            {screen === "pick" && (
              <>
                <Button variant="ghost" disabled={busy} onClick={() => { setStep("choose"); setError(null); }} className="gap-1.5">
                  <ArrowLeft className="size-4" /> Back
                </Button>
                <Button disabled={!selectedId || busy} onClick={() => selectedId && submit({ transferToId: selectedId })} className="gap-1.5 font-semibold">
                  {busy ? <Loader2 className="animate-spin" /> : <Crown />}
                  Transfer &amp; delete my account
                </Button>
              </>
            )}

            {(screen === "confirm" || screen === "confirm-workspace") && (
              <>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => (screen === "confirm-workspace" ? (setStep("confirm"), setError(null)) : close(false))}
                >
                  No
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy || (isOwner && !!teamError)}
                  onClick={() => submit(isOwner ? { deleteWorkspace: true } : {})}
                  className="gap-1.5"
                >
                  {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  Yes, delete
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
