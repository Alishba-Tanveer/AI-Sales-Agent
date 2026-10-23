/**
 * Shared rules for removed / deleted accounts and team invitations.
 *
 * Why a user row can have `deletedAt` set (the 30-day recovery window starts at that moment):
 *   SELF               the person deleted their own login          -> they can restore it by signing in
 *   ADMIN              an Owner/Admin removed them from the team   -> only an Owner/Admin can restore them
 *   WORKSPACE_DELETED  the Owner deleted the whole business        -> the Owner can restore everything by signing in
 * Rows written before this field existed have `removedReason = null`; they are treated as SELF.
 */
export const RECOVERY_WINDOW_DAYS = 30;
export const RECOVERY_WINDOW_MS = RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const RemovalReason = {
  SELF: "SELF",
  ADMIN: "ADMIN",
  WORKSPACE_DELETED: "WORKSPACE_DELETED",
} as const;
export type RemovalReasonValue = (typeof RemovalReason)[keyof typeof RemovalReason];

export function reasonOf(user: { removedReason?: string | null }): RemovalReasonValue {
  if (user.removedReason === RemovalReason.ADMIN) return RemovalReason.ADMIN;
  if (user.removedReason === RemovalReason.WORKSPACE_DELETED) return RemovalReason.WORKSPACE_DELETED;
  return RemovalReason.SELF;
}

export function recoveryInfo(deletedAt: Date) {
  const deadline = new Date(deletedAt.getTime() + RECOVERY_WINDOW_MS);
  const msLeft = deadline.getTime() - Date.now();
  return {
    restoreDeadline: deadline,
    expired: msLeft <= 0,
    daysLeft: Math.max(0, Math.ceil(msLeft / DAY_MS)),
  };
}

/** Team invitation lifecycle stored in TeamInvitation.status. "Expired" and "Email failed" are derived, not stored. */
export const InviteStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  CANCELLED: "CANCELLED",
} as const;

export const INVITE_TTL_MS = 7 * DAY_MS;
