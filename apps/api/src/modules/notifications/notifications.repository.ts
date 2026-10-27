import { prisma, type Prisma } from "@ai-sales-agent/database";
import type { ListNotificationsQuery } from "./notifications.schema";

/**
 * A person can reach their own rows (type ends with "@<their id>") plus older shared rows that have no "@" at all.
 * Every read, update and delete below goes through this, so nobody can touch another person's notifications.
 */
function visibleTo(organizationId: string, userId: string): Prisma.InAppNotificationWhereInput {
  return {
    organizationId,
    OR: [{ type: { endsWith: `@${userId}` } }, { NOT: { type: { contains: "@" } } }],
  };
}

export class NotificationsRepository {
  async list(organizationId: string, userId: string, query?: ListNotificationsQuery) {
    const and: Prisma.InAppNotificationWhereInput[] = [visibleTo(organizationId, userId)];
    if (query?.filter === "unread") and.push({ read: false });
    if (query?.type) and.push({ type: { startsWith: query.type } });

    return prisma.inAppNotification.findMany({
      where: { AND: and },
      orderBy: { createdAt: "desc" },
      take: query?.limit ?? 100,
    });
  }

  async findById(id: string, organizationId: string, userId: string) {
    return prisma.inAppNotification.findFirst({ where: { AND: [{ id }, visibleTo(organizationId, userId)] } });
  }

  async updateRead(id: string, organizationId: string, userId: string, read: boolean) {
    return prisma.inAppNotification.updateMany({
      where: { AND: [{ id }, visibleTo(organizationId, userId)] },
      data: { read },
    });
  }

  async markAllRead(organizationId: string, userId: string) {
    return prisma.inAppNotification.updateMany({
      where: { AND: [visibleTo(organizationId, userId), { read: false }] },
      data: { read: true },
    });
  }

  async delete(id: string, organizationId: string, userId: string) {
    return prisma.inAppNotification.deleteMany({ where: { AND: [{ id }, visibleTo(organizationId, userId)] } });
  }

  async clearAll(organizationId: string, userId: string) {
    return prisma.inAppNotification.deleteMany({ where: visibleTo(organizationId, userId) });
  }
}
