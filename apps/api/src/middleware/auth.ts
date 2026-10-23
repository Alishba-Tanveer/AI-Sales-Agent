import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "@ai-sales-agent/database";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";
import { isTokenBlacklisted } from "../utils/token-blacklist";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  organizationId: string;
  role: string;
  tokenVersion?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      token?: string;
    }
  }
}

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Authentication required", 401);
    }

    const token = authHeader.split(" ")[1];

    // Check if token has been logged out / revoked
    const isRevoked = await isTokenBlacklisted(token);
    if (isRevoked) {
      throw new AppError("Token has been revoked. Please log in again.", 401);
    }

    const payload = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;

    const dbUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        organizationId: true,
        role: true,
        tokenVersion: true,
        deletedAt: true,
      },
    });

    if (!dbUser || dbUser.deletedAt) {
      throw new AppError("Account is deactivated or no longer exists", 401);
    }

    if (
      typeof payload.tokenVersion === "number" &&
      payload.tokenVersion !== dbUser.tokenVersion
    ) {
      throw new AppError(
        "Session expired because other sessions were signed out. Please log in again.",
        401
      );
    }

    req.user = {
      userId: dbUser.id,
      email: dbUser.email,
      organizationId: dbUser.organizationId,
      role: dbUser.role,
      tokenVersion: dbUser.tokenVersion,
    };
    req.token = token;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError("Your session has expired. Please log in again.", 401));
    } else if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.NotBeforeError) {
      next(new AppError("Invalid or expired session token", 401));
    } else {
      // Not a token problem (database error, outdated Prisma client / missing migration, ...).
      // Do NOT report this as a 401: it would sign people out for a server-side fault.
      console.error("[requireAuth] unexpected error while checking the session:", error);
      next(new AppError("Could not verify your session because of a server error. Check the API logs.", 500));
    }
  }
};

/**
 * Role gate. Use AFTER requireAuth. The role comes from the database (requireAuth refreshes it on every request),
 * so a role change or ownership transfer takes effect immediately, not when the token is reissued.
 *
 *   router.put("/usage/ai-limit", requireRole(Role.OWNER), handler)
 */
export const requireRole =
  (...allowed: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError("Authentication required", 401));
      return;
    }
    if (!allowed.includes(req.user.role)) {
      const who = allowed.length === 1 && allowed[0] === "OWNER" ? "the workspace Owner" : "an Owner or Admin";
      next(new AppError(`You don't have permission to do that. Ask ${who}.`, 403));
      return;
    }
    next();
  };
