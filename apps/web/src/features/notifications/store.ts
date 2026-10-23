import { useSyncExternalStore } from "react";
import { buildMockNotifications } from "./mock-data";
import type { AppNotification } from "./types";

/**
 * A tiny shared store so the bell's unread count (top bar) and the slide-over panel always agree, and so the state
 * survives moving between pages. It runs on mock data for now. When the backend ships /api/notifications, replace the
 * initial value with a fetch and make each action call the API first (the signatures can stay the same).
 */
let items: AppNotification[] = buildMockNotifications();
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

export const notificationActions = {
  markRead: (id: string) => set(items.map((n) => (n.id === id && !n.read ? { ...n, read: true } : n))),
  markUnread: (id: string) => set(items.map((n) => (n.id === id && n.read ? { ...n, read: false } : n))),
  markAllRead: () => set(items.some((n) => !n.read) ? items.map((n) => (n.read ? n : { ...n, read: true })) : items),
  dismiss: (id: string) => set(items.filter((n) => n.id !== id)),
  clearAll: () => set([]),
};

export function useNotifications() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { items: list, unread: list.filter((n) => !n.read).length };
}
