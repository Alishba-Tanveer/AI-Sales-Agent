import type { Request, Response, NextFunction } from "express";
import { AnalyticsService } from "./analytics.service";
import { AppError } from "../../utils/app-error";

export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  getNavCounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const result = await this.analyticsService.getNavCounts(req.user.organizationId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getOverview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const result = await this.analyticsService.getOverview(req.user.organizationId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
