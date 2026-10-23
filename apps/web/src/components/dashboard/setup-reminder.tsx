"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getSetupStatus, markSetupReminderSeen, setupReminderSeen } from "@/features/onboarding/status";
import { currentRole } from "@/lib/permissions";

type Section = ReturnType<typeof getSetupStatus>["sections"][number];

/**
 * Shown once per login on the dashboard while any setup detail is still empty.
 * It sends the person to the Settings tab that holds the missing details.
 * Only the workspace Owner sees it: Admins and Members can't be asked to finish the owner's setup.
 */
export function SetupReminder() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    if (currentRole() !== "OWNER") return;
    if (setupReminderSeen()) return;
    const status = getSetupStatus();
    if (!status.complete) {
      setSections(status.sections);
      setOpen(true);
    }
  }, []);

  const close = (o: boolean) => {
    if (!o) markSetupReminderSeen();
    setOpen(o);
  };

  const go = (tab: string) => {
    markSetupReminderSeen();
    setOpen(false);
    router.push(`/settings?tab=${tab}`);
  };

  const first = sections[0];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] sm:max-w-[480px]">
        <DialogHeader>
          {/* icon and heading share one row, icon on the left; pr-8 keeps the text clear of the close button */}
          <div className="flex items-center gap-3 pr-8">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-warning/30 bg-warning-soft text-warning">
              <ClipboardCheck className="size-5" />
            </span>
            <DialogTitle className="min-w-0 text-lg leading-snug">Complete your workspace details</DialogTitle>
          </div>
          <DialogDescription>
            A few details are still empty. Adding them helps the AI find the right leads and write better drafts.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex min-w-0 flex-col gap-2">
          {sections.map((s) => (
            <li key={s.tab}>
              <button
                type="button"
                onClick={() => go(s.tab)}
                className="group flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-primary/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{s.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed break-words text-muted-foreground">Missing: {s.missing.join(", ")}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>Remind me later</Button>
          {first && (
            <Button className="gap-1.5 font-semibold" onClick={() => go(first.tab)}>
              Go to {first.label}
              <ArrowRight className="size-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
