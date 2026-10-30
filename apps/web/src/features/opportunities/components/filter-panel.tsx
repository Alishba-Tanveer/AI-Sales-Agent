"use client";

import { useState } from "react";
import { CalendarClock, Check, Gauge, Globe, Layers, Loader2, Search, ShieldCheck, Tags, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptionSelect } from "@/components/ui/option-select";
import { cn } from "cn";
import { DEFAULT_FILTERS, KEYWORD_SUGGESTIONS, POSTED_OPTIONS, SOURCES, SOURCE_GROUP_LABEL, TYPE_META, TYPE_ORDER } from "../constants";
import { ink, tint } from "../format";
import type { PostedWithin, SearchFilters, SourceGroup } from "../types";

const GROUPS: SourceGroup[] = ["job_portal", "company_site", "registry"];
const MAX_KEYWORDS = 8;

function Pill({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={active ? { color: ink(color), backgroundColor: tint(color, 14), borderColor: tint(color, 45) } : undefined}
      className={cn(
        "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
        active ? "font-semibold" : "border-border bg-secondary/60 text-muted-foreground hover:border-foreground/25 hover:text-foreground",
      )}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: active ? color : "var(--muted-foreground)", opacity: active ? 1 : 0.4 }} aria-hidden />
      {children}
    </button>
  );
}

function SourceCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className="group flex min-w-0 cursor-pointer items-center gap-2 rounded-md py-0.5 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span className={cn("flex size-3.5 shrink-0 items-center justify-center rounded border transition-colors", checked ? "border-primary bg-primary text-primary-foreground" : "border-input group-hover:border-primary/50")}>
        {checked && <Check className="size-2.5" strokeWidth={3} />}
      </span>
      <span className={cn("truncate", checked ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </button>
  );
}

function Section({ icon: Icon, color, title, hint, children }: { icon: LucideIcon; color: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-md" style={{ backgroundColor: tint(color, 16), color: ink(color) }}>
          <Icon className="size-3" />
        </span>
        <h3 className="text-[11px] font-semibold tracking-wider text-foreground/80 uppercase">{title}</h3>
        {hint && <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function KeywordInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const t = raw.trim();
    setText("");
    if (!t || value.length >= MAX_KEYWORDS || value.some((v) => v.toLowerCase() === t.toLowerCase())) return;
    onChange([...value, t]);
  };
  const c = "#A78BFA";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input bg-background px-1.5 py-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 dark:bg-input/30">
        {value.map((k) => (
          <span key={k} className="inline-flex h-5 items-center gap-0.5 rounded pr-0.5 pl-1.5 text-[11px] font-medium" style={{ color: ink(c), backgroundColor: tint(c, 15) }}>
            {k}
            <button type="button" aria-label={`Remove ${k}`} onClick={() => onChange(value.filter((v) => v !== k))} className="cursor-pointer rounded-sm p-0.5 hover:bg-foreground/10">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id="filter-keywords"
          value={text}
          placeholder={value.length ? "" : "e.g. AI agents"}
          aria-label="Add keyword"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(text);
            }
            if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => add(text)}
          className="h-5 min-w-[70px] flex-1 bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {KEYWORD_SUGGESTIONS.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).map((s) => (
          <button key={s} type="button" onClick={() => add(s)} className="cursor-pointer rounded border border-dashed border-border px-1.5 py-px text-[11px] text-muted-foreground transition-colors hover:border-[#A78BFA]/60 hover:text-foreground">
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FilterPanel({ filters, onChange, onSearch, searching }: { filters: SearchFilters; onChange: (f: SearchFilters) => void; onSearch: () => void; searching: boolean }) {
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const canSearch = filters.sourceIds.length > 0 && filters.types.length > 0 && !searching;

  return (
    <aside aria-label="Search filters" className="w-full shrink-0 overflow-hidden rounded-xl border border-border bg-card lg:sticky lg:top-20 lg:w-[280px]">
      <div className="flex flex-col gap-4 p-4">
        <Section icon={Tags} color="#A78BFA" title="Keywords" hint={`${filters.keywords.length}/${MAX_KEYWORDS}`}>
          <KeywordInput value={filters.keywords} onChange={(keywords) => onChange({ ...filters, keywords })} />
        </Section>

        <Section icon={Globe} color="#38BDF8" title="Sources" hint="Public only">
          <div className="flex flex-col gap-2.5">
            {GROUPS.map((g) => (
              <div key={g} className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">{SOURCE_GROUP_LABEL[g]}</span>
                <div className={cn("grid gap-x-3 gap-y-1", g === "job_portal" ? "grid-cols-2" : "grid-cols-1")}>
                  {SOURCES.filter((s) => s.group === g).map((s) => (
                    <SourceCheck key={s.id} label={s.label} checked={filters.sourceIds.includes(s.id)} onChange={() => onChange({ ...filters, sourceIds: toggle(filters.sourceIds, s.id) })} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={Layers} color="#34D399" title="Type">
          <div className="flex flex-wrap gap-1">
            {TYPE_ORDER.map((t) => (
              <Pill key={t} color="var(--primary)" active={filters.types.includes(t)} onClick={() => onChange({ ...filters, types: toggle(filters.types, t) })}>
                {TYPE_META[t].label}
              </Pill>
            ))}
          </div>
        </Section>

        <Section icon={Gauge} color="#FBBF24" title="Minimum match" hint={`≥ ${filters.minRelevance}%`}>
          <input
            id="filter-relevance"
            type="range"
            min={0}
            max={100}
            step={5}
            value={filters.minRelevance}
            aria-label="Minimum match percentage"
            onChange={(e) => onChange({ ...filters, minRelevance: Number(e.target.value) })}
            className="h-1 w-full cursor-pointer accent-[#FBBF24]"
          />
        </Section>

        <Section icon={CalendarClock} color="#F472B6" title="Posted">
          <OptionSelect aria-label="Posted within" value={filters.postedWithin} onValueChange={(v) => onChange({ ...filters, postedWithin: v as PostedWithin })} options={POSTED_OPTIONS} className="h-8 text-xs" />
        </Section>

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <Button size="lg" disabled={!canSearch} onClick={onSearch} className="w-full">
            {searching ? <Loader2 className="animate-spin" /> : <Search />}
            {searching ? "Searching…" : "Search opportunities"}
          </Button>
          {(filters.sourceIds.length === 0 || filters.types.length === 0) && <p className="text-xs text-warning">Pick at least one source and one type.</p>}
          <button type="button" onClick={() => onChange(DEFAULT_FILTERS)} className="cursor-pointer self-center text-xs text-muted-foreground transition-colors hover:text-foreground">
            Reset filters
          </button>
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
            <ShieldCheck className="mt-px size-3.5 shrink-0 text-[#34D399]" />
            Only public, permitted sources are read. LinkedIn is not scraped.
          </p>
        </div>
      </div>
    </aside>
  );
}
