import { prisma, type Prisma } from "@ai-sales-agent/database";
import type { ListNotificationsQuery, CreateNotificationInput } from "./notifications.schema";

export class NotificationsRepository {
  async list(organizationId: string, query?: ListNotificationsQuery) {
    const where: Prisma.InAppNotificationWhereInput = { organizationId };

    if (query?.filter === "unread") {
      where.read = false;
    }

    if (query?.type) {
      where.type = query.type;
    }

    return prisma.inAppNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query?.limit ?? 100,
    });
  }

  async countTotal(organizationId: string) {
    return prisma.inAppNotification.count({
      where: { organizationId },
    });
  }

  async countUnread(organizationId: string) {
    return prisma.inAppNotification.count({
      where: { organizationId, read: false },
    });
  }

  async findById(id: string, organizationId: string) {
    return prisma.inAppNotification.findFirst({
      where: { id, organizationId },
    });
  }

  async create(organizationId: string, data: CreateNotificationInput) {
    return prisma.inAppNotification.create({
      data: {
        organizationId,
        type: data.type,
        title: data.title,
        body: data.body,
        read: data.read ?? false,
        href: data.href ?? null,
      },
    });
  }

  async updateRead(id: string, organizationId: string, read: boolean) {
    return prisma.inAppNotification.updateMany({
      where: { id, organizationId },
      data: { read },
    });
  }

  async markAllRead(organizationId: string) {
    return prisma.inAppNotification.updateMany({
      where: { organizationId, read: false },
      data: { read: true },
    });
  }

  async delete(id: string, organizationId: string) {
    return prisma.inAppNotification.deleteMany({
      where: { id, organizationId },
    });
  }

  async clearAll(organizationId: string) {
    return prisma.inAppNotification.deleteMany({
      where: { organizationId },
    });
  }

  async seedDefaultNotificationsIfEmpty(organizationId: string) {
    const count = await this.countTotal(organizationId);
    if (count > 0) return false;

    const now = Date.now();
    const MIN = 60_000;

    const seeds = [
      {
        type: "reply",
        title: "Sarah Mitchell replied",
        body: "“Thanks for reaching out. Thursday works for a quick call, can you send a few times?”",
        ago: 5,
        read: false,
        href: "/inbox",
      },
      {
        type: "approval",
        title: "12 drafts are waiting for approval",
        body: "AI-written emails for your Healthcare segment need a review before they are sent.",
        ago: 22,
        read: false,
        href: "/approvals",
      },
      {
        type: "failure",
        title: "Research failed for Tom Becker",
        body: "The company website blocked automated access. 2 of 3 retries were used.",
        ago: 45,
        read: false,
        href: "/activity",
      },
      {
        type: "lead",
        title: "9 new leads found",
        body: "Discovery finished for the E-commerce segment. They were added as New.",
        ago: 70,
        read: false,
        href: "/leads",
      },
      {
        type: "reply",
        title: "Marcus Brody accepted your invite",
        body: "You are now connected on LinkedIn. A follow-up message is ready to review.",
        ago: 190,
        read: true,
        href: "/linkedin?tab=connections",
      },
      {
        type: "team",
        title: "Ahmed Khan joined your workspace",
        body: "He accepted the invitation and joined as a Member.",
        ago: 26 * 60,
        read: true,
        href: "/settings?tab=team",
      },
      {
        type: "approval",
        title: "Follow-up sequence #2 was approved",
        body: "3 messages are scheduled to go out between 9:00 and 11:00 AM tomorrow.",
        ago: 29 * 60,
        read: true,
        href: "/follow-ups",
      },
      {
        type: "system",
        title: "Your weekly summary is ready",
        body: "42 emails sent, 13.7% reply rate and 5 meetings booked.",
        ago: 32 * 60,
        read: true,
        href: "/analytics",
      },
      {
        type: "failure",
        title: "Gmail connection needs attention",
        body: "Reconnect your Gmail account so approved drafts can be sent.",
        ago: 3 * 24 * 60,
        read: true,
        href: "/integrations",
      },
      {
        type: "lead",
        title: "Hyperion Logistics is now Interested",
        body: "Daniel Hughes asked for pricing. Open the lead to see the conversation.",
        ago: 3 * 24 * 60 + 240,
        read: true,
        href: "/leads",
      },
      {
        type: "system",
        title: "Daily send limit reached",
        body: "Sending resumes tomorrow at 9:00 AM. You can raise the limit in Usage and Limits.",
        ago: 4 * 24 * 60,
        read: true,
        href: "/settings?tab=usage",
      },
      {
        type: "team",
        title: "An invitation expired",
        body: "The invite for jane@brightcart.com was not accepted in 7 days. Resend it from Team.",
        ago: 5 * 24 * 60,
        read: true,
        href: "/settings?tab=team",
      },
      {
        type: "system",
        title: "Welcome to AI Sales Agent",
        body: "Finish your workspace details so the AI can find the right leads and write better drafts.",
        ago: 8 * 24 * 60,
        read: true,
        href: "/settings",
      },
    ];

    await prisma.inAppNotification.createMany({
      data: seeds.map((s) => ({
        organizationId,
        type: s.type,
        title: s.title,
        body: s.body,
        read: s.read,
        href: s.href,
        createdAt: new Date(now - s.ago * MIN),
      })),
    });

    return true;
  }
}
