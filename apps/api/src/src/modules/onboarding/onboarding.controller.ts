import type { Request, Response, NextFunction } from "express";
import { OnboardingService } from "./onboarding.service";
import { onboardingSchema } from "./onboarding.schema";
import { AppError } from "../../utils/app-error";

export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Unauthorized", 401);
      }
      const data = await this.onboardingService.getOnboarding(req.user.organizationId);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  };

  save = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Unauthorized", 401);
      }

      const parseResult = onboardingSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(errorMessages, 400);
      }

      const updated = await this.onboardingService.saveOnboarding(
        req.user.organizationId,
        parseResult.data
      );

      res.status(200).json({
        message: parseResult.data.complete
          ? "Onboarding completed successfully"
          : "Onboarding progress saved",
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  };
}