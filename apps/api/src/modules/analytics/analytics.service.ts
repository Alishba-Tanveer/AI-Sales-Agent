import { prisma, LeadStage, type ActivityLog } from "@ai-sales-agent/database";

export class AnalyticsService {
  /**
   * Numbers for the sidebar pills. Every number means "needs you or is running right now", never a total:
   * activity / opportunities = tasks running, leads = new leads nobody has contacted, inbox = people whose last message
   * is a reply you have not answered, content = posts waiting for approval, connections = suggested LinkedIn contacts to review.
   */
  async getNavCounts(organizationId: string) {
    const [runningActivity, runningDiscover, newLeads, inbound, outbound, contentToApprove, connectionsToReview] = await Promise.all([
      prisma.activityLog.count({ where: { organizationId, status: "running" } }),
      prisma.activityLog.count({ where: { organizationId, status: "running", kind: "discover" } }),
      prisma.lead.count({ where: { organizationId, stage: LeadStage.NEW, archivedAt: null } }),
      prisma.leadCommunication.groupBy({
        by: ["leadId"],
        where: { organizationId, direction: "INBOUND", status: "RECEIVED", lead: { is: { archivedAt: null } } },
        _max: { occurredAt: true },
      }),
      prisma.leadCommunication.groupBy({
        by: ["leadId"],
        where: { organizationId, direction: "OUTBOUND", status: "SENT" },
        _max: { occurredAt: true },
      }),
      prisma.linkedinScript.count({ where: { organizationId, status: "needs_approval" } }),
      prisma.linkedinLead.count({ where: { organizationId, status: "suggested" } }),
    ]);

    const lastSent = new Map<string, number>();
    for (const row of outbound) if (row._max.occurredAt) lastSent.set(row.leadId, row._max.occurredAt.getTime());
    const awaitingReply = inbound.filter((row) => {
      const received = row._max.occurredAt?.getTime() ?? 0;
      return received > (lastSent.get(row.leadId) ?? 0);
    }).length;

    return {
      data: {
        activity: runningActivity,
        opportunities: runningDiscover,
        leads: newLeads,
        inbox: awaitingReply,
        content: contentToApprove,
        connections: connectionsToReview,
      },
    };
  }

  async getOverview(organizationId: string) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalLeads,
      newThisWeek,
      recentActivity,
      failedJobsCount,
      scheduledJobs,
      scheduledLinkedInPosts,
      unsentReplyDrafts,
      stageGroups,
    ] = await Promise.all([
      prisma.lead.count({ where: { organizationId } }),
      prisma.lead.count({
        where: { organizationId, createdAt: { gte: oneWeekAgo } },
      }),
      prisma.activityLog.findMany({
        where: { organizationId },
        orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
        take: 10,
      }),
      prisma.activityLog.count({
        where: { organizationId, status: "failed" },
      }),
      prisma.activityLog.count({ where: { organizationId, status: "queued", scheduledFor: { not: null } } }),
      // Keep this aligned with the LinkedIn Scheduled tab: ready posts and posts creating a video both count.
      prisma.linkedinScript.count({ where: { organizationId, status: { in: ["ready", "creating_video"] } } }),
      // Each pending draft links to its own lead conversation in the Inbox.
      prisma.leadCommunication.findMany({
        where: { organizationId, direction: "OUTBOUND", status: "DRAFT", lead: { is: { archivedAt: null } } },
        orderBy: { occurredAt: "desc" },
        select: { id: true, leadId: true, channel: true, lead: { select: { name: true, company: true } } },
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
      { stage: "contacted" as const, count: stageMap.get(LeadStage.CONTACTED) ?? 0 },
      { stage: "interested" as const, count: stageMap.get(LeadStage.INTERESTED) ?? 0 },
      { stage: "won" as const, count: stageMap.get(LeadStage.WON) ?? 0 },
      { stage: "lost" as const, count: stageMap.get(LeadStage.LOST) ?? 0 },
      { stage: "do_not_contact" as const, count: stageMap.get(LeadStage.DO_NOT_CONTACT) ?? 0 },
    ];

    const attention: Array<{
      id: string;
      kind: "reply" | "failure" | "scheduled" | "content";
      title: string;
      subtitle: string;
      href?: string;
    }> = [];

    if (failedJobsCount > 0) {
      attention.push({
        id: "att-failures",
        kind: "failure",
        title: `${failedJobsCount} background task(s) failed`,
        subtitle: "Open the Activity page to inspect and retry failed tasks",
      });
    }
    if (scheduledJobs > 0) attention.push({ id: "att-scheduled", kind: "scheduled", title: `${scheduledJobs} scheduled task(s)`, subtitle: "Review upcoming work in Activity" });
    if (scheduledLinkedInPosts > 0) attention.push({ id: "att-content", kind: "content", title: `${scheduledLinkedInPosts} content item(s) scheduled`, subtitle: "Review your upcoming LinkedIn posts and videos" });
    const draftLeadIds = new Set<string>();
    for (const draft of unsentReplyDrafts) {
      if (draftLeadIds.has(draft.leadId)) continue;
      draftLeadIds.add(draft.leadId);
      attention.push({
        id: `att-reply-${draft.leadId}`,
        kind: "reply",
        title: `Reply draft for ${draft.lead.name}`,
        subtitle: `${draft.channel === "EMAIL" ? "Email" : "LinkedIn"} reply is waiting for your review${draft.lead.company ? ` · ${draft.lead.company}` : ""}`,
        href: `/inbox?leadId=${encodeURIComponent(draft.leadId)}`,
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
        kind: a.kind,
        status: a.status,
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
