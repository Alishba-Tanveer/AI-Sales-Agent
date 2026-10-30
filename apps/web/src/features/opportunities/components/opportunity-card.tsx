import Link from "next/link";
import { Briefcase, Building2, Check, CircleCheck, ExternalLink, Info, Landmark, Loader2, Sparkles, MapPin, RotateCcw, UserPlus, Wallet, X, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { SOURCES, TOP_MATCH, TYPE_META } from "../constants";
import { initials, ink, isNew, postedLabel, tint } from "../format";
import type { Opportunity, SourceGroup } from "../types";

const GROUP_ICON: Record<SourceGroup, LucideIcon> = { job_portal: Briefcase, company_site: Building2, registry: Landmark };

const chip = "inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[11px] font-medium";

export function OpportunityCard({
  item,
  accent,
  now,
  busy,
  onSave,
  onDismiss,
  onRestore,
}: {
  item: Opportunity;
  /** Theme colour of this card (stripe + avatar). Chosen by the page so neighbours differ. */
  accent: string;
  now: number;
  busy: boolean;
  onSave: (o: Opportunity) => void;
  onDismiss: (o: Opportunity) => void;
  onRestore: (o: Opportunity) => void;
}) {
  const dismissed = item.status === "dismissed";
  const saved = item.status === "saved";
  const type = TYPE_META[item.type];
  const group = SOURCES.find((s) => s.id === item.sourceId)?.group ?? "job_portal";
  const SourceIcon = GROUP_ICON[group];

  return (
    <article
      aria-label={item.title}
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 pl-5 transition-all",
        dismissed ? "opacity-60" : "hover:-translate-y-px hover:shadow-lg hover:shadow-black/10",
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: accent }} aria-hidden />
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
            style={{ backgroundColor: tint(accent, 16), color: ink(accent) }}
            aria-hidden
          >
            {initials(item.company)}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className={cn("text-[15px] leading-snug font-semibold text-foreground", dismissed && "line-through")}>{item.title}</h3>
              <span className={cn(chip, "border-border bg-secondary text-muted-foreground")}>
                {type.label}
              </span>
              {item.relevance >= TOP_MATCH && !dismissed && (
                <span className={chip} style={{ color: ink(accent), backgroundColor: tint(accent, 14), borderColor: tint(accent, 35) }}>
                  <Sparkles className="size-3" />
                  Top match
                </span>
              )}
              {isNew(item, now) && <span className={cn(chip, "border-primary/30 bg-primary text-primary-foreground")}>New</span>}
              {saved && (
                <span className={cn(chip, "border-success/30 bg-success-soft text-success")}>
                  <Check className="size-3" />
                  Saved as lead
                </span>
              )}
              {dismissed && <span className={cn(chip, "border-destructive/30 bg-destructive-soft text-destructive")}>Dismissed</span>}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/85">{item.company}</span>
              <span className="inline-flex items-center gap-1">
                <SourceIcon className="size-3.5" />
                {item.sourceLabel}
              </span>
              <span>{postedLabel(item.postedAt, now)}</span>
              {item.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {item.location}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1 self-start md:w-32" title="How closely this matches your niche and ideal customer">
          <div className="flex items-baseline justify-between">
            <span className="text-lg leading-none font-bold tabular-nums" style={{ color: ink(accent) }}>
              {item.relevance}
              <span className="text-[11px] font-medium text-muted-foreground">/100</span>
            </span>
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Match</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: tint(accent, 18) }} role="presentation">
            <div className="h-full rounded-full" style={{ width: `${item.relevance}%`, backgroundColor: accent }} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg bg-background/60 px-3.5 py-3 ring-1 ring-border">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Intent signals</span>
        <p className="text-[13px] leading-relaxed text-foreground">{item.signals}</p>
        {(item.budget || item.type === "job_posting") && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            {item.budget && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: ink(accent) }}>
                <Wallet className="size-3.5" />
                {item.budget}
              </span>
            )}
            {item.type === "job_posting" && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="size-3.5 shrink-0" />
                Job postings follow the portal’s own application process.
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {dismissed ? (
            <Button variant="destructive" size="lg" disabled={busy} onClick={() => onRestore(item)}>
              {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              Restore
            </Button>
          ) : (
            <>
              {saved ? (
                item.leadId ? (
                  <Link href={`/leads/${item.leadId}`} className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "text-success")}>
                    <CircleCheck />
                    View lead
                  </Link>
                ) : (
                  <Button variant="secondary" size="lg" disabled>
                    <CircleCheck />
                    Saved
                  </Button>
                )
              ) : (
                <Button size="lg" disabled={busy} onClick={() => onSave(item)}>
                  {busy ? <Loader2 className="animate-spin" /> : <UserPlus />}
                  Save as Lead
                </Button>
              )}
              {!saved && (
                <Button variant="ghost" size="lg" disabled={busy} onClick={() => onDismiss(item)} className="text-muted-foreground">
                  <X />
                  Dismiss
                </Button>
              )}
            </>
          )}
        </div>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "text-muted-foreground")}>
          Open source
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </article>
  );
}
