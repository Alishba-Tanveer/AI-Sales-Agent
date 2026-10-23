import type { AppNotification } from "./types";

export type NotificationGroup = { label: "Today" | "Yesterday" | "Earlier"; items: AppNotification[] };

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Splits a newest-first list into Today / Yesterday / Earlier (empty groups are left out). */
export function groupByDay(list: AppNotification[], now: number): NotificationGroup[] {
  const today = startOfDay(now);
  const yesterday = today - 86_400_000;
  const groups: NotificationGroup[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Earlier", items: [] },
  ];
  for (const n of list) {
    const t = new Date(n.at).getTime();
    groups[t >= today ? 0 : t >= yesterday ? 1 : 2].items.push(n);
  }
  return groups.filter((g) => g.items.length > 0);
}

export function relativeTime(iso: string, now: number) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
