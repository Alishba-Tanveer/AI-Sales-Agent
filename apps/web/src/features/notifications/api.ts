import { api } from "@/lib/api";
import { buildMockNotifications } from "./mock-data";
import type { AppNotification } from "./types";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_NOTIFICATIONS !== "false";

export async function fetchNotifications(): Promise<AppNotification[]> {
  if (USE_MOCK) {
    return buildMockNotifications();
  }
  const res = await api<{ data: AppNotification[]; unreadCount: number }>("/api/notifications");
  return res.data;
}

export async function updateNotificationRead(id: string, read: boolean): Promise<void> {
  if (USE_MOCK) return;
  await api(`/api/notifications/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ read }),
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  if (USE_MOCK) return;
  await api("/api/notifications/read-all", {
    method: "POST",
  });
}

export async function dismissNotification(id: string): Promise<void> {
  if (USE_MOCK) return;
  await api(`/api/notifications/${id}`, {
    method: "DELETE",
  });
}

export async function clearAllNotifications(): Promise<void> {
  if (USE_MOCK) return;
  await api("/api/notifications", {
    method: "DELETE",
  });
}
