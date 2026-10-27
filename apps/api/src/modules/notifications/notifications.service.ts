import type { InAppNotification } from "@ai-sales-agent/database";
import { NotificationsRepository } from "./notifications.repository";
import type { ListNotificationsQuery } from "./notifications.schema";
import { AppError } from "../../utils/app-error";
import { decodeType } from "../../utils/notification-audience";

/**
 * New notifications are written once per recipient by utils/notify.ts, so the right people are already chosen when
 * the row is created. This filter only covers older shared rows (no "@" in the type), using the same role rules as before.
 */
function legacyRowAllowedForRole(n: InAppNotification, role: string): boolean {
  const r = (role || "").toUpperCase();
  if (r === "OWNER") return true;
  if (n.href?.includes("tab=usage")) return false; // usage and billing: Owner only
  if (r === "ADMIN") return true;
  if (n.type === "team") return false; // Members never see team changes
  if (n.href?.includes("tab=team")) return false;
  if (n.href?.includes("/integrations")) return false;
  if (n.href === "/settings") return false;
  return true;
}

function toDto(n: InAppNotification, read = n.read) {
  return {
    id: n.id,
    type: decodeType(n.type).type,
    title: n.title,
    body: n.body,
    at: n.createdAt.toISOString(),
    read,
    href: n.href ?? null,
  };
}

export interface Viewer {
  organizationId: string;
  userId: string;
  role: string;
}

export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  async listNotifications(viewer: Viewer, query?: ListNotificationsQuery) {
    const items = await this.notificationsRepository.list(viewer.organizationId, viewer.userId, query);
    const visible = items.filter((n) => decodeType(n.type).userId !== null || legacyRowAllowedForRole(n, viewer.role));
    return {
      data: visible.map((n) => toDto(n)),
      unreadCount: visible.filter((n) => !n.read).length,
    };
  }

  async updateNotification(viewer: Viewer, id: string, read: boolean) {
    const existing = await this.notificationsRepository.findById(id, viewer.organizationId, viewer.userId);
    if (!existing) throw new AppError("Notification not found", 404);
    await this.notificationsRepository.updateRead(id, viewer.organizationId, viewer.userId, read);
    return { data: toDto(existing, read) };
  }

  async markAllRead(viewer: Viewer) {
    const res = await this.notificationsRepository.markAllRead(viewer.organizationId, viewer.userId);
    return { success: true, updatedCount: res.count };
  }

  async dismissNotification(viewer: Viewer, id: string) {
    const existing = await this.notificationsRepository.findById(id, viewer.organizationId, viewer.userId);
    if (!existing) throw new AppError("Notification not found", 404);
    await this.notificationsRepository.delete(id, viewer.organizationId, viewer.userId);
    return { success: true, id };
  }

  async clearAll(viewer: Viewer) {
    const res = await this.notificationsRepository.clearAll(viewer.organizationId, viewer.userId);
    return { success: true, deletedCount: res.count };
  }

  async getUnreadCount(viewer: Viewer) {
    const res = await this.listNotifications(viewer);
    return { data: { unread: res.unreadCount } };
  }
}
