import type { Request, Response, NextFunction } from "express";
import { TeamService } from "./team.service";
import {
  createInvitationSchema,
  updateMemberRoleSchema,
  acceptInvitationSchema,
} from "./team.schema";
import { AppError } from "../../utils/app-error";

export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  listMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const result = await this.teamService.listMembersAndInvites(
        req.user.organizationId
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  createInvitation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId || !req.user?.userId) {
        throw new AppError("Authentication required", 401);
      }
      const parseResult = createInvitationSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(errorMessages, 400);
      }
      const result = await this.teamService.inviteMember(
        req.user.organizationId,
        req.user.userId,
        req.user.role,
        parseResult.data
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  resendInvitation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const id = String(req.params.id);
      const result = await this.teamService.resendInvitation(
        req.user.organizationId,
        req.user.role,
        id
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  revokeInvitation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError("Authentication required", 401);
      }
      const id = String(req.params.id);
      const result = await this.teamService.revokeInvitation(
        req.user.organizationId,
        req.user.role,
        id
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  updateMemberRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId || !req.user?.userId) {
        throw new AppError("Authentication required", 401);
      }
      const parseResult = updateMemberRoleSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(errorMessages, 400);
      }
      const id = String(req.params.id);
      const result = await this.teamService.updateMemberRole(
        req.user.organizationId,
        req.user.userId,
        req.user.role,
        id,
        parseResult.data
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  removeMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId || !req.user?.userId) {
        throw new AppError("Authentication required", 401);
      }
      const id = String(req.params.id);
      const result = await this.teamService.removeMember(
        req.user.organizationId,
        req.user.userId,
        req.user.role,
        id
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  acceptInvitation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = acceptInvitationSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues.map((i) => i.message).join(", ");
        throw new AppError(errorMessages, 400);
      }
      const result = await this.teamService.acceptInvitation(parseResult.data);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
