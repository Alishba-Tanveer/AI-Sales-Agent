"use client";

import { useState } from "react";
import { Loader2, Plus, Save, X, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/* ---------- accent colors: only the theme's own colors ---------- */
// Full class names are written out so Tailwind can see them.
export const TONES = {
  primary: { text: "text-primary", tile: "border-primary/30 bg-primary-soft text-primary", soft: "bg-primary-soft text-primary", bar: "bg-primary", btn: "border-primary/30 bg-primary-soft text-primary hover:bg-primary/20 hover:text-primary dark:border-primary/30 dark:bg-primary-soft dark:hover:bg-primary/20" },
  success: { text: "text-success", tile: "border-success/30 bg-success-soft text-success", soft: "bg-success-soft text-success", bar: "bg-success", btn: "border-success/30 bg-success-soft text-success hover:bg-success/20 hover:text-success dark:border-success/30 dark:bg-success-soft dark:hover:bg-success/20" },
  warning: { text: "text-warning", tile: "border-warning/30 bg-warning-soft text-warning", soft: "bg-warning-soft text-warning", bar: "bg-warning", btn: "border-warning/30 bg-warning-soft text-warning hover:bg-warning/20 hover:text-warning dark:border-warning/30 dark:bg-warning-soft dark:hover:bg-warning/20" },
  destructive: { text: "text-destructive", tile: "border-destructive/30 bg-destructive-soft text-destructive", soft: "bg-destructive-soft text-destructive", bar: "bg-destructive", btn: "border-destructive/30 bg-destructive-soft text-destructive hover:bg-destructive/20 hover:text-destructive dark:border-destructive/30 dark:bg-destructive-soft dark:hover:bg-destructive/20" },
  // sky + violet are the two Overview colors that have no theme token; they use the same hues (Tailwind sky/violet 400 in dark mode)
  info: {
    text: "text-sky-700 dark:text-sky-400",
    tile: "border-sky-500/30 bg-sky-100 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-400",
    soft: "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-400",
    bar: "bg-sky-500 dark:bg-sky-400",
    btn: "border-sky-500/30 bg-sky-100 text-sky-700 hover:bg-sky-200 hover:text-sky-800 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-400 dark:hover:bg-sky-400/25 dark:hover:text-sky-300",
  },
  violet: {
    text: "text-violet-700 dark:text-violet-400",
    tile: "border-violet-500/30 bg-violet-100 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/15 dark:text-violet-400",
    soft: "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-400",
    bar: "bg-violet-500 dark:bg-violet-400",
    btn: "border-violet-500/30 bg-violet-100 text-violet-700 hover:bg-violet-200 hover:text-violet-800 dark:border-violet-400/30 dark:bg-violet-400/15 dark:text-violet-400 dark:hover:bg-violet-400/25 dark:hover:text-violet-300",
  },
} as const;
export type Tone = keyof typeof TONES;

/* ---------- card ---------- */
// The Overview page's hover language, shared by Settings and LinkedIn:
//  CARD_HOVER  big panels      border turns primary, soft glow (Overview: Leads by stage, Recent activity)
//  CARD_LIFT   small tiles     same + rises 4px; add `group` children to scale icons / brighten text (Overview: metric cards)
//  CARD_INNER  boxes in panels border turns primary + row tint
//  CARD_ROW    list / table rows  muted tint (Overview: activity rows)
//  HOVER_BUTTONS  put on a page's root: every enabled button lifts 2px with a shadow, primary ones glow
//  TAB_HOVER   tab underline turns primary on hover
export const CARD_HOVER = "transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5";
export const CARD_LIFT = "group transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 motion-safe:hover:-translate-y-1";
export const CARD_INNER = "group transition-all duration-200 hover:border-primary/30 hover:bg-muted/60";
export const CARD_ROW = "group transition-colors duration-150 hover:bg-muted/60";
export const ICON_POP = "transition-transform duration-200 motion-safe:group-hover:scale-110";
export const HOVER_BUTTONS = [
  "[&_[data-slot=button]:enabled]:transition-all [&_[data-slot=button]:enabled]:duration-200",
  "motion-safe:[&_[data-slot=button]:enabled:hover]:-translate-y-0.5 [&_[data-slot=button]:enabled:hover]:shadow-md",
  "[&_[data-slot=button].bg-primary:enabled:hover]:shadow-lg [&_[data-slot=button].bg-primary:enabled:hover]:shadow-primary/25",
].join(" ");
export const TAB_HOVER = "hover:border-primary/40";

export function SectionCard({
  icon: Icon,
  title,
  description,
  aside,
  children,
  className,
  tone = "primary",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
}) {
  const t = TONES[tone];
  return (
    <section className={cn("group/card relative flex flex-col gap-6 overflow-hidden rounded-xl border border-border bg-card p-6", CARD_HOVER, className)}>
      <div className={cn("absolute inset-x-0 top-0 h-0.5", t.bar)} />
      <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2.5 text-base font-semibold text-foreground">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border transition-transform duration-200 motion-safe:group-hover/card:scale-110", t.tile)}>
              <Icon className="size-[18px]" />
            </span>
            {title}
          </h2>
          {description && <p className="mt-2 pl-[42px] text-xs leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/* ---------- pills ---------- */
const pillTone = {
  primary: "border-primary/30 bg-primary-soft text-primary",
  success: "border-success/30 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  destructive: "border-destructive/30 bg-destructive-soft text-destructive",
  info: "border-sky-500/30 bg-sky-100 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-400",
  violet: "border-violet-500/30 bg-violet-100 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/15 dark:text-violet-400",
  muted: "border-border bg-secondary text-muted-foreground",
} as const;
export type PillTone = keyof typeof pillTone;

export function Pill({
  tone = "muted",
  className,
  children,
}: {
  tone?: PillTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold",
        pillTone[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- form bits ---------- */
export const inputCls = "h-10 text-sm md:text-sm";
export const selectCls =
  "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground";

export function Field({
  label,
  htmlFor,
  aside,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        checked ? "bg-primary" : "bg-border",
        disabled ? "cursor-not-allowed opacity-75" : "cursor-pointer",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-background shadow transition-transform duration-200",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

/** `busy` = a save is in flight: the button is disabled and shows a spinner. */
export function SaveButton({ onClick, label = "Save Changes", icon, busy }: { onClick: () => void; label?: string; icon?: LucideIcon; busy?: boolean }) {
  const Icon = busy ? Loader2 : (icon ?? Save);
  return (
    <div className="flex items-center justify-end border-t border-border pt-4">
      <Button type="button" onClick={onClick} disabled={busy} className="h-9 gap-1.5 px-5 text-sm font-semibold">
        <Icon className={cn("size-[18px]", busy && "animate-spin")} />
        {label}
      </Button>
    </div>
  );
}

/** Number box that only commits (and clamps) on blur, so people can clear and retype it. */
export function NumberField({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
}) {
  const [text, setText] = useState(String(value));
  const commit = () => {
    const n = Math.min(max, Math.max(min, Math.round(Number(text)) || min));
    setText(String(n));
    onChange(n);
  };
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={label}
      min={min}
      max={max}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur())}
      className="h-10 w-20 rounded-lg border border-input bg-card px-3 text-center text-xl font-semibold text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    />
  );
}

/* ---------- tag chips with an inline "+ Add" ---------- */
export function TagGroup({
  label,
  tags,
  onChange,
  addLabel,
  placeholder,
}: {
  label: string;
  tags: string[];
  onChange: (t: string[]) => void;
  addLabel: string;
  placeholder: string;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");

  const commit = () => {
    const t = text.trim();
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...tags, t]);
    setText("");
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft px-3 py-1 text-[11px] font-medium text-primary"
          >
            {t}
            <button
              type="button"
              aria-label={`Remove ${t}`}
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="rounded-full outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {adding ? (
          <input
            autoFocus
            value={text}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setText("");
                setAdding(false);
              }
            }}
            className="h-7 min-w-40 rounded-full border border-primary bg-card px-3 text-xs text-foreground outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Plus className="size-3.5" />
            {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}


/* ---------- one color per person (theme colors only) ---------- */
// Red is left out on purpose: it already means "danger" everywhere else in the app.
const PERSON_TONES: Tone[] = ["primary", "success", "warning", "info", "violet"];

/** The same person always gets the same color, because it is picked from their id. */
export function personTone(key: string): Tone {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PERSON_TONES[h % PERSON_TONES.length];
}

/** Round avatar with the person's initials in their own color. */
export function PersonAvatar({ name, id, className }: { name?: string | null; id: string; className?: string }) {
  return (
    <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", ICON_POP, TONES[personTone(id)].tile, className)}>
      {initials(name)}
    </div>
  );
}
