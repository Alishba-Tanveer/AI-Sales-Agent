import type { Request, Response, NextFunction } from "express";
import { TeamService } from "./team.service";
import {
  createInvitationSchema,
  updateMemberRoleSchema,
  acceptInvitationSchema,
  transferOwnershipSchema,
} from "./team.schema";
import { AppError } from "../../utils/app-error";

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

const validationError = (issues: { message: string }[]) =>
  new AppError(issues.map((i) => i.message).join(", "), 400);

export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  private readonly auth = (req: Request) => {
    if (!req.user?.organizationId || !req.user?.userId) {
      throw new AppError("Authentication required", 401);
    }
    return {
      organizationId: req.user.organizationId,
      userId: req.user.userId,
      role: req.user.role,
    };
  };

  listMembers: Handler = async (req, res, next) => {
    try {
      const { organizationId } = this.auth(req);
      res.status(200).json(await this.teamService.listMembersAndInvites(organizationId));
    } catch (err) {
      next(err);
    }
  };

  listRemovedMembers: Handler = async (req, res, next) => {
    try {
      const { organizationId, role } = this.auth(req);
      res.status(200).json(await this.teamService.listRemovedMembers(organizationId, role));
    } catch (err) {
      next(err);
    }
  };

  createInvitation: Handler = async (req, res, next) => {
    try {
      const { organizationId, userId, role } = this.auth(req);
      const parsed = createInvitationSchema.safeParse(req.body);
      if (!parsed.success) throw validationError(parsed.error.issues);
      const input = parsed.data;
      res.status(201).json(await this.teamService.inviteMember(organizationId, userId, role, input));
    } catch (err) {
      next(err);
    }
  };

  resendInvitation: Handler = async (req, res, next) => {
    try {
      const { organizationId, userId, role } = this.auth(req);
      res
        .status(200)
        .json(
          await this.teamService.resendInvitation(organizationId, userId, role, String(req.params.id))
        );
    } catch (err) {
      next(err);
    }
  };

  revokeInvitation: Handler = async (req, res, next) => {
    try {
      const { organizationId, role } = this.auth(req);
      res
        .status(200)
        .json(await this.teamService.revokeInvitation(organizationId, role, String(req.params.id)));
    } catch (err) {
      next(err);
    }
  };

  updateMemberRole: Handler = async (req, res, next) => {
    try {
      const { organizationId, userId, role } = this.auth(req);
      const parsed = updateMemberRoleSchema.safeParse(req.body);
      if (!parsed.success) throw validationError(parsed.error.issues);
      const input = parsed.data;
      res
        .status(200)
        .json(
          await this.teamService.updateMemberRole(
            organizationId,
            userId,
            role,
            String(req.params.id),
            input
          )
        );
    } catch (err) {
      next(err);
    }
  };

  removeMember: Handler = async (req, res, next) => {
    try {
      const { organizationId, userId, role } = this.auth(req);
      res
        .status(200)
        .json(
          await this.teamService.removeMember(organizationId, userId, role, String(req.params.id))
        );
    } catch (err) {
      next(err);
    }
  };

  restoreMember: Handler = async (req, res, next) => {
    try {
      const { organizationId, role } = this.auth(req);
      res
        .status(200)
        .json(await this.teamService.restoreMember(organizationId, role, String(req.params.id)));
    } catch (err) {
      next(err);
    }
  };

  /** POST /transfer-ownership {memberId}  or  POST /members/:id/transfer-ownership  (Owner only; no password) */
  transferOwnership: Handler = async (req, res, next) => {
    try {
      const { organizationId, userId, role } = this.auth(req);
      const parsed = transferOwnershipSchema.safeParse(req.body);
      if (!parsed.success) throw validationError(parsed.error.issues);
      const input = parsed.data;
      const fromUrl = req.params.id ? String(req.params.id) : undefined;
      res
        .status(200)
        .json(await this.teamService.transferOwnership(organizationId, userId, role, input, fromUrl));
    } catch (err) {
      next(err);
    }
  };

  /** GET /invitations/:token (or ?token=): public, used by the /accept-invite page before it shows a form. */
  lookupInvitation: Handler = async (req, res, next) => {
    try {
      const token = String(req.params.token ?? req.query.token ?? "").trim();
      if (!token) throw new AppError("Invitation token is required", 400);
      res.status(200).json(await this.teamService.lookupInvitation(token));
    } catch (err) {
      next(err);
    }
  };

  acceptInvitation: Handler = async (req, res, next) => {
    try {
      const parsed = acceptInvitationSchema.safeParse(req.body);
      if (!parsed.success) throw validationError(parsed.error.issues);
      const input = parsed.data;
      res.status(200).json(await this.teamService.acceptInvitation(input));
    } catch (err) {
      next(err);
    }
  };
}
