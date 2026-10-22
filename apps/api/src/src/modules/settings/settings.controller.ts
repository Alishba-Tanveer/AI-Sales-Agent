import type { Request, Response, NextFunction } from "express";
import { SettingsService } from "./settings.service";
import {
  outreachSettingsSchema,
  approvalRulesSchema,
  updateNotificationsSchema,
  updateAiLimitSchema,
  updateTestModeSchema,
} from "./settings.schema";
import { AppError } from "../../utils/app-error";

export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  getOutreach = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const data = await this.settingsService.getOutreach(req.user.organizationId);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  };

  saveOutreach = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const parseResult = outreachSettingsSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(errorMessages, 400);
      }
      const data = await this.settingsService.saveOutreach(
        req.user.organizationId,
        parseResult.data
      );
      res.status(200).json({
        message: "Outreach strategy saved",
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  approveOutreach = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const parseResult = outreachSettingsSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(errorMessages, 400);
      }
      const data = await this.settingsService.approveOutreach(
        req.user.organizationId,
        parseResult.data
      );
      res.status(200).json({
        message: "Outreach strategy saved and approved",
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  getApprovalRules = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const data = await this.settingsService.getApprovalRules(req.user.organizationId);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  };

  saveApprovalRules = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const parseResult = approvalRulesSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(errorMessages, 400);
      }
      const data = await this.settingsService.saveApprovalRules(
        req.user.organizationId,
        parseResult.data
      );
      res.status(200).json({
        message: "Approval rules saved",
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const rules = await this.settingsService.getNotifications(req.user.organizationId);
      res.status(200).json({ data: rules, rules });
    } catch (err) {
      next(err);
    }
  };

  saveNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const parseResult = updateNotificationsSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(errorMessages, 400);
      }
      const rules = await this.settingsService.saveNotifications(
        req.user.organizationId,
        parseResult.data
      );
      res.status(200).json({
        message: "Notification preferences saved",
        data: rules,
        rules,
      });
    } catch (err) {
      next(err);
    }
  };

  getUsage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const data = await this.settingsService.getUsage(req.user.organizationId);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  };

  updateAiLimit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const parseResult = updateAiLimitSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(errorMessages, 400);
      }
      const data = await this.settingsService.updateAiLimit(
        req.user.organizationId,
        parseResult.data
      );
      res.status(200).json({
        message: "Monthly AI limit saved successfully",
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  getTestMode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const data = await this.settingsService.getTestMode(req.user.organizationId);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  };

  updateTestMode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const parseResult = updateTestModeSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(errorMessages, 400);
      }
      const data = await this.settingsService.updateTestMode(
        req.user.organizationId,
        parseResult.data
      );
      res.status(200).json({
        message: data.testMode
          ? "Test mode enabled: dry run only"
          : "Test mode disabled: live sending active",
        data,
      });
    } catch (err) {
      next(err);
    }
  };
}
