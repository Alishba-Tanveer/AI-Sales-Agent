import { prisma, Role } from "@ai-sales-agent/database";
import {
  InviteStatus,
  RECOVERY_WINDOW_MS,
  RemovalReason,
} from "../../utils/account-rules";

export type InvitationPatch = {
  name?: string;
  role?: Role;
  token?: string;
  expiresAt?: Date;
  invitedById?: string;
  status?: string;
  emailError?: string | null;
  lastSentAt?: Date | null;
  acceptedAt?: Date | null;
  cancelledAt?: Date | null;
};

export class TeamRepository {
  /* ---------------- members ---------------- */

  async listMembers(organizationId: string) {
    return prisma.user.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * "Recently removed": accounts that left the team less than 30 days ago, either removed by an Owner/Admin
   * (ADMIN) or deleted by the person themselves (SELF, including old rows with no reason). The Owner never
   * appears here, and neither do accounts that went down with a deleted workspace.
   */
  async listRemoved(organizationId: string) {
    return prisma.user.findMany({
      where: {
        organizationId,
        role: { not: Role.OWNER },
        deletedAt: { not: null, gte: new Date(Date.now() - RECOVERY_WINDOW_MS) },
        OR: [
          { removedReason: RemovalReason.ADMIN },
          { removedReason: RemovalReason.SELF },
          { removedReason: null },
        ],
      },
      orderBy: { deletedAt: "desc" },
    });
  }

  async findUsersByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
  }

  async findUserWithOrganization(id: string) {
    return prisma.user.findUnique({ where: { id }, include: { organization: true } });
  }

  async findOrganization(id: string) {
    return prisma.organization.findUnique({ where: { id } });
  }

  async findMemberById(id: string, organizationId: string) {
    return prisma.user.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
  }

  /** A soft-deleted (removed) account of this workspace, whatever the reason. */
  async findRemovedById(id: string, organizationId: string) {
    return prisma.user.findFirst({
      where: { id, organizationId, deletedAt: { not: null } },
    });
  }

  /** Active or removed: any account in this workspace with that email. */
  async findAccountInOrgByEmail(email: string, organizationId: string) {
    return prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, organizationId },
    });
  }

  async findAnyUserByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      include: { organization: true },
    });
  }

  async countActiveUsers(organizationId: string) {
    return prisma.user.count({ where: { organizationId, deletedAt: null } });
  }

  async updateMemberRole(id: string, role: Role) {
    return prisma.user.update({ where: { id }, data: { role } });
  }

  /**
   * "Remove" never deletes the row: the person lands in "Recently removed" for 30 days and can be restored.
   * tokenVersion is bumped so every session they still have stops working immediately.
   */
  async softDeleteMember(id: string, removedById: string) {
    return prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        removedById,
        removedReason: RemovalReason.ADMIN,
        tokenVersion: { increment: 1 },
      },
    });
  }

  async restoreMember(id: string) {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: null, removedById: null, removedReason: null },
    });
  }

  /** One atomic step: the old Owner becomes Admin, the chosen member becomes the one and only Owner. */
  /**
   * Old Owner -> Admin, chosen member -> Owner, in one transaction. The old Owner's tokenVersion goes up, which signs
   * them out on every device (requireAuth rejects tokens with an older version); they sign in again as an Admin.
   * Roles are read from the database on each request, so the new Owner has Owner rights immediately.
   */
  async transferOwnership(fromOwnerId: string, toUserId: string) {
    const [previousOwner, newOwner] = await prisma.$transaction([
      prisma.user.update({ where: { id: fromOwnerId }, data: { role: Role.ADMIN, tokenVersion: { increment: 1 } } }),
      prisma.user.update({ where: { id: toUserId }, data: { role: Role.OWNER } }),
    ]);
    return { previousOwner, newOwner };
  }

  /* ---------------- invitations ---------------- */

  /** Pending invitations only (valid, expired or email-failed). Accepted/cancelled rows are kept just so their links can explain themselves. */
  async listPendingInvitations(organizationId: string) {
    return prisma.teamInvitation.findMany({
      where: { organizationId, status: InviteStatus.PENDING },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Any status, newest first. */
  async findInvitationByEmail(email: string, organizationId: string) {
    return prisma.teamInvitation.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findInvitationById(id: string, organizationId: string) {
    return prisma.teamInvitation.findFirst({ where: { id, organizationId } });
  }

  async findInvitationByToken(token: string) {
    return prisma.teamInvitation.findUnique({
      where: { token },
      include: { organization: true },
    });
  }

  async createInvitation(data: {
    email: string;
    name: string;
    role: Role;
    token: string;
    expiresAt: Date;
    invitedById: string;
    organizationId: string;
  }) {
    return prisma.teamInvitation.create({
      data: { ...data, status: InviteStatus.PENDING },
    });
  }

  async updateInvitation(id: string, data: InvitationPatch) {
    return prisma.teamInvitation.update({ where: { id }, data });
  }

  /* ---------------- accepting an invitation ---------------- */

  /**
   * Claim the invitation and create the account in ONE transaction. The claim only succeeds while the
   * invitation is still PENDING, so a link can never be used twice (not even by two simultaneous clicks).
   * Returns null when somebody else already claimed it.
   */
  async acceptForNewUser(
    invitationId: string,
    data: {
      name: string;
      email: string;
      passwordHash: string;
      role: Role;
      organizationId: string;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.teamInvitation.updateMany({
        where: { id: invitationId, status: InviteStatus.PENDING },
        data: { status: InviteStatus.ACCEPTED, acceptedAt: new Date() },
      });
      if (claimed.count === 0) return null;
      return tx.user.create({ data, include: { organization: true } });
    });
  }

  /** Same as above for somebody who already has an account (they proved it with their password). */
  async acceptForExistingUser(
    invitationId: string,
    userId: string,
    organizationId: string,
    role: Role
  ) {
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.teamInvitation.updateMany({
        where: { id: invitationId, status: InviteStatus.PENDING },
        data: { status: InviteStatus.ACCEPTED, acceptedAt: new Date() },
      });
      if (claimed.count === 0) return null;
      return tx.user.update({
        where: { id: userId },
        data: {
          organizationId,
          role,
          deletedAt: null,
          removedById: null,
          removedReason: null,
        },
        include: { organization: true },
      });
    });
  }
}
