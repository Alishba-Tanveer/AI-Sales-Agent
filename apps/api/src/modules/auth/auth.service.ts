import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { AuthRepository } from "./auth.repository";
import type { RegisterInput } from "./auth.schema";

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
}