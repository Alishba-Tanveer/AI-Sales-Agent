import type { Request, Response, NextFunction } from "express";
import { ActivityService } from "./activity.service";
import {
  listActivityQuerySchema,
  triggerTestJobSchema,
} from "./activity.schema";
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

  runTestJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const parseResult = triggerTestJobSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        const msg = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(msg, 400);
      }
      const result = await this.activityService.runTestJob(
        req.user.organizationId,
        parseResult.data
      );
      res.status(201).json(result);
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
      const result = await this.activityService.retryActivityJob(
        req.user.organizationId,
        id
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  runPurgeJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const result = await this.activityService.runPurgeJob(
        req.user.organizationId,
        req.user.role
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  listNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const result = await this.activityService.listNotifications(
        req.user.organizationId
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  markNotificationRead = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const id = String(req.params.id);
      const result = await this.activityService.markNotificationRead(
        req.user.organizationId,
        id
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  markAllNotificationsRead = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const result = await this.activityService.markAllNotificationsRead(
        req.user.organizationId
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
