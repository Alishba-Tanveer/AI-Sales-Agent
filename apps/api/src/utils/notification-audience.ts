/**
 * Who a notification is for.
 *
 * Every notification is stored once PER RECIPIENT (so "read" and "dismiss" belong to one person, never to the whole
 * workspace). The recipient's user id is kept after an "@" in the existing `type` column, for example
 * "team@cm9x...". That needs no database migration. Rows without an "@" are older shared rows and keep using the
 * role filter in notifications.service.ts.
 */
export type NotificationType = "reply" | "approval" | "failure" | "lead" | "team" | "system";

export function encodeType(type: NotificationType, userId?: string): string {
  return userId ? `${type}@${userId}` : type;
}

export function decodeType(stored: string): { type: NotificationType; userId: string | null } {
  const at = stored.indexOf("@");
  if (at === -1) return { type: stored as NotificationType, userId: null };
  return { type: stored.slice(0, at) as NotificationType, userId: stored.slice(at + 1) || null };
}
