"use client";

import { useState } from "react";
import { Plus, Save, X, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/* ---------- accent colors: only the theme's own colors ---------- */
// Full class names are written out so Tailwind can see them.
export const TONES = {
  primary: { text: "text-primary", tile: "border-primary/30 bg-primary-soft text-primary", bar: "bg-primary" },
  success: { text: "text-success", tile: "border-success/30 bg-success-soft text-success", bar: "bg-success" },
  warning: { text: "text-warning", tile: "border-warning/30 bg-warning-soft text-warning", bar: "bg-warning" },
  destructive: { text: "text-destructive", tile: "border-destructive/30 bg-destructive-soft text-destructive", bar: "bg-destructive" },
} as const;
export type Tone = keyof typeof TONES;

/* ---------- card ---------- */
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
    <section className={cn("relative flex flex-col gap-6 overflow-hidden rounded-xl border border-border bg-card p-6", className)}>
      <div className={cn("absolute inset-x-0 top-0 h-0.5", t.bar)} />
      <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2.5 text-base font-semibold text-foreground">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border", t.tile)}>
              <Icon className="size-[18px]" />
            </span>
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
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

export function SaveButton({ onClick, label = "Save Changes", icon: Icon = Save }: { onClick: () => void; label?: string; icon?: LucideIcon }) {
  return (
    <div className="flex items-center justify-end border-t border-border pt-4">
      <Button type="button" onClick={onClick} className="h-9 gap-1.5 px-5 text-sm font-semibold">
        <Icon className="size-[18px]" />
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
