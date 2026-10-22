import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UsersRepository } from "./users.repository";
import type { UpdateProfileInput, DeleteAccountInput } from "./users.schema";
import { AppError } from "../../utils/app-error";
import { blacklistToken } from "../../utils/token-blacklist";

const ALLOWED_AVATAR_MIMES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  private formatProfile(user: NonNullable<Awaited<ReturnType<UsersRepository["findById"]>>>) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleTitle: user.roleTitle ?? "Chief Growth Officer & Co-Founder",
      timezone: user.timezone ?? "(UTC-05:00) Eastern Time (US & Canada)",
      avatar: user.avatarUrl ?? null,
      avatarUrl: user.avatarUrl ?? null,
      passwordChangedAt: user.passwordChangedAt,
      organizationId: user.organizationId,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async getMe(userId: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }
    return this.formatProfile(user);
  }

  async updateMe(userId: string, input: UpdateProfileInput) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (input.email && input.email.toLowerCase() !== user.email.toLowerCase()) {
      const existing = await this.usersRepository.findByEmail(input.email);
      if (existing && existing.id !== userId) {
        throw new AppError("A user with this email already exists", 409);
      }
    }

    const updated = await this.usersRepository.updateProfile(userId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.roleTitle !== undefined ? { roleTitle: input.roleTitle } : {}),
      ...(input.timezone !== undefined || input.tz !== undefined
        ? { timezone: input.timezone ?? input.tz }
        : {}),
    });

    return this.formatProfile(updated);
  }

  async uploadAvatar(userId: string, mimeType: string, buffer: Buffer) {
    if (!ALLOWED_AVATAR_MIMES.includes(mimeType)) {
      throw new AppError("Use a JPG, PNG or WEBP image.", 400);
    }
    if (buffer.byteLength > MAX_AVATAR_BYTES) {
      throw new AppError("Image is larger than 2MB.", 400);
    }

    const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    const updated = await this.usersRepository.updateAvatar(userId, dataUrl);
    return this.formatProfile(updated);
  }

  async removeAvatar(userId: string) {
    const updated = await this.usersRepository.updateAvatar(userId, null);
    return this.formatProfile(updated);
  }

  async deleteMe(userId: string, input: DeleteAccountInput, token?: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (input.confirm !== undefined && input.confirm.trim() !== "DELETE") {
      throw new AppError("Please type DELETE to confirm account deletion", 400);
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError("Incorrect password", 400);
    }

    await this.usersRepository.softDeleteUser(userId);

    if (token) {
      const decoded = jwt.decode(token) as { exp?: number } | null;
      const ttl = decoded?.exp
        ? Math.max(decoded.exp - Math.floor(Date.now() / 1000), 60)
        : 3600;
      await blacklistToken(token, ttl);
    }

    return {
      message: "Account scheduled for deactivation. You have 30 days to restore it by signing in.",
      restoreDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
}
