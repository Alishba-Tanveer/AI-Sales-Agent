import { prisma, Role } from "@ai-sales-agent/database";

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

  async restoreUserAccount(id: string) {
    return prisma.user.update({
      where: { id },
      data: {
        deletedAt: null,
      },
      include: {
        organization: true,
      },
    });
  }
}