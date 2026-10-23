import { prisma, Role } from "@ai-sales-agent/database";
import { InviteStatus, RemovalReason } from "../../utils/account-rules";

export class UsersRepository {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { organization: true },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async updateProfile(
    id: string,
    data: {
      name?: string;
      email?: string;
      roleTitle?: string;
      timezone?: string;
    }
  ) {
    return prisma.user.update({
      where: { id },
      data,
      include: { organization: true },
    });
  }

  async updateAvatar(id: string, avatarUrl: string | null) {
    return prisma.user.update({
      where: { id },
      data: { avatarUrl },
      include: { organization: true },
    });
  }

  /** An Admin or Member deletes their own login. The company and all its data stay exactly as they are. */
  async softDeleteUser(id: string) {
    return prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        removedById: id,
        removedReason: RemovalReason.SELF,
        tokenVersion: { increment: 1 },
      },
    });
  }

  /** An active (not removed) member of this workspace, or null. */
  async findActiveMember(id: string, organizationId: string) {
    return prisma.user.findFirst({ where: { id, organizationId, deletedAt: null } });
  }

  /** How many other active people the workspace has besides this person. */
  async countOtherActiveMembers(organizationId: string, exceptUserId: string) {
    return prisma.user.count({
      where: { organizationId, deletedAt: null, id: { not: exceptUserId } },
    });
  }

  /**
   * The Owner leaves and hands the workspace over, in ONE transaction so the workspace is never without an Owner:
   *   1. the old Owner becomes an Admin and their own login is soft-deleted (30 days to restore, reason SELF)
   *   2. the chosen member becomes the one and only Owner
   * Everything else (campaigns, leads, team, settings) stays exactly as it is.
   * If the old Owner signs back in within 30 days they return as an Admin; the new Owner stays the Owner.
   */
  async transferOwnershipAndSoftDelete(ownerId: string, newOwnerId: string) {
    const [previousOwner, newOwner] = await prisma.$transaction([
      prisma.user.update({
        where: { id: ownerId },
        data: {
          role: Role.ADMIN,
          deletedAt: new Date(),
          removedById: ownerId,
          removedReason: RemovalReason.SELF,
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.user.update({ where: { id: newOwnerId }, data: { role: Role.OWNER } }),
    ]);
    return { previousOwner, newOwner };
  }

  /**
   * The Owner deletes the whole business: every active account in it is deactivated together (30 days to
   * restore, by the Owner signing in) and every pending invitation is cancelled so nobody can join a deleted workspace.
   */
  async softDeleteWorkspace(organizationId: string, ownerId: string) {
    const now = new Date();
    const [users] = await prisma.$transaction([
      prisma.user.updateMany({
        where: { organizationId, deletedAt: null },
        data: {
          deletedAt: now,
          removedById: ownerId,
          removedReason: RemovalReason.WORKSPACE_DELETED,
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.teamInvitation.updateMany({
        where: { organizationId, status: InviteStatus.PENDING },
        data: { status: InviteStatus.CANCELLED, cancelledAt: now },
      }),
    ]);
    return users.count;
  }
}
