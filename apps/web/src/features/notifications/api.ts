import { api } from "@/lib/api";
import type { AppNotification } from "./types";

export async function fetchNotifications(): Promise<AppNotification[]> {
  const res = await api<{ data: AppNotification[]; unreadCount: number }>("/api/notifications");
  return res.data;
}

export async function updateNotificationRead(id: string, read: boolean): Promise<void> {
  await api(`/api/notifications/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ read }),
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await api("/api/notifications/read-all", {
    method: "POST",
  });
}

export async function dismissNotification(id: string): Promise<void> {
  await api(`/api/notifications/${id}`, {
    method: "DELETE",
  });
}

export async function clearAllNotifications(): Promise<void> {
  await api("/api/notifications", {
    method: "DELETE",
  });
}
