import type { NavCounts, OverviewData } from "./types";

/**
 * MOCK DATA — mirrors the Stitch design.
 * The backend has no analytics/leads/approvals routes yet. Delete this file once
 * `GET /api/analytics/overview` and `GET /api/analytics/nav-counts` exist
 * (see features/overview/api.ts).
 */

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export function buildMockOverview(): OverviewData {
  return {
    metrics: {
      totalLeads: 1248,
      totalLeadsDelta: 114,
      newThisWeek: 86,
      newThisWeekDelta: 12,
      pendingApprovals: 12,
      replies: 47,
      replyRate: 13.7,
    },
    attention: [
      {
        id: "a1",
        kind: "reply",
        title: "Sarah Mitchell replied and is interested",
        subtitle: "BrightCart • Head of Operations • Replied 42m ago",
      },
      {
        id: "a2",
        kind: "approvals",
        title: "12 items are waiting for your approval",
        subtitle: "8 personalized emails, 4 LinkedIn outreach drafts",
      },
      {
        id: "a3",
        kind: "failure",
        title: "1 research job failed",
        subtitle: "Lumen Health: company domain SSL timeout during enrichment",
      },
    ],
    stages: [
      { stage: "new", count: 182 },
      { stage: "reviewed", count: 240 },
      { stage: "contacted", count: 342 },
      { stage: "interested", count: 47 },
      { stage: "won", count: 12 },
      { stage: "lost", count: 31 },
    ],
    activity: [
      { id: "r1", type: "draft", text: "AI draft created for Daniel Hughes (Northwind Dental)", at: minutesAgo(18) },
      { id: "r2", type: "reply", text: "Sarah Mitchell replied to outbound sequence", at: minutesAgo(42) },
      { id: "r3", type: "approved", text: "Priya Nair (ShipEasy Logistics) approved by Ahmed Khan", at: minutesAgo(120) },
      { id: "r4", type: "failed", text: "Enrichment failed for Lumen Health (retry queued)", at: minutesAgo(180) },
      { id: "r5", type: "lead_added", text: "Tom Becker added manually", at: minutesAgo(300) },
    ],
  };
}

export const emptyMockOverview: OverviewData = {
  metrics: {
    totalLeads: 0,
    totalLeadsDelta: 0,
    newThisWeek: 0,
    newThisWeekDelta: 0,
    pendingApprovals: 0,
    replies: 0,
    replyRate: 0,
  },
  attention: [],
  stages: [],
  activity: [],
};

export const mockNavCounts: NavCounts = { approvals: 12, activity: 2 };
