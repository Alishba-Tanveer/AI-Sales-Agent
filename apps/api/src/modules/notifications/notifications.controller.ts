import type { Request, Response, NextFunction } from "express";
import { NotificationsService } from "./notifications.service";
import {
  listNotificationsQuerySchema,
  updateNotificationSchema,
  createNotificationSchema,
} from "./notifications.schema";
import { AppError } from "../../utils/app-error";

export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  listNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const queryParse = listNotificationsQuerySchema.safeParse(req.query);
      if (!queryParse.success) {
        const msg = queryParse.error.issues.map((i) => i.message).join(", ");
        throw new AppError(msg, 400);
      }

      const result = await this.notificationsService.listNotifications(
        req.user.organizationId,
        queryParse.data
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  updateNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const id = String(req.params.id);
      const bodyParse = updateNotificationSchema.safeParse(req.body);
      if (!bodyParse.success) {
        const msg = bodyParse.error.issues.map((i) => i.message).join(", ");
        throw new AppError(msg, 400);
      }

      const result = await this.notificationsService.updateNotification(
        req.user.organizationId,
        id,
        bodyParse.data.read
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  markAllRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const result = await this.notificationsService.markAllRead(
        req.user.organizationId
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  dismissNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const id = String(req.params.id);
      const result = await this.notificationsService.dismissNotification(
        req.user.organizationId,
        id
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  clearAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const result = await this.notificationsService.clearAll(
        req.user.organizationId
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  createNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const bodyParse = createNotificationSchema.safeParse(req.body);
      if (!bodyParse.success) {
        const msg = bodyParse.error.issues.map((i) => i.message).join(", ");
        throw new AppError(msg, 400);
      }

      const result = await this.notificationsService.createNotification(
        req.user.organizationId,
        bodyParse.data
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const result = await this.notificationsService.getUnreadCount(
        req.user.organizationId
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
