import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import { CARD_HOVER, ICON_POP, Pill, TONES, type PillTone, type Tone } from "@/features/settings/components/settings-ui";

export type StatusKind = "builtin" | "manual" | "planned" | "automated" | "setup";

const STATUS: Record<StatusKind, { label: string; tone: PillTone; dot?: string }> = {
  builtin: { label: "Built in", tone: "success", dot: "bg-success" },
  manual: { label: "Manual", tone: "info", dot: "bg-sky-500 dark:bg-sky-400" },
  planned: { label: "Planned", tone: "violet" },
  automated: { label: "Automated", tone: "success", dot: "bg-success" },
  setup: { label: "Not connected", tone: "warning" },
};

export function StatusPill({ kind }: { kind: StatusKind }) {
  const s = STATUS[kind];
  return (
    <Pill tone={s.tone} className="h-6 gap-1.5 rounded-full px-2.5 text-xs font-medium">
      {s.dot && <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden />}
      {s.label}
    </Pill>
  );
}

/** One line inside a card's grey details box. */
export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="w-28 shrink-0 pt-0.5 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 text-sm text-foreground [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

export function IntegrationCard({
  icon: Icon,
  tone,
  title,
  subtitle,
  status,
  children,
  actions,
}: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  subtitle: string;
  status: StatusKind;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <article className={cn("group relative flex h-full min-w-0 flex-col gap-5 overflow-hidden rounded-xl border border-border bg-card p-6", CARD_HOVER)}>
      <div className={cn("absolute inset-x-0 top-0 h-0.5", TONES[tone].bar)} aria-hidden />
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-[10px] border", ICON_POP, TONES[tone].tile)}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <StatusPill kind={status} />
      </header>
      <div className="flex flex-col gap-2.5 rounded-lg bg-muted/50 px-4 py-3">{children}</div>
      {actions && <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">{actions}</div>}
    </article>
  );
}
