import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role, prisma } from "@ai-sales-agent/database";
import { TeamRepository } from "./team.repository";
import type {
  CreateInvitationInput,
  UpdateMemberRoleInput,
  AcceptInvitationInput,
} from "./team.schema";
import { AppError } from "../../utils/app-error";
import { env } from "../../config/env";
import { sendTeamInviteEmail } from "../../utils/mailer";

function formatRoleLabel(role: Role): "Owner" | "Admin" | "Member" {
  if (role === Role.OWNER) return "Owner";
  if (role === Role.ADMIN) return "Admin";
  return "Member";
}

function deriveNameFromEmail(email: string): string {
  const local = email.split("@")[0] || "Team Member";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export class TeamService {
  constructor(private readonly teamRepository: TeamRepository) {}

  private assertCanManageTeam(currentUserRole: string, targetRole?: Role) {
    if (currentUserRole !== Role.OWNER && currentUserRole !== Role.ADMIN) {
      throw new AppError("Only workspace Owners and Admins can manage team members", 403);
    }
    if (targetRole === Role.OWNER && currentUserRole !== Role.OWNER) {
      throw new AppError("Only a workspace Owner can assign the Owner role", 403);
    }
  }

  async listMembersAndInvites(organizationId: string) {
    const [users, invites] = await Promise.all([
      this.teamRepository.listMembers(organizationId),
      this.teamRepository.listInvitations(organizationId),
    ]);

    const activeMembers = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: formatRoleLabel(u.role),
      status: "Active" as const,
      avatar: u.avatarUrl ?? null,
      createdAt: u.createdAt,
    }));

    const pendingInvites = invites.map((inv) => ({
      id: inv.id,
      invitationId: inv.id,
      name: inv.name,
      email: inv.email,
      role: formatRoleLabel(inv.role),
      status: "Invited" as const,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }));

    return {
      data: [...activeMembers, ...pendingInvites],
      members: activeMembers,
      invitations: pendingInvites,
    };
  }

  async inviteMember(
    organizationId: string,
    invitedById: string,
    currentUserRole: string,
    input: CreateInvitationInput
  ) {
    this.assertCanManageTeam(currentUserRole, input.role);

    const existingMember = await this.teamRepository.findMemberByEmail(
      input.email,
      organizationId
    );
    if (existingMember) {
      throw new AppError("That person is already on the team.", 409);
    }

    const existingInvite = await this.teamRepository.findInvitationByEmail(
      input.email,
      organizationId
    );
    if (existingInvite) {
      throw new AppError("An invitation has already been sent to that email.", 409);
    }

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const name = input.name || deriveNameFromEmail(input.email);

    const invitation = await this.teamRepository.createInvitation({
      email: input.email,
      name,
      role: input.role,
      token,
      expiresAt,
      invitedById,
      organizationId,
    });

    const inviter = await prisma.user.findUnique({
      where: { id: invitedById },
      include: { organization: true },
    });

    const orgName = inviter?.organization?.name || "your workspace";
    const inviterName = inviter?.name || "A workspace administrator";

    // Send real invitation email via Gmail SMTP
    try {
      await sendTeamInviteEmail({
        toEmail: invitation.email,
        inviterName,
        organizationName: orgName,
        role: formatRoleLabel(invitation.role),
        token: invitation.token,
      });
    } catch (mailErr) {
      console.error("[MAILER ERROR] Failed to deliver team invitation email:", mailErr);
    }

    return {
      message: `Invitation sent to ${invitation.email}`,
      data: {
        id: invitation.id,
        invitationId: invitation.id,
        name: invitation.name,
        email: invitation.email,
        role: formatRoleLabel(invitation.role),
        status: "Invited" as const,
        ...(process.env.NODE_ENV !== "production" ? { token: invitation.token } : {}),
        expiresAt: invitation.expiresAt,
      },
    };
  }

  async resendInvitation(
    organizationId: string,
    currentUserRole: string,
    invitationId: string
  ) {
    this.assertCanManageTeam(currentUserRole);

    const invite = await this.teamRepository.findInvitationById(
      invitationId,
      organizationId
    );
    if (!invite) {
      throw new AppError("Invitation not found", 404);
    }

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await this.teamRepository.updateInvitation(invite.id, {
      token,
      expiresAt,
    });

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { users: { where: { role: Role.OWNER }, take: 1 } },
    });
    const orgName = org?.name || "your workspace";
    const inviterName = org?.users[0]?.name || "A workspace administrator";

    try {
      await sendTeamInviteEmail({
        toEmail: updated.email,
        inviterName,
        organizationName: orgName,
        role: formatRoleLabel(updated.role),
        token: updated.token,
      });
    } catch (mailErr) {
      console.error("[MAILER ERROR] Failed to deliver resend team invitation email:", mailErr);
    }

    return {
      message: "Invitation resent",
      data: {
        id: updated.id,
        invitationId: updated.id,
        name: updated.name,
        email: updated.email,
        role: formatRoleLabel(updated.role),
        status: "Invited" as const,
        ...(process.env.NODE_ENV !== "production" ? { token: updated.token } : {}),
        expiresAt: updated.expiresAt,
      },
    };
  }

  async revokeInvitation(
    organizationId: string,
    currentUserRole: string,
    invitationId: string
  ) {
    this.assertCanManageTeam(currentUserRole);

    const invite = await this.teamRepository.findInvitationById(
      invitationId,
      organizationId
    );
    if (!invite) {
      throw new AppError("Invitation not found", 404);
    }

    await this.teamRepository.deleteInvitation(invite.id);
    return {
      message: "Invitation revoked",
    };
  }

  async updateMemberRole(
    organizationId: string,
    currentUserId: string,
    currentUserRole: string,
    targetId: string,
    input: UpdateMemberRoleInput
  ) {
    this.assertCanManageTeam(currentUserRole, input.role);

    if (targetId === currentUserId && input.role !== Role.OWNER) {
      const members = await this.teamRepository.listMembers(organizationId);
      const owners = members.filter((m) => m.role === Role.OWNER);
      if (owners.length <= 1) {
        throw new AppError("Cannot demote the only workspace owner", 400);
      }
    }

    const member = await this.teamRepository.findMemberById(
      targetId,
      organizationId
    );
    if (member) {
      if (member.role === Role.OWNER && currentUserRole !== Role.OWNER) {
        throw new AppError("Only a workspace Owner can change another Owner's role", 403);
      }
      const updated = await this.teamRepository.updateMemberRole(
        member.id,
        input.role
      );
      return {
        message: "Role updated",
        data: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          role: formatRoleLabel(updated.role),
          status: "Active" as const,
        },
      };
    }

    // Fallback: allow changing role on a pending invitation if targetId is an invitation ID
    const invite = await this.teamRepository.findInvitationById(
      targetId,
      organizationId
    );
    if (invite) {
      const updated = await this.teamRepository.updateInvitation(invite.id, {
        role: input.role,
      });
      return {
        message: "Role updated",
        data: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          role: formatRoleLabel(updated.role),
          status: "Invited" as const,
        },
      };
    }

    throw new AppError("Team member not found", 404);
  }

  async removeMember(
    organizationId: string,
    currentUserId: string,
    currentUserRole: string,
    targetId: string
  ) {
    this.assertCanManageTeam(currentUserRole);

    if (targetId === currentUserId) {
      throw new AppError("Cannot remove workspace owner or yourself", 400);
    }

    const member = await this.teamRepository.findMemberById(
      targetId,
      organizationId
    );
    if (member) {
      if (member.role === Role.OWNER && currentUserRole !== Role.OWNER) {
        throw new AppError("Only a workspace Owner can remove another Owner", 403);
      }
      if (member.role === Role.OWNER) {
        const allMembers = await this.teamRepository.listMembers(organizationId);
        const owners = allMembers.filter((m) => m.role === Role.OWNER);
        if (owners.length <= 1) {
          throw new AppError("Cannot remove workspace owner", 400);
        }
      }
      await this.teamRepository.deleteMember(member.id);
      return {
        message: "Member removed",
      };
    }

    // Fallback: if targetId is a pending invitation ID, revoke it
    const invite = await this.teamRepository.findInvitationById(
      targetId,
      organizationId
    );
    if (invite) {
      await this.teamRepository.deleteInvitation(invite.id);
      return {
        message: "Invitation revoked",
      };
    }

    throw new AppError("Team member not found", 404);
  }

  async acceptInvitation(input: AcceptInvitationInput) {
    const invite = await this.teamRepository.findInvitationByToken(input.token);
    if (!invite) {
      throw new AppError("Invalid or expired invitation token", 400);
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      throw new AppError("Invitation has expired. Please ask for a new invite.", 400);
    }

    const existingUser = await this.teamRepository.findAnyUserByEmail(invite.email);
    let user;

    if (existingUser) {
      if (existingUser.organizationId !== invite.organizationId && !existingUser.deletedAt) {
        throw new AppError(
          "A user with this email already belongs to another active workspace.",
          409
        );
      }
      user = await this.teamRepository.assignExistingUserToOrganization(
        existingUser.id,
        invite.organizationId,
        invite.role
      );
    } else {
      if (!input.password) {
        throw new AppError("Password is required to create your account", 400);
      }
      const passwordHash = await bcrypt.hash(input.password, 10);
      user = await this.teamRepository.createUserFromInvitation({
        name: input.name || invite.name,
        email: invite.email,
        passwordHash,
        role: invite.role,
        organizationId: invite.organizationId,
      });
    }

    await this.teamRepository.deleteInvitation(invite.id);

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
        tokenVersion: user.tokenVersion,
      },
      env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    return {
      message: "Invitation accepted successfully",
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: formatRoleLabel(user.role),
          organization: {
            id: user.organization.id,
            name: user.organization.name,
          },
        },
      },
    };
  }
}
