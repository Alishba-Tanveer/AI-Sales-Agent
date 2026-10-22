import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { blacklistToken } from "../../utils/token-blacklist";
import { saveOtp, verifyOtpCode } from "../../utils/otp-store";
import { sendOtpEmail } from "../../utils/mailer";
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

    // 2b. If account was soft-deleted within 30 days, automatically restore it on sign-in
    let accountRestored = false;
    if (user.deletedAt) {
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const elapsedMs = Date.now() - user.deletedAt.getTime();
      if (elapsedMs > thirtyDaysMs) {
        throw new AppError(
          "This account was permanently deleted after the 30-day recovery window.",
          403
        );
      }
      user = await this.authRepository.restoreUserAccount(user.id);
      accountRestored = true;
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
