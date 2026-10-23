import type { Request, Response, NextFunction } from "express";
import { ActivityService } from "./activity.service";
import { listActivityQuerySchema, createActivityJobSchema } from "./activity.schema";
import { AppError } from "../../utils/app-error";

export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  listActivity = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const queryParse = listActivityQuerySchema.safeParse(req.query);
      if (!queryParse.success) {
        const msg = queryParse.error.issues.map((i) => i.message).join(", ");
        throw new AppError(msg, 400);
      }

      const result = await this.activityService.listActivity(
        req.user.organizationId,
        queryParse.data
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  retryJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const id = String(req.params.id);
      const result = await this.activityService.retryJob(
        req.user.organizationId,
        id
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  cancelJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const id = String(req.params.id);
      const result = await this.activityService.cancelJob(
        req.user.organizationId,
        id
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  createJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const bodyParse = createActivityJobSchema.safeParse(req.body);
      if (!bodyParse.success) {
        const msg = bodyParse.error.issues.map((i) => i.message).join(", ");
        throw new AppError(msg, 400);
      }

      const result = await this.activityService.createJob(
        req.user.organizationId,
        bodyParse.data
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  getRunningCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const result = await this.activityService.getRunningCount(
        req.user.organizationId
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
