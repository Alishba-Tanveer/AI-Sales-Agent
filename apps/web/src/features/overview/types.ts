export type LeadStage = "new" | "reviewed" | "contacted" | "interested" | "won" | "lost";

export type OverviewMetrics = {
  totalLeads: number;
  /** change vs. previous 30 days (can be negative) */
  totalLeadsDelta: number;
  newThisWeek: number;
  /** change vs. previous week (can be negative) */
  newThisWeekDelta: number;
  pendingApprovals: number;
  replies: number;
  /** percentage, e.g. 13.7 */
  replyRate: number;
};

export type AttentionItem = {
  id: string;
  kind: "reply" | "approvals" | "failure";
  title: string;
  subtitle: string;
};

export type StageCount = { stage: LeadStage; count: number };

export type ActivityType = "draft" | "reply" | "approved" | "failed" | "lead_added";

export type ActivityItem = {
  id: string;
  type: ActivityType;
  text: string;
  /** ISO timestamp */
  at: string;
};

/**
 * Response shape the Overview page expects.
 * Proposed backend contract:  GET /api/analytics/overview  ->  { data: OverviewData }
 */
export type OverviewData = {
  metrics: OverviewMetrics;
  attention: AttentionItem[];
  stages: StageCount[];
  activity: ActivityItem[];
};

/**
 * Small counters for the sidebar pills.
 * Proposed backend contract:  GET /api/analytics/nav-counts  ->  { data: NavCounts }
 */
export type NavCounts = {
  approvals: number;
  activity: number;
};
