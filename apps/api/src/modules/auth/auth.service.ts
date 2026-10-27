import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role, prisma } from "@ai-sales-agent/database";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { blacklistToken } from "../../utils/token-blacklist";
import { saveOtp, verifyOtpCode } from "../../utils/otp-store";
import { sendNoticeEmail, sendOtpEmail } from "../../utils/mailer";
import { notify } from "../../utils/notify";
import {
  RECOVERY_WINDOW_DAYS,
  RemovalReason,
  reasonOf,
  recoveryInfo,
} from "../../utils/account-rules";
import { AuthRepository } from "./auth.repository";
import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  VerifyOtpInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from "./auth.schema";

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async register(input: RegisterInput) {
    // 1. Check if email already exists
    const existingUser = await this.authRepository.findUserByEmail(input.email);
    if (existingUser) {
      if (existingUser.deletedAt && !recoveryInfo(existingUser.deletedAt).expired) {
        throw new AppError(
          "This email belongs to an account that was deleted recently. Sign in with your password to restore it.",
          409
        );
      }
      throw new AppError("A user with this email already exists", 409);
    }

    // 2. Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(input.password, saltRounds);

    // 3. Fallback organization name if not provided
    const organizationName = input.organizationName || `${input.name}'s Team`;

    // 4. Create user and organization
    const user = await this.authRepository.createUserWithOrganization({
      name: input.name,
      email: input.email,
      passwordHash,
      organizationName,
    });

    // 5. Sign JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
        tokenVersion: user.tokenVersion,
      },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
        },
        createdAt: user.createdAt,
      },
    };
  }

  async login(input: LoginInput) {
    // 1. Find user by email
    let user = await this.authRepository.findUserByEmail(input.email);
    if (!user) {
      // Use generic message to prevent email enumeration
      throw new AppError("Invalid email or password", 401);
    }
    // 2. Verify password with stored bcrypt hash
    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", 401);
    }

    // 2b. Removed / deleted accounts: see handleDeletedAccount for who may come back and how.
    let accountRestored = false;
    let restoredScope: "account" | "workspace" | undefined;
    if (user.deletedAt) {
      const outcome = await this.handleDeletedAccount(user, input.restore === true);
      user = outcome.user;
      restoredScope = outcome.scope;
      accountRestored = true;
      if (restoredScope === "account") {
        // A person came back on their own: Owner and Admins are told (Members are not).
        await notify({
          organizationId: user.organizationId,
          type: "team",
          title: `${user.name} restored their account`,
          body: `${user.name} (${user.email}) signed back in and restored their account.`,
          href: "/settings?tab=team",
          audience: "OWNER_ADMIN",
          exceptUserId: user.id,
        });
      } else if (restoredScope === "workspace") {
        // The Owner brought the whole workspace back. Everyone else was locked out meanwhile, so tell them (in-app for
        // when they sign in, and by email because they could not see anything while locked out).
        await notify({
          organizationId: user.organizationId,
          type: "system",
          title: "The workspace was restored",
          body: `${user.name} (the Owner) restored the workspace. Your access is back and your data is intact.`,
          href: "/overview",
          audience: "ALL",
          exceptUserId: user.id,
        });
        const others = await prisma.user.findMany({
          where: { organizationId: user.organizationId, deletedAt: null, id: { not: user.id } },
          select: { name: true, email: true },
        });
        for (const person of others) {
          void sendNoticeEmail({
            toEmail: person.email,
            subject: "Your workspace is back",
            lines: [`Hi ${person.name}, the Owner restored the workspace. You can sign in again.`],
          });
        }
      }
    }

    // 3. Set token expiry based on remember me checkbox
    // If remember is false: 1 day session token
    // If remember is true (or not specified): 30 days token
    const expiresIn = input.remember === false ? "1d" : "30d";

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
        tokenVersion: user.tokenVersion,
      },
      env.JWT_SECRET,
      { expiresIn }
    );
    return {
      token,
      accountRestored,
      ...(restoredScope ? { restoredScope } : {}),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          onboardingCompleted: user.organization.onboardingCompleted ?? false,
        },
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * The password was right, but the account is soft-deleted. Outcomes:
   *  - more than 30 days ago                    -> 403 ACCOUNT_EXPIRED (permanently gone)
   *  - removed by an Owner/Admin                -> 403 REMOVED_BY_ADMIN (an admin has to restore them)
   *  - workspace deleted, person is not Owner   -> 403 WORKSPACE_DELETED (only the Owner can bring it back)
   *  - deleted by themselves / the Owner's workspace -> 409 ACCOUNT_RESTORABLE, i.e. the "Restore your account?" question.
   *    The frontend asks, then repeats the login with restore: true (or calls POST /api/auth/restore-account).
   */
  private async handleDeletedAccount(
    user: NonNullable<Awaited<ReturnType<AuthRepository["findUserByEmail"]>>>,
    wantsRestore: boolean
  ) {
    const info = recoveryInfo(user.deletedAt as Date);
    const reason = reasonOf(user);
    const orgName = user.organization.name;

    if (info.expired) {
      throw new AppError(
        `This account was permanently deleted after the ${RECOVERY_WINDOW_DAYS}-day recovery window.`,
        403,
        { code: "ACCOUNT_EXPIRED" }
      );
    }

    if (reason === RemovalReason.ADMIN) {
      throw new AppError(
        `A workspace admin removed your access to ${orgName}. Ask an admin to restore your account.`,
        403,
        { code: "REMOVED_BY_ADMIN", organizationName: orgName }
      );
    }

    const isWorkspace = reason === RemovalReason.WORKSPACE_DELETED;
    if (isWorkspace && user.role !== Role.OWNER) {
      throw new AppError(
        `${orgName} was deleted by its Owner. Only the Owner can restore it (within ${info.daysLeft} more day${info.daysLeft === 1 ? "" : "s"}).`,
        403,
        { code: "WORKSPACE_DELETED", organizationName: orgName }
      );
    }

    const scope = isWorkspace ? ("workspace" as const) : ("account" as const);

    if (!wantsRestore) {
      throw new AppError(
        isWorkspace ? "Restore your workspace?" : "Restore your account?",
        409,
        {
          code: "ACCOUNT_RESTORABLE",
          scope,
          organizationName: orgName,
          restoreDeadline: info.restoreDeadline.toISOString(),
          daysLeft: info.daysLeft,
        }
      );
    }

    if (isWorkspace) {
      return { user: await this.authRepository.restoreWorkspace(user.organizationId, user.id), scope };
    }

    // A Member/Admin who deleted their own login can only come back to a workspace that still has an Owner.
    if (user.role !== Role.OWNER && !(await this.authRepository.hasActiveOwner(user.organizationId))) {
      throw new AppError(
        `${orgName} is no longer active, so this account can't be restored.`,
        403,
        { code: "WORKSPACE_UNAVAILABLE", organizationName: orgName }
      );
    }
    return { user: await this.authRepository.restoreUserAccount(user.id), scope };
  }

  async forgotPassword(input: ForgotPasswordInput) {
    const user = await this.authRepository.findUserByEmail(input.email);
    // Security practice: Always return generic message so attackers can't guess registered emails
    if (!user) {
      return {
        message: "If an account with that email exists, a 6-digit OTP has been sent to your email.",
      };
    }

    // Generate cryptographically secure 6-digit numeric OTP (100000 - 999999)
    const otp = crypto.randomInt(100000, 1000000).toString();

    // Store OTP for 10 minutes (600 seconds)
    await saveOtp(user.email, otp, 600);

    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[PASSWORD RESET OTP for ${user.email}]: ${otp} (Expires in 10 minutes)\n`);
    }

    try {
      await sendOtpEmail(user.email, otp);
    } catch (error) {
      console.error("[MAILER ERROR] Failed to send OTP email:", error);
    }

    return {
      message: "If an account with that email exists, a 6-digit OTP has been sent to your email.",
    };
  }

  async verifyOtp(input: VerifyOtpInput) {
    const isValid = await verifyOtpCode(input.email, input.otp, false);
    if (!isValid) {
      throw new AppError("Invalid or expired OTP", 400);
    }

    return {
      message: "OTP verified successfully",
      valid: true,
    };
  }

  async resetPassword(input: ResetPasswordInput) {
    // 1. Verify and consume the OTP (single-use)
    const isValidOtp = await verifyOtpCode(input.email, input.otp, true);
    if (!isValidOtp) {
      throw new AppError("Invalid or expired OTP", 400);
    }

    // 2. Find user by email
    const user = await this.authRepository.findUserByEmail(input.email);
    if (!user) {
      throw new AppError("Invalid or expired OTP", 400);
    }

    // 3. Hash new password and update in database
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(input.newPassword, saltRounds);
    await this.authRepository.updateUserPassword(user.id, newPasswordHash);

    return {
      message: "Password has been reset successfully. You can now login with your new password.",
    };
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const currentPassword = input.currentPassword || input.current || "";
    const newPassword = input.newPassword || input.next || "";

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError("Current password is incorrect", 400);
    }

    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
    const updated = await this.authRepository.updateUserPassword(userId, newPasswordHash);

    return {
      message: "Password updated successfully",
      data: {
        passwordChangedAt: updated.passwordChangedAt,
      },
    };
  }

  async logoutOthers(userId: string) {
    const updatedUser = await this.authRepository.incrementTokenVersion(userId);

    const token = jwt.sign(
      {
        userId: updatedUser.id,
        email: updatedUser.email,
        organizationId: updatedUser.organizationId,
        role: updatedUser.role,
        tokenVersion: updatedUser.tokenVersion,
      },
      env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    return {
      message: "Signed out of other sessions",
      data: {
        token,
      },
    };
  }

  async logout(token?: string) {
    if (token) {
      const decoded = jwt.decode(token) as { exp?: number } | null;
      const ttl = decoded?.exp
        ? Math.max(decoded.exp - Math.floor(Date.now() / 1000), 60)
        : 3600;
      await blacklistToken(token, ttl);
    }
    return {
      message: "Logged out successfully",
    };
  }
}
