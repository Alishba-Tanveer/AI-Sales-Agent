"use client";

import { cn } from "cn";
import { CheckCircle2, Info, Lightbulb, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CARD_LIFT, ICON_POP, TAB_HOVER, TONES, type Tone } from "@/features/settings/components/settings-ui";

/** Numbered steps cycle through the accent colors so each popup is colorful. */
const STEP_TONES: Tone[] = ["info", "violet", "warning", "primary", "success"];

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function IconTile({ icon: Icon, tone = "primary", className }: { icon: LucideIcon; tone?: Tone; className?: string }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", ICON_POP, TONES[tone].soft, className)}>
      <Icon className="size-4" />
    </span>
  );
}

export type StepDef = { label: string; hint?: string; count?: number; icon: LucideIcon; tone: Tone; done?: boolean };

/** Horizontal step strip used by Profile Optimizer (3 steps) and Content Engine (5 steps). */
export function StepStrip({ steps }: { steps: StepDef[] }) {
  return (
    <ol className={cn("grid gap-3", steps.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-5")}>
      {steps.map((s, i) => (
        <li key={s.label} className={cn("flex items-center gap-3 rounded-xl border border-border bg-card p-3", CARD_LIFT)}>
          <IconTile icon={s.icon} tone={s.tone} />
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground">
              Step {i + 1}
              {typeof s.count === "number" && <span className={cn("ml-2 font-semibold", TONES[s.tone].text)}>{s.count}</span>}
            </p>
            <p className="truncate text-sm font-semibold text-foreground transition-colors duration-200 group-hover:text-primary">{s.label}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex w-full items-center gap-1 overflow-x-auto border-b border-border whitespace-nowrap [scrollbar-width:none] sm:gap-2 [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "group -mb-px flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "border-primary font-semibold text-primary" : "border-transparent font-medium text-muted-foreground hover:text-foreground", !active && TAB_HOVER,
            )}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums", active ? "bg-primary-soft text-primary" : "bg-secondary text-muted-foreground")}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function fmtDate(iso?: string, withTime = false) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) });
}

/* ---------- Themed pop-ups shared by the three LinkedIn pages ---------- */

const TONE_ICON_DEFAULT: Record<Tone, LucideIcon> = { primary: Info, success: CheckCircle2, warning: TriangleAlert, destructive: TriangleAlert, info: Info, violet: Info };

/** Small "are you sure?" popup, used instead of acting straight away on anything that is hard to undo. */
export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel, cancelLabel = "Cancel", tone = "primary", icon, onConfirm, children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: Tone;
  icon?: LucideIcon;
  onConfirm: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3 pr-6">
            <IconTile icon={icon ?? TONE_ICON_DEFAULT[tone]} tone={tone} className="size-10" />
            <div className="grid gap-1.5">
              <DialogTitle className="text-base">{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{cancelLabel}</Button>
          <Button
            variant={tone === "destructive" ? "destructive" : "default"}
            className={tone === "success" ? "bg-success text-background hover:bg-success/85" : undefined}
            onClick={() => { onConfirm(); onOpenChange(false); }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "How this page works" popup with numbered steps. */
export function HowItWorksDialog({
  open, onOpenChange, title, description, steps, note, tone = "warning",
}: {
  tone?: Tone;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  steps: { title: string; text: string }[];
  note?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3 pr-6">
            <IconTile icon={Lightbulb} tone={tone} className="size-10" />
            <div className="grid gap-1.5">
              <DialogTitle className="text-base">{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <ol className="grid gap-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", TONES[STEP_TONES[i % STEP_TONES.length]].tile)}>{i + 1}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        {note && (
          <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-xs text-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0 text-warning" /> {note}
          </p>
        )}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A link that looks like a button and opens in a new tab. `onClick` runs before the tab opens (e.g. to copy text). */
export function LinkButton({
  href, children, variant = "default", size = "lg", className, onClick,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
  onClick?: () => void;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </a>
  );
}

export function fmtTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
