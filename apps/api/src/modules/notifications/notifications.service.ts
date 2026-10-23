import { NotificationsRepository } from "./notifications.repository";
import type { InAppNotification } from "@ai-sales-agent/database";
import type { ListNotificationsQuery, CreateNotificationInput } from "./notifications.schema";
import { AppError } from "../../utils/app-error";

export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  async listNotifications(organizationId: string, query?: ListNotificationsQuery) {
    // Auto-seed realistic initial notifications if none exist
    await this.notificationsRepository.seedDefaultNotificationsIfEmpty(organizationId);

    const [items, unreadCount] = await Promise.all([
      this.notificationsRepository.list(organizationId, query),
      this.notificationsRepository.countUnread(organizationId),
    ]);

    const formatted = items.map((n: InAppNotification) => ({
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

  async getUnreadCount(organizationId: string) {
    const unread = await this.notificationsRepository.countUnread(organizationId);
    return {
      data: {
        unread,
      },
    };
  }
}
