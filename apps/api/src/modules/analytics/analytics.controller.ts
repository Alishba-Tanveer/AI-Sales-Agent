import type { Request, Response, NextFunction } from "express";
import { AnalyticsService } from "./analytics.service";
import { AppError } from "../../utils/app-error";

export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  getOverview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const data = await this.analyticsService.getOverview(
        req.user.organizationId
      );
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  };

  getNavCounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const data = await this.analyticsService.getNavCounts(
        req.user.organizationId
      );
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  };
}
