import type { Request, Response, NextFunction } from "express";
import { NotificationsService } from "./notifications.service";
import {
  listNotificationsQuerySchema,
  updateNotificationSchema,
} from "./notifications.schema";
import { AppError } from "../../utils/app-error";

const viewerOf = (req: Request) => {
  if (!req.user?.organizationId) throw new AppError("Authentication required", 401);
  return { organizationId: req.user.organizationId, userId: req.user.userId, role: req.user.role };
};

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

      const result = await this.notificationsService.listNotifications(viewerOf(req), queryParse.data);
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

      const result = await this.notificationsService.updateNotification(viewerOf(req), id, bodyParse.data.read);
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

      const result = await this.notificationsService.markAllRead(viewerOf(req));
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
      const result = await this.notificationsService.dismissNotification(viewerOf(req), id);
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

      const result = await this.notificationsService.clearAll(viewerOf(req));
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const result = await this.notificationsService.getUnreadCount(viewerOf(req));
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
