import { prisma } from "@ai-sales-agent/database";

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

  async softDeleteUser(id: string) {
    return prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
    });
  }
}
