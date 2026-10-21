import {
  prisma,
  ApprovalStatus,
  LeadStage,
} from "@ai-sales-agent/database";

export class AnalyticsService {
  async getNavCounts(organizationId: string) {
    const [pendingApprovals, failedOrRetryingActivity, unreadNotifications] =
      await Promise.all([
        prisma.approvalItem.count({
          where: { organizationId, status: ApprovalStatus.PENDING },
        }),
        prisma.activityLog.count({
          where: {
            organizationId,
            status: { in: ["failed", "retrying"] },
          },
        }),
        prisma.inAppNotification.count({
          where: { organizationId, read: false },
        }),
      ]);

    return {
      approvals: pendingApprovals,
      activity: failedOrRetryingActivity,
      notifications: unreadNotifications,
    };
  }

  async getOverview(organizationId: string) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalLeads,
      newThisWeek,
      pendingApprovals,
      recentActivity,
      failedJobsCount,
      stageGroups,
    ] = await Promise.all([
      prisma.lead.count({ where: { organizationId } }),
      prisma.lead.count({
        where: { organizationId, createdAt: { gte: oneWeekAgo } },
      }),
      prisma.approvalItem.count({
        where: { organizationId, status: ApprovalStatus.PENDING },
      }),
      prisma.activityLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
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
      stageGroups.map((g) => [g.stage, g._count._all])
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

    if (pendingApprovals > 0) {
      attention.push({
        id: "att-approvals",
        kind: "approvals",
        title: `${pendingApprovals} item(s) waiting for your approval`,
        subtitle: "Review queued AI outreach drafts in the Approvals queue",
      });
    }

    if (failedJobsCount > 0) {
      attention.push({
        id: "att-failures",
        kind: "failure",
        title: `${failedJobsCount} background job(s) failed`,
        subtitle: "Open the Activity page to inspect and retry failed jobs",
      });
    }

    const activity = recentActivity.map((a) => {
      const normalizedType =
        a.type === "draft" ||
        a.type === "reply" ||
        a.type === "approved" ||
        a.type === "failed" ||
        a.type === "lead_added"
          ? a.type
          : a.status === "failed"
          ? "failed"
          : "draft";
      return {
        id: a.id,
        type: normalizedType,
        text: a.text,
        at: a.createdAt.toISOString(),
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
      metrics: {
        totalLeads,
        totalLeadsDelta: newThisWeek,
        newThisWeek,
        newThisWeekDelta: newThisWeek,
        pendingApprovals,
        replies: repliesCount,
        replyRate,
      },
      attention,
      stages,
      activity,
    };
  }
}
