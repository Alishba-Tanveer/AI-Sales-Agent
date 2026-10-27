import { Role, prisma } from "@ai-sales-agent/database";
import { encodeType, type NotificationType } from "./notification-audience";

/**
 * WHO SEES WHAT (the single source of truth, every notification in the app goes through notify()).
 *
 *   OWNER         only the workspace Owner          billing, AI spend, usage limits, ownership and workspace deletion
 *   OWNER_ADMIN   Owner and Admins                  team changes, workspace settings, integrations, LinkedIn account
 *   ALL           Owner, Admins and Members         day-to-day work: replies, approvals, leads, content, failures
 *   { userId }    exactly one person                "you were removed / restored", "you are now the Owner", "your role changed"
 *
 * `exceptUserId` (one id or a list) leaves out the person who did the action, and anyone who already gets a personal
 * notification for the same event, so nobody is told twice.
 */
export type Audience = "OWNER" | "OWNER_ADMIN" | "ALL" | { userId: string };

const ROLES: Record<"OWNER" | "OWNER_ADMIN" | "ALL", Role[]> = {
  OWNER: [Role.OWNER],
  OWNER_ADMIN: [Role.OWNER, Role.ADMIN],
  ALL: [Role.OWNER, Role.ADMIN, Role.MEMBER],
};

export interface NotifyInput {
  organizationId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string | null;
  audience: Audience;
  exceptUserId?: string | string[];
}

/** Never throws: a failed notification must never break the action that caused it. */
export async function notify(input: NotifyInput): Promise<number> {
  try {
    const skip = input.exceptUserId ? ([] as string[]).concat(input.exceptUserId) : [];
    let recipientIds: string[];
    if (typeof input.audience === "object") {
      recipientIds = [input.audience.userId];
    } else {
      const users = await prisma.user.findMany({
        where: {
          organizationId: input.organizationId,
          deletedAt: null,
          role: { in: ROLES[input.audience] },
          ...(skip.length ? { id: { notIn: skip } } : {}),
        },
        select: { id: true },
      });
      recipientIds = users.map((u) => u.id);
    }
    if (recipientIds.length === 0) return 0;

    const res = await prisma.inAppNotification.createMany({
      data: recipientIds.map((id) => ({
        organizationId: input.organizationId,
        type: encodeType(input.type, id),
        title: input.title,
        body: input.body,
        read: false,
        href: input.href ?? null,
      })),
    });
    return res.count;
  } catch (err) {
    console.error("[NOTIFY] Could not save notification:", err);
    return 0;
  }
}
