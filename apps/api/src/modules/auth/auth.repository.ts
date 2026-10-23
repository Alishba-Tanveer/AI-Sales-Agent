import { prisma, Role } from "@ai-sales-agent/database";
import { RemovalReason } from "../../utils/account-rules";

export class AuthRepository {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });
  }


  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { organization: true },
    });
  }

  async createUserWithOrganization(data: {
    name: string;
    email: string;
    passwordHash: string;
    organizationName: string;
  }) {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: Role.OWNER,
        organization: {
          create: {
            name: data.organizationName,
          },
        },
      },
      include: {
        organization: true,
      },
    });
  }

  async updateUserPassword(id: string, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
      },
    });
  }

  async incrementTokenVersion(id: string) {
    return prisma.user.update({
      where: { id },
      data: {
        tokenVersion: { increment: 1 },
      },
      include: {
        organization: true,
      },
    });
  }

  /** Brings back one account that its owner deleted (or that was soft-deleted before removal reasons existed). */
  async restoreUserAccount(id: string) {
    return prisma.user.update({
      where: { id },
      data: {
        deletedAt: null,
        removedById: null,
        removedReason: null,
      },
      include: {
        organization: true,
      },
    });
  }

  /**
   * The Owner deleted the whole business and now restores it: every account that went down with the
   * workspace comes back. People who had been removed or had deleted themselves earlier stay as they were.
   */
  async restoreWorkspace(organizationId: string, ownerId: string) {
    await prisma.user.updateMany({
      where: {
        organizationId,
        deletedAt: { not: null },
        removedReason: RemovalReason.WORKSPACE_DELETED,
      },
      data: { deletedAt: null, removedById: null, removedReason: null },
    });
    return prisma.user.findUniqueOrThrow({
      where: { id: ownerId },
      include: { organization: true },
    });
  }

  async hasActiveOwner(organizationId: string) {
    const count = await prisma.user.count({
      where: { organizationId, role: Role.OWNER, deletedAt: null },
    });
    return count > 0;
  }
}
