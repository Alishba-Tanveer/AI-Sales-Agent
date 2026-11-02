import type { Lead } from "@/features/leads/types";
import type { InboxItem } from "@/features/inbox/types";
import type { ActivityJob } from "@/features/activity/types";
import type { ContentScript, Lead as LinkedInLead } from "@/features/linkedin/types";

export type PeriodId = "today" | "7d" | "30d" | "all";

/** Each number on the page comes from one of these existing endpoints. If one fails, only its section shows "unavailable". */
export type SourceKey = "leads" | "inbox" | "activity" | "linkedinContent" | "linkedinLeads";

export const SOURCE_LABEL: Record<SourceKey, string> = {
  leads: "Leads",
  inbox: "Inbox",
  activity: "Agent activity",
  linkedinContent: "LinkedIn content",
  linkedinLeads: "LinkedIn connections",
};

/** What the page loads once. Switching the period only recalculates; it does not call the API again. */
export type RawAnalytics = {
  leads: Lead[] | null;
  /** total leads according to the API, so the page can say when the list it received was cut short */
  leadsTotal: number;
  inbox: InboxItem[] | null;
  jobs: ActivityJob[] | null;
  scripts: ContentScript[] | null;
  linkedinLeads: LinkedInLead[] | null;
  failed: SourceKey[];
  /** first error message, used when everything fails */
  firstError: string;
};

export type MetricFormat = "number" | "percent";

export type Metric = {
  key: string;
  label: string;
  /** null = not enough data to say (shown as a dash) */
  value: number | null;
  /** same number for the period before this one; null when there is no previous period (All time) */
  prev: number | null;
  format: MetricFormat;
  /** true when a smaller number is the good direction (Lost, Failed) */
  invert?: boolean;
  /** small colored dot in front of the label */
  color: string;
  /** shown instead of the change line, for "right now" numbers that have no previous period */
  note?: string;
};

export type MetricGroup = {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  metrics: Metric[];
  /** set when the section's data could not be loaded */
  unavailable?: string;
};

export type FunnelStep = { label: string; count: number; color: string };
export type ChartBucket = { label: string; value: number; hint: string };

export type AnalyticsView = {
  periodLabel: string;
  hasPrevious: boolean;
  groups: MetricGroup[];
  funnel: FunnelStep[];
  series: ChartBucket[];
  /** true when the workspace has nothing to report at all */
  empty: boolean;
  leadsCut: boolean;
};
