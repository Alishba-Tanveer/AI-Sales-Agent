import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { blacklistToken } from "../../utils/token-blacklist";
import { AuthRepository } from "./auth.repository";
import type { RegisterInput,LoginInput,ForgotPasswordInput,ResetPasswordInput  } from "./auth.schema";

interface ResetTokenPayload {
  userId: string;
  email: string;
}

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
        message: "If an account with that email exists, a password reset link has been generated.",
      };
    }
    // Secret combines JWT_SECRET with the user's current password hash.
    // When password is reset later, passwordHash changes and invalidates this token automatically!
    const resetSecret = env.JWT_SECRET + user.passwordHash;
    const resetToken = jwt.sign(
      { userId: user.id, email: user.email },
      resetSecret,
      { expiresIn: "15m" }
    );
    const resetLink = `${env.WEB_URL}/reset-password?token=${resetToken}`;
    console.log(`\n[PASSWORD RESET LINK for ${user.email}]: ${resetLink}\n`);
    return {
      message: "If an account with that email exists, a password reset link has been generated.",
      // Returned in response for easy testing in development/Postman:
      resetToken,
    };
  }


  async resetPassword(input: ResetPasswordInput) {
    // 1. Decode token to find userId without verifying yet
    const decoded = jwt.decode(input.token) as ResetTokenPayload | null;
    if (!decoded || !decoded.userId) {
      throw new AppError("Invalid or expired reset token", 400);
    }
    // 2. Fetch user to get their current passwordHash
    const user = await this.authRepository.findUserById(decoded.userId);
    if (!user) {
      throw new AppError("Invalid or expired reset token", 400);
    }
    // 3. Verify token with current passwordHash
    const resetSecret = env.JWT_SECRET + user.passwordHash;
    try {
      jwt.verify(input.token, resetSecret);
    } catch {
      throw new AppError("Invalid or expired reset token", 400);
    }
    // 4. Hash new password and update in database
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


