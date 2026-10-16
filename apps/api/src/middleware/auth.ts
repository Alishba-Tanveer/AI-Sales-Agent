import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  organizationId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const requireAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("Authentication required", 401);
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;
    req.user = payload;
    next();
  } catch {
    throw new AppError("Invalid or expired session token", 401);
  }
};