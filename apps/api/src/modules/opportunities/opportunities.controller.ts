import type { Request, Response, NextFunction } from "express";
import { OpportunitiesService } from "./opportunities.service";
import { searchOpportunitiesSchema, saveOpportunitySchema } from "./opportunities.schema";
import { AppError } from "../../utils/app-error";

export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  search = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const parseResult = searchOpportunitiesSchema.safeParse(req.body);
      if (!parseResult.success) {
        const msg = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(msg, 400);
      }

      const result = await this.opportunitiesService.searchOpportunities(
        req.user.organizationId,
        parseResult.data
      );

      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  saveAsLead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const id = String(req.params.id);
      const parseResult = saveOpportunitySchema.safeParse(req.body);
      if (!parseResult.success) {
        const msg = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(msg, 400);
      }

      const result = await this.opportunitiesService.saveOpportunityAsLead(
        req.user.organizationId,
        id,
        parseResult.data
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  dismiss = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const id = String(req.params.id);
      const result = await this.opportunitiesService.setDismissed(
        req.user.organizationId,
        id,
        true
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  restore = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const id = String(req.params.id);
      const result = await this.opportunitiesService.setDismissed(
        req.user.organizationId,
        id,
        false
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }

      const result = await this.opportunitiesService.listOpportunities(
        req.user.organizationId
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
