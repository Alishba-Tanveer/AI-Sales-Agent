import { prisma } from "@ai-sales-agent/database";

export class ActivityRepository {
  async list(
    organizationId: string,
    filters: { type?: string; status?: string; limit: number }
  ) {
    return prisma.activityLog.findMany({
      where: {
        organizationId,
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: filters.limit,
    });
  }

  async countSummary(organizationId: string) {
    const [total, completed, retrying, failed, testMode] = await Promise.all([
      prisma.activityLog.count({ where: { organizationId } }),
      prisma.activityLog.count({
        where: { organizationId, status: "completed" },
      }),
      prisma.activityLog.count({
        where: { organizationId, status: "retrying" },
      }),
      prisma.activityLog.count({
        where: { organizationId, status: "failed" },
      }),
      prisma.activityLog.count({
        where: { organizationId, testMode: true },
      }),
    ]);

    return {
      total,
      completed,
      retrying,
      failed,
      testMode,
    };
  }

  async findById(id: string, organizationId: string) {
    return prisma.activityLog.findFirst({
      where: { id, organizationId },
    });
  }

  async listNotifications(organizationId: string) {
    const [items, unreadCount] = await Promise.all([
      prisma.inAppNotification.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.inAppNotification.count({
        where: { organizationId, read: false },
      }),
    ]);
    return { items, unreadCount };
  }

  async findNotificationById(id: string, organizationId: string) {
    return prisma.inAppNotification.findFirst({
      where: { id, organizationId },
    });
  }

  async markNotificationRead(id: string) {
    return prisma.inAppNotification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllNotificationsRead(organizationId: string) {
    return prisma.inAppNotification.updateMany({
      where: { organizationId, read: false },
      data: { read: true },
    });
  }
}
