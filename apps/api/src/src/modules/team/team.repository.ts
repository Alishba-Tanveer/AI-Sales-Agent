import { prisma, Role } from "@ai-sales-agent/database";

export class TeamRepository {
  async listMembers(organizationId: string) {
    return prisma.user.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async listInvitations(organizationId: string) {
    return prisma.teamInvitation.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
  }

  async findMemberById(id: string, organizationId: string) {
    return prisma.user.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
  }

  async findMemberByEmail(email: string, organizationId: string) {
    return prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        organizationId,
        deletedAt: null,
      },
    });
  }

  async findInvitationByEmail(email: string, organizationId: string) {
    return prisma.teamInvitation.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        organizationId,
      },
    });
  }

  async findInvitationById(id: string, organizationId: string) {
    return prisma.teamInvitation.findFirst({
      where: { id, organizationId },
    });
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
    return prisma.teamInvitation.create({ data });
  }

  async updateInvitation(
    id: string,
    data: { token?: string; expiresAt?: Date; role?: Role }
  ) {
    return prisma.teamInvitation.update({
      where: { id },
      data,
    });
  }

  async deleteInvitation(id: string) {
    return prisma.teamInvitation.delete({
      where: { id },
    });
  }

  async updateMemberRole(id: string, role: Role) {
    return prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  async deleteMember(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  }

  async findAnyUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async createUserFromInvitation(data: {
    name: string;
    email: string;
    passwordHash: string;
    role: Role;
    organizationId: string;
  }) {
    return prisma.user.create({
      data,
      include: { organization: true },
    });
  }

  async assignExistingUserToOrganization(
    userId: string,
    organizationId: string,
    role: Role
  ) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        organizationId,
        role,
        deletedAt: null,
      },
      include: { organization: true },
    });
  }
}
