import { useEffect, useSyncExternalStore } from "react";
import {
  fetchNotifications,
  updateNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  clearAllNotifications,
} from "./api";
import { buildMockNotifications } from "./mock-data";
import type { AppNotification } from "./types";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_NOTIFICATIONS !== "false";

let items: AppNotification[] = USE_MOCK ? buildMockNotifications() : [];
let requested = false;
const listeners = new Set<() => void>();

const set = (next: AppNotification[]) => {
  items = next;
  listeners.forEach((l) => l());
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

const getSnapshot = () => items;

export const notificationStore = {
  load(force = false) {
    if (USE_MOCK) return;
    if (requested && !force) return;
    requested = true;
    fetchNotifications()
      .then((data) => set(data))
      .catch(() => {
        requested = false;
      });
  },
};

export const notificationActions = {
  markRead: (id: string) => {
    set(items.map((n) => (n.id === id && !n.read ? { ...n, read: true } : n)));
    updateNotificationRead(id, true).catch(() => {});
  },
  markUnread: (id: string) => {
    set(items.map((n) => (n.id === id && n.read ? { ...n, read: false } : n)));
    updateNotificationRead(id, false).catch(() => {});
  },
  markAllRead: () => {
    set(items.some((n) => !n.read) ? items.map((n) => (n.read ? n : { ...n, read: true })) : items);
    markAllNotificationsRead().catch(() => {});
  },
  dismiss: (id: string) => {
    set(items.filter((n) => n.id !== id));
    dismissNotification(id).catch(() => {});
  },
  clearAll: () => {
    set([]);
    clearAllNotifications().catch(() => {});
  },
};

export function useNotifications() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    notificationStore.load();
  }, []);

  return { items: list, unread: list.filter((n) => !n.read).length };
}
