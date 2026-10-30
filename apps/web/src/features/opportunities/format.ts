import type { Opportunity, PostedWithin, SortKey } from "./types";

const HOUR = 3_600_000;

/** "Just now", "4 hours ago", "Yesterday", "3 days ago", "2 weeks ago". */
export function postedLabel(iso: string, now: number) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}

/** A fresh, untouched posting from the last 3 days gets a "New" tag. */
export const isNew = (o: Pick<Opportunity, "status" | "postedAt">, now: number) =>
  o.status === "open" && now - new Date(o.postedAt).getTime() < 72 * HOUR;

export const initials = (company: string) =>
  company
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

const WINDOW: Record<PostedWithin, number> = { any: Infinity, "24h": 24 * HOUR, "7d": 7 * 24 * HOUR, "30d": 30 * 24 * HOUR };
export const withinWindow = (iso: string, win: PostedWithin, now: number) => now - new Date(iso).getTime() <= WINDOW[win];

export function sortOpportunities(items: Opportunity[], sort: SortKey) {
  const copy = [...items];
  if (sort === "newest") return copy.sort((a, b) => +new Date(b.postedAt) - +new Date(a.postedAt));
  if (sort === "company") return copy.sort((a, b) => a.company.localeCompare(b.company));
  return copy.sort((a, b) => b.relevance - a.relevance);
}

export function exportOpportunitiesCsv(items: Opportunity[]) {
  const fields = ["title", "company", "type", "sourceLabel", "relevance", "budget", "location", "postedAt", "status", "url"] as const;
  const escape = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = [fields.join(","), ...items.map((o) => fields.map((f) => escape(o[f])).join(","))].join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = "opportunities.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Soft tint of any CSS colour. Works in light and dark mode. */
export const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;
/** Readable text colour for that hue on the current theme. */
export const ink = (color: string) => `color-mix(in srgb, ${color} 65%, var(--foreground))`;

/** Card accent colours, handed out by position in the list so two neighbouring cards never share one. */
export const CARD_ACCENTS = ["#818CF8", "#34D399", "#FBBF24", "#38BDF8", "#F472B6", "#FB923C"];
export const accentAt = (index: number) => CARD_ACCENTS[index % CARD_ACCENTS.length];
