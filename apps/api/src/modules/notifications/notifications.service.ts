import { NotificationsRepository } from "./notifications.repository";
import type { InAppNotification } from "@ai-sales-agent/database";
import type { ListNotificationsQuery, CreateNotificationInput } from "./notifications.schema";
import { AppError } from "../../utils/app-error";

function isNotificationAllowedForRole(n: InAppNotification, role: string): boolean {
  const normRole = (role || "").toUpperCase();
  if (normRole === "OWNER") return true;

  // Usage & billing is Owner only
  if (n.href?.includes("tab=usage")) return false;

  if (normRole === "ADMIN") {
    // Admin can see team, integrations, settings, leads, replies, approvals, etc.
    return true;
  }

  // MEMBER: cannot manage team, integrations, or workspace settings
  if (n.type === "team") return false;
  if (n.href?.includes("tab=team")) return false;
  if (n.href?.includes("/integrations")) return false;
  if (n.href === "/settings") return false;

  return true;
}

export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  async listNotifications(organizationId: string, userRole: string = "MEMBER", query?: ListNotificationsQuery) {
    // Auto-seed realistic initial notifications if none exist
    await this.notificationsRepository.seedDefaultNotificationsIfEmpty(organizationId);

    const items = await this.notificationsRepository.list(organizationId, query);
    const visibleItems = items.filter((n) => isNotificationAllowedForRole(n, userRole));
    const unreadCount = visibleItems.filter((n) => !n.read).length;

    const formatted = visibleItems.map((n: InAppNotification) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      at: n.createdAt.toISOString(),
      read: n.read,
      href: n.href ?? null,
    }));

    return {
      data: formatted,
      unreadCount,
    };
  }

  async updateNotification(organizationId: string, id: string, read: boolean) {
    const existing = await this.notificationsRepository.findById(id, organizationId);
    if (!existing) {
      throw new AppError("Notification not found", 404);
    }

    await this.notificationsRepository.updateRead(id, organizationId, read);

    return {
      data: {
        id: existing.id,
        type: existing.type,
        title: existing.title,
        body: existing.body,
        at: existing.createdAt.toISOString(),
        read,
        href: existing.href ?? null,
      },
    };
  }

  async markAllRead(organizationId: string) {
    const res = await this.notificationsRepository.markAllRead(organizationId);
    return {
      success: true,
      updatedCount: res.count,
    };
  }

  async dismissNotification(organizationId: string, id: string) {
    const existing = await this.notificationsRepository.findById(id, organizationId);
    if (!existing) {
      throw new AppError("Notification not found", 404);
    }

    await this.notificationsRepository.delete(id, organizationId);

    return {
      success: true,
      id,
    };
  }

  async clearAll(organizationId: string) {
    const res = await this.notificationsRepository.clearAll(organizationId);
    return {
      success: true,
      deletedCount: res.count,
    };
  }

  async createNotification(organizationId: string, input: CreateNotificationInput) {
    const created = await this.notificationsRepository.create(organizationId, input);
    return {
      data: {
        id: created.id,
        type: created.type,
        title: created.title,
        body: created.body,
        at: created.createdAt.toISOString(),
        read: created.read,
        href: created.href ?? null,
      },
    };
  }

  async getUnreadCount(organizationId: string, userRole: string = "MEMBER") {
    const res = await this.listNotifications(organizationId, userRole);
    return {
      data: {
        unread: res.unreadCount,
      },
    };
  }
}
