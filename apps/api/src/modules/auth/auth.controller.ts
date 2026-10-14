import type { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { registerSchema } from "./auth.schema";
import { AppError } from "../../utils/app-error";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = registerSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues
          .map((i) => i.message)
          .join(", ");
        throw new AppError(errorMessages, 400);
      }

      const result = await this.authService.register(parseResult.data);

      res.status(201).json({
        message: "User registered successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}