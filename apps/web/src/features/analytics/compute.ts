import { STAGE_META, hasBeenContacted } from "@/features/leads/stages";
import type { ActivityJob } from "@/features/activity/types";
import type { Lead } from "@/features/leads/types";
import type {
  AnalyticsView,
  ChartBucket,
  FunnelStep,
  Metric,
  MetricGroup,
  PeriodId,
  RawAnalytics,
} from "./types";

const DAY = 86_400_000;

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "all", label: "All time" },
];

/* ---------- time windows ---------- */

type Window = { start: number; end: number };
type Windows = { current: Window; previous: Window | null };

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Whole calendar days ending today, so the chart bars and the numbers always cover the same days. */
function windowsFor(period: PeriodId, now: number): Windows {
  const end = startOfDay(now) + DAY;
  if (period === "all") return { current: { start: Number.NEGATIVE_INFINITY, end }, previous: null };
  const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
  const start = end - days * DAY;
  return { current: { start, end }, previous: { start: start - days * DAY, end: start } };
}

const within = (iso: string | null | undefined, w: Window) => {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= w.start && t < w.end;
};

/* ---------- numbers for one window ---------- */

const sentOn = (l: Lead, channel: "EMAIL" | "LINKEDIN") => (l.sentChannels ?? []).includes(channel);
const wasContacted = (l: Lead) => hasBeenContacted(l.stage) || (l.sentChannels ?? []).length > 0;

/** People added in the window, and where each of them is now. */
function leadStats(leads: Lead[], replied: Set<string>, w: Window) {
  const cohort = leads.filter((l) => !l.archivedAt && within(l.createdAt, w));
  const contacted = cohort.filter(wasContacted);
  const count = (stage: Lead["stage"]) => cohort.filter((l) => l.stage === stage).length;
  return {
    added: cohort.length,
    contacted: contacted.length,
    interested: count("INTERESTED"),
    reachedInterest: count("INTERESTED") + count("WON"),
    won: count("WON"),
    lost: count("LOST"),
    emailed: cohort.filter((l) => sentOn(l, "EMAIL")).length,
    onLinkedIn: cohort.filter((l) => sentOn(l, "LINKEDIN")).length,
    replied: cohort.filter((l) => replied.has(l.id)).length,
    // reply rate is "of the people you contacted, how many answered"
    replyRate: contacted.length > 0 ? (cohort.filter((l) => replied.has(l.id) && wasContacted(l)).length / contacted.length) * 100 : null,
  };
}

function jobStats(jobs: ActivityJob[], w: Window) {
  const ran = jobs.filter((j) => within(j.startedAt, w));
  const completed = ran.filter((j) => j.status === "completed").length;
  const failed = ran.filter((j) => j.status === "failed").length;
  return {
    ran: ran.length,
    completed,
    failed,
    successRate: completed + failed > 0 ? (completed / (completed + failed)) * 100 : null,
  };
}

function linkedinStats(raw: RawAnalytics, w: Window) {
  return {
    requests: raw.linkedinLeads ? raw.linkedinLeads.filter((l) => within(l.sentAt, w)).length : null,
    connected: raw.linkedinLeads ? raw.linkedinLeads.filter((l) => within(l.connectedAt, w)).length : null,
    posts: raw.scripts ? raw.scripts.filter((s) => s.status === "posted" && !s.postDeleted && within(s.postedAt, w)).length : null,
  };
}

/* ---------- chart: people added over time ---------- */

const hourFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric" });
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" });
const monthLongFmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

function buildSeries(leads: Lead[], period: PeriodId, w: Window): ChartBucket[] {
  const dates = leads.filter((l) => !l.archivedAt).map((l) => Date.parse(l.createdAt)).filter(Number.isFinite);
  let start = w.start;
  let n = period === "today" ? 24 : period === "7d" ? 7 : 30;
  if (period === "all") {
    if (dates.length === 0) return [];
    start = startOfDay(Math.min(...dates));
    n = Math.max(1, Math.min(12, Math.ceil((w.end - start) / DAY)));
  }
  const width = (w.end - start) / n;
  const long = period === "all" && w.end - start > 90 * DAY;
  const counts = Array.from({ length: n }, () => 0);
  for (const t of dates) {
    if (t >= start && t < w.end) counts[Math.min(n - 1, Math.floor((t - start) / width))] += 1;
  }
  return counts.map((value, i) => {
    const at = new Date(start + i * width);
    const label = period === "today" ? hourFmt.format(at) : long ? monthFmt.format(at) : dayFmt.format(at);
    const isDaily = period !== "today" && !long;
    return {
      label,
      value,
      hint: `${label}: ${value} ${value === 1 ? "person" : "people"} added`,
      ...(isDaily ? { dayLabel: String(at.getDate()), monthLabel: monthLongFmt.format(at) } : {}),
    };
  });
}

/* ---------- build the whole page ---------- */

type Extra = Partial<Pick<Metric, "format" | "invert" | "note">>;

const m = (key: string, label: string, value: number | null, prev: number | null, color: string, extra: Extra = {}): Metric => ({ key, label, value, prev, color, format: "number", ...extra });

export function buildAnalytics(raw: RawAnalytics, period: PeriodId, now = Date.now()): AnalyticsView {
  const { current, previous } = windowsFor(period, now);
  const periodLabel = PERIODS.find((p) => p.id === period)?.label ?? "";
  const stage = STAGE_META;
  const primary = "var(--primary)";

  const replied = new Set((raw.inbox ?? []).map((i) => i.lead.id));
  const leadNow = raw.leads ? leadStats(raw.leads, replied, current) : null;
  const leadPrev = raw.leads && previous ? leadStats(raw.leads, replied, previous) : null;
  const inboxReady = raw.inbox !== null;

  /** value from this window, same number from the previous one (null when there is none) */
  const pick = <T,>(cur: T | null, before: T | null, f: (s: T) => number | null) => [cur ? f(cur) : null, before ? f(before) : null] as const;

  const lead = (key: string, label: string, color: string, f: (s: NonNullable<typeof leadNow>) => number | null, extra: Extra = {}) => {
    const [v, p] = pick(leadNow, leadPrev, f);
    return m(key, label, v, p, color, extra);
  };

  const groups: MetricGroup[] = [];

  groups.push({
    id: "leads",
    title: "Leads",
    subtitle: "People added in this period, and where they are now",
    color: primary,
    unavailable: raw.leads ? undefined : "Leads could not be loaded.",
    metrics: [
      lead("added", "Leads added", primary, (s) => s.added),
      lead("contacted", "Contacted", stage.CONTACTED.color, (s) => s.contacted),
      lead("interested", "Interested", stage.INTERESTED.color, (s) => s.interested),
      lead("won", "Won", stage.WON.color, (s) => s.won),
      lead("lost", "Lost", stage.LOST.color, (s) => s.lost, { invert: true }),
    ],
  });

  groups.push({
    id: "outreach",
    title: "Outreach",
    subtitle: "Who you messaged and who answered",
    color: "#38BDF8",
    unavailable: raw.leads ? undefined : "Leads could not be loaded.",
    metrics: [
      lead("emailed", "Emailed", "#38BDF8", (s) => s.emailed),
      lead("linkedin-msg", "Messaged on LinkedIn", "#818CF8", (s) => s.onLinkedIn),
      lead("replied", "Replied", "#4ADE80", (s) => (inboxReady ? s.replied : null)),
      lead("reply-rate", "Reply rate", "#FBBF24", (s) => (inboxReady ? s.replyRate : null), { format: "percent" }),
    ],
  });

  const jobNow = raw.jobs ? jobStats(raw.jobs, current) : null;
  const jobPrev = raw.jobs && previous ? jobStats(raw.jobs, previous) : null;
  const job = (key: string, label: string, color: string, f: (s: NonNullable<typeof jobNow>) => number | null, extra: Extra = {}) => {
    const [v, p] = pick(jobNow, jobPrev, f);
    return m(key, label, v, p, color, extra);
  };
  groups.push({
    id: "agent",
    title: "Agent activity",
    subtitle: "Background tasks your AI agents ran",
    color: "#A78BFA",
    unavailable: raw.jobs ? undefined : "Agent activity could not be loaded.",
    metrics: [
      job("ran", "Tasks run", "#A78BFA", (s) => s.ran),
      job("completed", "Completed", "#4ADE80", (s) => s.completed),
      job("failed", "Failed", "#F87171", (s) => s.failed, { invert: true }),
      job("success", "Success rate", "#FBBF24", (s) => s.successRate, { format: "percent" }),
    ],
  });

  const liNow = linkedinStats(raw, current);
  const liPrev = previous ? linkedinStats(raw, previous) : null;
  const awaiting = raw.scripts ? raw.scripts.filter((s) => s.status === "needs_approval").length : null;
  const unavailable = [raw.linkedinLeads ? null : "connections", raw.scripts ? null : "posts"].filter(Boolean);
  groups.push({
    id: "linkedin",
    title: "LinkedIn",
    subtitle: "Connections and content",
    color: "#818CF8",
    unavailable: unavailable.length === 2 ? "LinkedIn data could not be loaded." : undefined,
    metrics: [
      m("li-requests", "Requests sent", liNow.requests, liPrev?.requests ?? null, "#38BDF8"),
      m("li-connected", "New connections", liNow.connected, liPrev?.connected ?? null, "#4ADE80"),
      m("li-posts", "Posts published", liNow.posts, liPrev?.posts ?? null, "#818CF8"),
      m("li-awaiting", "Scripts to approve", awaiting, null, "#FBBF24", { note: "Right now" }),
    ],
  });

  const funnel: FunnelStep[] = leadNow
    ? [
        { label: "Added", count: leadNow.added, color: stage.NEW.color },
        { label: "Contacted", count: leadNow.contacted, color: stage.CONTACTED.color },
        { label: "Showed interest", count: leadNow.reachedInterest, color: stage.INTERESTED.color },
        { label: "Won", count: leadNow.won, color: stage.WON.color },
      ]
    : [];

  const series = raw.leads ? buildSeries(raw.leads, period, current) : [];

  const totalLeads = raw.leads?.length ?? 0;
  const empty =
    raw.failed.length === 0 &&
    totalLeads === 0 &&
    (raw.inbox?.length ?? 0) === 0 &&
    (raw.jobs?.length ?? 0) === 0 &&
    (raw.scripts?.length ?? 0) === 0 &&
    (raw.linkedinLeads?.length ?? 0) === 0;

  return {
    periodLabel,
    hasPrevious: previous !== null,
    groups,
    funnel,
    series,
    empty,
    leadsCut: !!raw.leads && raw.leadsTotal > raw.leads.length,
  };
}

/* ---------- change vs the previous period ---------- */

export type Change = { text: string; tone: "success" | "destructive" | "muted" };

export function changeOf(metric: Metric): Change | null {
  const { value, prev, format, invert } = metric;
  if (value === null || prev === null) return null;
  const tone = (diff: number): Change["tone"] => (diff === 0 ? "muted" : (diff > 0) !== !!invert ? "success" : "destructive");

  if (format === "percent") {
    const diff = Math.round((value - prev) * 10) / 10;
    if (diff === 0) return { text: "No change", tone: "muted" };
    return { text: `${diff > 0 ? "+" : "−"}${Math.abs(diff).toFixed(1)} pts`, tone: tone(diff) };
  }
  if (value === prev) return { text: "No change", tone: "muted" };
  if (prev === 0) return { text: `+${value.toLocaleString("en-US")} new`, tone: tone(1) };
  const pct = ((value - prev) / prev) * 100;
  return { text: `${pct > 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`, tone: tone(pct) };
}

export const formatValue = (metric: Metric) =>
  metric.value === null ? "Not available" : metric.format === "percent" ? `${metric.value.toFixed(1)}%` : metric.value.toLocaleString("en-US");

/* ---------- CSV export ---------- */

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export function toCsv(view: AnalyticsView) {
  const rows: (string | number)[][] = [["Section", "Metric", view.periodLabel, view.hasPrevious ? "Previous period" : ""]];
  for (const g of view.groups) {
    for (const metric of g.metrics) {
      const fmt = (n: number | null) => (n === null ? "" : metric.format === "percent" ? `${n.toFixed(1)}%` : n);
      rows.push([g.title, metric.label, fmt(metric.value), view.hasPrevious ? fmt(metric.prev) : ""]);
    }
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
