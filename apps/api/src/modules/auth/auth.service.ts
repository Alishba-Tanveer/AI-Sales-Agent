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
    const user = await this.authRepository.findUserByEmail(input.email);
    if (!user) {
      // Use generic message to prevent email enumeration
      throw new AppError("Invalid email or password", 401);
    }
    // 2. Verify password with stored bcrypt hash
    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", 401);
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
      },
      env.JWT_SECRET,
      { expiresIn }
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

    console.log(`\n[PASSWORD RESET OTP for ${user.email}]: ${otp} (Expires in 10 minutes)\n`);

    let emailSent = false;
    try {
      emailSent = await sendOtpEmail(user.email, otp);
    } catch (error) {
      console.error("[MAILER ERROR] Failed to send OTP email:", error);
    }

    return {
      message: "If an account with that email exists, a 6-digit OTP has been sent to your email.",
      emailSent,
      // Returned in response for easy testing in development/Postman:
      otp,
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
