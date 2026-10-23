import { prisma, LeadStage, type ActivityLog } from "@ai-sales-agent/database";

export class AnalyticsService {
  async getNavCounts(organizationId: string) {
    const [runningActivity, pendingScripts] = await Promise.all([
      prisma.activityLog.count({
        where: {
          organizationId,
          status: "running",
        },
      }),
      prisma.linkedinScript.count({
        where: {
          organizationId,
          status: "needs_approval",
        },
      }),
    ]);

    return {
      data: {
        approvals: pendingScripts,
        activity: runningActivity,
      },
    };
  }

  async getOverview(organizationId: string) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalLeads,
      newThisWeek,
      pendingScripts,
      recentActivity,
      failedJobsCount,
      stageGroups,
    ] = await Promise.all([
      prisma.lead.count({ where: { organizationId } }),
      prisma.lead.count({
        where: { organizationId, createdAt: { gte: oneWeekAgo } },
      }),
      prisma.linkedinScript.count({
        where: { organizationId, status: "needs_approval" },
      }),
      prisma.activityLog.findMany({
        where: { organizationId },
        orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
        take: 10,
      }),
      prisma.activityLog.count({
        where: { organizationId, status: "failed" },
      }),
      prisma.lead.groupBy({
        by: ["stage"],
        where: { organizationId },
        _count: { _all: true },
      }),
    ]);

    const stageMap = new Map<LeadStage, number>(
      stageGroups.map((g: { stage: LeadStage; _count: { _all: number } }) => [g.stage, g._count._all])
    );

    const stages = [
      { stage: "new" as const, count: stageMap.get(LeadStage.NEW) ?? 0 },
      { stage: "reviewed" as const, count: stageMap.get(LeadStage.REVIEWED) ?? 0 },
      { stage: "contacted" as const, count: stageMap.get(LeadStage.CONTACTED) ?? 0 },
      { stage: "interested" as const, count: stageMap.get(LeadStage.INTERESTED) ?? 0 },
      { stage: "won" as const, count: stageMap.get(LeadStage.WON) ?? 0 },
      { stage: "lost" as const, count: stageMap.get(LeadStage.LOST) ?? 0 },
    ];

    const attention: Array<{
      id: string;
      kind: "reply" | "approvals" | "failure";
      title: string;
      subtitle: string;
    }> = [];

    if (pendingScripts > 0) {
      attention.push({
        id: "att-approvals",
        kind: "approvals",
        title: `${pendingScripts} draft(s) waiting for your approval`,
        subtitle: "Review queued video scripts and outreach in Approvals",
      });
    }

    if (failedJobsCount > 0) {
      attention.push({
        id: "att-failures",
        kind: "failure",
        title: `${failedJobsCount} background task(s) failed`,
        subtitle: "Open the Activity page to inspect and retry failed tasks",
      });
    }

    const activity = recentActivity.map((a: ActivityLog) => {
      let type: "draft" | "reply" | "approved" | "failed" | "lead_added" = "draft";
      if (a.status === "failed") {
        type = "failed";
      } else if (a.kind === "discover" || a.kind === "enrich") {
        type = "lead_added";
      } else if (a.kind === "followup" || a.kind === "invite") {
        type = "reply";
      }

      return {
        id: a.id,
        type,
        text: a.title,
        at: (a.startedAt ?? a.createdAt).toISOString(),
      };
    });

    const repliesCount = stageMap.get(LeadStage.INTERESTED) ?? 0;
    const contactedTotal =
      (stageMap.get(LeadStage.CONTACTED) ?? 0) +
      repliesCount +
      (stageMap.get(LeadStage.WON) ?? 0);
    const replyRate =
      contactedTotal > 0
        ? Number(((repliesCount / contactedTotal) * 100).toFixed(1))
        : 0;

    return {
      data: {
        metrics: {
          totalLeads,
          totalLeadsDelta: newThisWeek,
          newThisWeek,
          newThisWeekDelta: newThisWeek,
          pendingApprovals: pendingScripts,
          replies: repliesCount,
          replyRate,
        },
        attention,
        stages,
        activity,
      },
    };
  }
}
