import { useEffect, useSyncExternalStore } from "react";
import {
  fetchNotifications,
  updateNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  clearAllNotifications,
} from "./api";
import { USER_STORE_EVENT, userStore } from "@/features/auth/user-store";
import type { AppNotification } from "./types";

let items: AppNotification[] = [];
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

// Notifications belong to one person. When somebody else signs in (or the person signs out or their role changes),
// the previous person's list must never stay on screen, so it is emptied and fetched again for the new session.
let lastWho = typeof window === "undefined" ? "" : `${userStore.get()?.id ?? ""}:${userStore.get()?.role ?? ""}`;
if (typeof window !== "undefined") {
  window.addEventListener(USER_STORE_EVENT, () => {
    const now = `${userStore.get()?.id ?? ""}:${userStore.get()?.role ?? ""}`;
    if (now === lastWho) return;
    lastWho = now;
    requested = false;
    set([]);
    if (userStore.get()) notificationStore.load(true);
  });
}

export const notificationStore = {
  load(force = false) {
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
    // Keep the list fresh: other people's actions (a removal, an ownership transfer) arrive while this tab is open.
    const refresh = () => document.visibilityState === "visible" && notificationStore.load(true);
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return { items: list, unread: list.filter((n) => !n.read).length };
}
