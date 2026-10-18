import type { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { registerSchema,loginSchema,forgotPasswordSchema,resetPasswordSchema } from "./auth.schema";
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

 login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues
          .map((i) => i.message)
          .join(", ");
        throw new AppError(errorMessages, 400);
      }
      const result = await this.authService.login(parseResult.data);
      res.status(200).json({
        message: "Login successful",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = forgotPasswordSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues
          .map((i) => i.message)
          .join(", ");
        throw new AppError(errorMessages, 400);
      }
      const result = await this.authService.forgotPassword(parseResult.data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };


  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = resetPasswordSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues
          .map((i) => i.message)
          .join(", ");
        throw new AppError(errorMessages, 400);
      }
      const result = await this.authService.resetPassword(parseResult.data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.token || req.headers.authorization?.split(" ")[1];
      const result = await this.authService.logout(token);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}