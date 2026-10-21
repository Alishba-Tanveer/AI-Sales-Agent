import type { Request, Response, NextFunction } from "express";
import { ApprovalsService } from "./approvals.service";
import {
  createApprovalSchema,
  approveItemSchema,
  rejectItemSchema,
  bulkApproveSchema,
  listApprovalsQuerySchema,
} from "./approvals.schema";
import { AppError } from "../../utils/app-error";

export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const queryParse = listApprovalsQuerySchema.safeParse(req.query);
      if (!queryParse.success) {
        const msg = queryParse.error.issues.map((i) => i.message).join(", ");
        throw new AppError(msg, 400);
      }
      const result = await this.approvalsService.list(
        req.user.organizationId,
        queryParse.data
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const id = String(req.params.id);
      const data = await this.approvalsService.getById(
        req.user.organizationId,
        id
      );
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId || !req.user?.userId) {
        throw new AppError("Authentication required", 401);
      }
      const parseResult = createApprovalSchema.safeParse(req.body);
      if (!parseResult.success) {
        const msg = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(msg, 400);
      }
      const result = await this.approvalsService.createDraft(
        req.user.organizationId,
        req.user.userId,
        parseResult.data
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId || !req.user?.userId) {
        throw new AppError("Authentication required", 401);
      }
      const parseResult = approveItemSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        const msg = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(msg, 400);
      }
      const id = String(req.params.id);
      const result = await this.approvalsService.approve(
        req.user.organizationId,
        req.user.userId,
        id,
        parseResult.data
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId || !req.user?.userId) {
        throw new AppError("Authentication required", 401);
      }
      const parseResult = rejectItemSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        const msg = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(msg, 400);
      }
      const id = String(req.params.id);
      const result = await this.approvalsService.reject(
        req.user.organizationId,
        req.user.userId,
        id,
        parseResult.data
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  bulkApprove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId || !req.user?.userId) {
        throw new AppError("Authentication required", 401);
      }
      const parseResult = bulkApproveSchema.safeParse(req.body);
      if (!parseResult.success) {
        const msg = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(msg, 400);
      }
      const result = await this.approvalsService.bulkApprove(
        req.user.organizationId,
        req.user.userId,
        parseResult.data
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
