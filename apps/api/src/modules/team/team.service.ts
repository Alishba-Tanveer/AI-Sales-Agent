import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role, prisma } from "@ai-sales-agent/database";
import { TeamRepository } from "./team.repository";
import type {
  CreateInvitationInput,
  UpdateMemberRoleInput,
  AcceptInvitationInput,
  TransferOwnershipInput,
} from "./team.schema";
import { strongPasswordSchema } from "../auth/auth.schema";
import { AppError } from "../../utils/app-error";
import { env } from "../../config/env";
import { sendTeamInviteEmail } from "../../utils/mailer";
import {
  INVITE_TTL_MS,
  InviteStatus,
  RemovalReason,
  reasonOf,
  recoveryInfo,
} from "../../utils/account-rules";

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

const newToken = () => crypto.randomBytes(24).toString("hex");
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** First line of a mailer error, short enough to show in the Team tab. */
function shortError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const line = raw.split("\n")[0].trim();
  return line.length > 180 ? `${line.slice(0, 177)}...` : line || "Unknown email error";
}

type InviteRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  expiresAt: Date;
  createdAt: Date;
  emailError?: string | null;
};

/**
 * What the Team tab shows for a pending invitation.
 *   Email failed  the message never left the server (wrong SMTP login, bad address, SMTP not configured)
 *   Expired       the 7-day link ran out
 *   Invited       waiting for the person to accept
 * "Email failed" wins over "Expired": a link nobody received is the more useful thing to know.
 */
function describeInvite(inv: InviteRow): {
  status: "Invited" | "Expired" | "Email failed";
  reason: string | null;
} {
  if (inv.emailError) {
    return {
      status: "Email failed",
      reason: `The invitation email could not be sent: ${inv.emailError}. Use Resend to try again.`,
    };
  }
  if (inv.expiresAt.getTime() < Date.now()) {
    return {
      status: "Expired",
      reason: `This invitation expired on ${isoDay(inv.expiresAt)}. Use Resend to send a new link.`,
    };
  }
  return { status: "Invited", reason: null };
}

function inviteDto(inv: InviteRow, extra: Record<string, unknown> = {}) {
  const { status, reason } = describeInvite(inv);
  return {
    id: inv.id,
    invitationId: inv.id,
    name: inv.name,
    email: inv.email,
    role: formatRoleLabel(inv.role),
    status,
    reason,
    emailError: inv.emailError ?? null,
    expiresAt: inv.expiresAt,
    createdAt: inv.createdAt,
    ...extra,
  };
}

export class TeamService {
  constructor(private readonly teamRepository: TeamRepository) {}

  private assertCanManageTeam(currentUserRole: string) {
    if (currentUserRole !== Role.OWNER && currentUserRole !== Role.ADMIN) {
      throw new AppError("Only workspace Owners and Admins can manage team members", 403);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Listing                                                             */
  /* ------------------------------------------------------------------ */

  async listMembersAndInvites(organizationId: string) {
    const [users, invites] = await Promise.all([
      this.teamRepository.listMembers(organizationId),
      this.teamRepository.listPendingInvitations(organizationId),
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

    const pendingInvites = invites.map((inv) => inviteDto(inv));

    return {
      data: [...activeMembers, ...pendingInvites],
      members: activeMembers,
      invitations: pendingInvites,
    };
  }

  /**
   * "Recently removed", Owner/Admin only. Two kinds of rows, told apart by `reason`:
   *  - ADMIN: an Owner/Admin removed the person. `canRestore` is true, an admin can bring them back.
   *  - SELF:  the person deleted their own account. They are listed so the team can see it, but only they can
   *           restore it (by signing in), so `canRestore` is false.
   */
  async listRemovedMembers(organizationId: string, currentUserRole: string) {
    this.assertCanManageTeam(currentUserRole);

    const removed = await this.teamRepository.listRemoved(organizationId);
    const removerIds = [
      ...new Set<string>(removed.map((u) => u.removedById).filter((id): id is string => !!id)),
    ];
    const removers = await this.teamRepository.findUsersByIds(removerIds);
    const nameOf = new Map(removers.map((r) => [r.id, r.name]));

    const data = removed.map((u) => {
      const info = recoveryInfo(u.deletedAt as Date);
      const reason = reasonOf(u) === RemovalReason.ADMIN ? ("ADMIN" as const) : ("SELF" as const);
      return {
        reason,
        canRestore: reason === "ADMIN",
        id: u.id,
        name: u.name,
        email: u.email,
        role: formatRoleLabel(u.role),
        avatar: u.avatarUrl ?? null,
        removedAt: u.deletedAt,
        removedBy:
          reason === "SELF"
            ? u.name
            : (u.removedById && nameOf.get(u.removedById)) || "A workspace admin",
        removedById: u.removedById ?? null,
        daysLeft: info.daysLeft,
        restoreDeadline: info.restoreDeadline,
      };
    });

    return { data, removed: data };
  }

  /* ------------------------------------------------------------------ */
  /* Invitations                                                         */
  /* ------------------------------------------------------------------ */

  /** Sends the email and records the outcome on the invitation. Never throws: the invitation is saved either way. */
  private async deliverInvitation(
    invitation: { id: string; email: string; role: Role; token: string },
    senderId: string,
    organizationId: string
  ): Promise<string | null> {
    const [sender, org] = await Promise.all([
      this.teamRepository.findUserWithOrganization(senderId),
      this.teamRepository.findOrganization(organizationId),
    ]);

    let error: string | null = null;
    try {
      const sent = await sendTeamInviteEmail({
        toEmail: invitation.email,
        inviterName: sender?.name || "A workspace administrator",
        organizationName: org?.name || sender?.organization?.name || "your workspace",
        role: formatRoleLabel(invitation.role),
        token: invitation.token,
      });
      if (!sent) {
        error = "email sending is not set up on the server (SMTP_USER / SMTP_PASS)";
      }
    } catch (mailErr) {
      console.error("[MAILER ERROR] Failed to deliver team invitation email:", mailErr);
      error = shortError(mailErr);
    }

    await this.teamRepository.updateInvitation(invitation.id, {
      emailError: error,
      lastSentAt: error ? null : new Date(),
    });
    return error;
  }

  async inviteMember(
    organizationId: string,
    invitedById: string,
    currentUserRole: string,
    input: CreateInvitationInput
  ) {
    this.assertCanManageTeam(currentUserRole);

    const account = await this.teamRepository.findAccountInOrgByEmail(input.email, organizationId);
    if (account && !account.deletedAt) {
      throw new AppError("That person is already on the team.", 409);
    }
    if (account?.deletedAt && reasonOf(account) === RemovalReason.ADMIN) {
      if (!recoveryInfo(account.deletedAt).expired) {
        throw new AppError(
          "That person was removed from the team recently. Restore them from “Recently removed” instead of inviting them again.",
          409
        );
      }
    }

    const existingInvite = await this.teamRepository.findInvitationByEmail(
      input.email,
      organizationId
    );
    if (existingInvite && existingInvite.status === InviteStatus.PENDING) {
      throw new AppError(
        "That email already has an invitation in the list. Use Resend to send a fresh link.",
        409
      );
    }

    const token = newToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const name = input.name || deriveNameFromEmail(input.email);

    // A cancelled or accepted invitation for the same email is re-used instead of adding a second row,
    // so a unique (workspace, email) constraint can never get in the way of inviting somebody again.
    const invitation = existingInvite
      ? await this.teamRepository.updateInvitation(existingInvite.id, {
          name,
          role: input.role,
          token,
          expiresAt,
          invitedById,
          status: InviteStatus.PENDING,
          emailError: null,
          lastSentAt: null,
          acceptedAt: null,
          cancelledAt: null,
        })
      : await this.teamRepository.createInvitation({
          email: input.email,
          name,
          role: input.role,
          token,
          expiresAt,
          invitedById,
          organizationId,
        });

    const emailError = await this.deliverInvitation(invitation, invitedById, organizationId);
    const saved = { ...invitation, emailError };

    await prisma.inAppNotification.create({
      data: {
        organizationId,
        type: "team",
        title: `Invitation sent to ${invitation.email}`,
        body: `An invitation was sent to ${invitation.name} (${invitation.email}) to join as ${formatRoleLabel(invitation.role)}.`,
        read: false,
        href: "/settings?tab=team",
      },
    }).catch(() => {});

    return {
      message: emailError
        ? `Invitation saved, but the email could not be sent: ${emailError}. Use Resend to try again.`
        : `Invitation sent to ${invitation.email}`,
      emailSent: !emailError,
      data: inviteDto(saved, {
        ...(process.env.NODE_ENV !== "production" ? { token: invitation.token } : {}),
      }),
    };
  }

  async resendInvitation(
    organizationId: string,
    currentUserId: string,
    currentUserRole: string,
    invitationId: string
  ) {
    this.assertCanManageTeam(currentUserRole);

    const invite = await this.teamRepository.findInvitationById(invitationId, organizationId);
    if (!invite || invite.status === InviteStatus.CANCELLED) {
      throw new AppError("Invitation not found", 404);
    }
    if (invite.status === InviteStatus.ACCEPTED) {
      throw new AppError("That invitation was already accepted.", 409);
    }

    // A fresh token also kills the old link, and a fresh 7 days replaces an expired one.
    const updated = await this.teamRepository.updateInvitation(invite.id, {
      token: newToken(),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      emailError: null,
    });

    const emailError = await this.deliverInvitation(updated, currentUserId, organizationId);
    const saved = { ...updated, emailError };

    return {
      message: emailError
        ? `The new invitation was saved, but the email could not be sent: ${emailError}.`
        : "Invitation resent",
      emailSent: !emailError,
      data: inviteDto(saved, {
        ...(process.env.NODE_ENV !== "production" ? { token: updated.token } : {}),
      }),
    };
  }

  async revokeInvitation(
    organizationId: string,
    currentUserRole: string,
    invitationId: string
  ) {
    this.assertCanManageTeam(currentUserRole);

    const invite = await this.teamRepository.findInvitationById(invitationId, organizationId);
    if (!invite || invite.status === InviteStatus.CANCELLED) {
      throw new AppError("Invitation not found", 404);
    }
    if (invite.status === InviteStatus.ACCEPTED) {
      throw new AppError("That invitation was already accepted. Remove the member instead.", 409);
    }

    // Kept (not deleted) so the emailed link can say "this invitation was cancelled".
    await this.teamRepository.updateInvitation(invite.id, {
      status: InviteStatus.CANCELLED,
      cancelledAt: new Date(),
    });
    return { message: "Invitation revoked" };
  }

  /* ------------------------------------------------------------------ */
  /* Roles, removal, restore, ownership                                  */
  /* ------------------------------------------------------------------ */

  async updateMemberRole(
    organizationId: string,
    currentUserId: string,
    currentUserRole: string,
    targetId: string,
    input: UpdateMemberRoleInput
  ) {
    this.assertCanManageTeam(currentUserRole);

    if (input.role === Role.OWNER) {
      throw new AppError(
        "A workspace has exactly one Owner. Use “Make owner” to transfer ownership.",
        400
      );
    }

    const member = await this.teamRepository.findMemberById(targetId, organizationId);
    if (member) {
      if (member.role === Role.OWNER) {
        throw new AppError(
          "The Owner's role can only change by transferring ownership to someone else.",
          403
        );
      }
      const updated = await this.teamRepository.updateMemberRole(member.id, input.role);
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

    // Fallback: the id can also be a pending invitation
    const invite = await this.teamRepository.findInvitationById(targetId, organizationId);
    if (invite && invite.status === InviteStatus.PENDING) {
      const updated = await this.teamRepository.updateInvitation(invite.id, { role: input.role });
      return { message: "Role updated", data: inviteDto(updated) };
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
      throw new AppError(
        "You can't remove yourself here. To leave the workspace, delete your own account from your Profile.",
        400
      );
    }

    const member = await this.teamRepository.findMemberById(targetId, organizationId);
    if (member) {
      if (member.role === Role.OWNER) {
        throw new AppError(
          "The Owner can't be removed. Transfer ownership to someone else first.",
          403
        );
      }
      await this.teamRepository.softDeleteMember(member.id, currentUserId);
      await prisma.inAppNotification.create({
        data: {
          organizationId,
          type: "team",
          title: `${member.name} was removed from the team`,
          body: `${member.name} (${member.email}) was removed from the team. They can be restored from Recently removed.`,
          read: false,
          href: "/settings?tab=team",
        },
      }).catch(() => {});
      const info = recoveryInfo(new Date());
      return {
        message: `${member.name} was removed. You can restore them for the next 30 days.`,
        data: { restoreDeadline: info.restoreDeadline, daysLeft: info.daysLeft },
      };
    }

    // Fallback: the id can also be a pending invitation
    const invite = await this.teamRepository.findInvitationById(targetId, organizationId);
    if (invite && invite.status === InviteStatus.PENDING) {
      await this.teamRepository.updateInvitation(invite.id, {
        status: InviteStatus.CANCELLED,
        cancelledAt: new Date(),
      });
      return { message: "Invitation revoked" };
    }

    throw new AppError("Team member not found", 404);
  }

  async restoreMember(organizationId: string, currentUserRole: string, targetId: string) {
    this.assertCanManageTeam(currentUserRole);

    const user = await this.teamRepository.findRemovedById(targetId, organizationId);
    // The Owner never shows up in "Recently removed", so there is nothing to restore for them here.
    if (!user || user.role === Role.OWNER) {
      throw new AppError("That account isn't in Recently removed.", 404);
    }
    if (reasonOf(user) !== RemovalReason.ADMIN) {
      throw new AppError(
        "That person deleted their own account. They can restore it themselves by signing in.",
        400
      );
    }
    if (recoveryInfo(user.deletedAt as Date).expired) {
      throw new AppError("The 30-day restore window for this account has passed.", 410);
    }

    const restored = await this.teamRepository.restoreMember(user.id);
    await prisma.inAppNotification.create({
      data: {
        organizationId,
        type: "team",
        title: `${restored.name}'s account was restored`,
        body: `${restored.name} (${restored.email}) was restored to the team as ${formatRoleLabel(restored.role)}.`,
        read: false,
        href: "/settings?tab=team",
      },
    }).catch(() => {});
    return {
      message: `${restored.name} was restored to the team`,
      data: {
        id: restored.id,
        name: restored.name,
        email: restored.email,
        role: formatRoleLabel(restored.role),
        status: "Active" as const,
      },
    };
  }

  async transferOwnership(
    organizationId: string,
    currentUserId: string,
    currentUserRole: string,
    input: TransferOwnershipInput,
    targetIdFromUrl?: string
  ) {
    if (currentUserRole !== Role.OWNER) {
      throw new AppError("Only the workspace Owner can transfer ownership.", 403);
    }

    const targetId = targetIdFromUrl || input.memberId || input.newOwnerId;
    if (!targetId) {
      throw new AppError("Choose the team member who should become the Owner.", 400);
    }
    if (targetId === currentUserId) {
      throw new AppError("You are already the Owner.", 400);
    }

    const owner = await this.teamRepository.findMemberById(currentUserId, organizationId);
    if (!owner) {
      throw new AppError("Authentication required", 401);
    }
    const target = await this.teamRepository.findMemberById(targetId, organizationId);
    if (!target) {
      throw new AppError(
        "Ownership can only go to an active team member. Invited people must accept first.",
        404
      );
    }
    if (target.role === Role.OWNER) {
      throw new AppError("That person is already the Owner.", 400);
    }

    const { previousOwner, newOwner } = await this.teamRepository.transferOwnership(
      owner.id,
      target.id
    );

    return {
      message: `${newOwner.name} is now the Owner. You are now an Admin and have been signed out. Sign in again to continue.`,
      // The previous Owner's sessions were just revoked (tokenVersion bump), so the app signs them out right away.
      signedOut: true,
      data: {
        newOwner: {
          id: newOwner.id,
          name: newOwner.name,
          email: newOwner.email,
          role: formatRoleLabel(newOwner.role),
          status: "Active" as const,
        },
        previousOwner: {
          id: previousOwner.id,
          name: previousOwner.name,
          email: previousOwner.email,
          role: formatRoleLabel(previousOwner.role),
          status: "Active" as const,
        },
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Accepting an invitation (public: the person may not be signed in)   */
  /* ------------------------------------------------------------------ */

  /**
   * Can this existing account move into the inviting workspace? Returns the reason it can't, or null.
   * Protects real data: somebody who owns a workspace with a team, or one they already set up, can't be silently
   * moved out of it by an invitation.
   */
  private async explainJoinBlock(
    existing: NonNullable<Awaited<ReturnType<TeamRepository["findAnyUserByEmail"]>>>,
    organizationId: string
  ): Promise<string | null> {
    if (existing.organizationId === organizationId) {
      return existing.deletedAt ? null : "You are already a member of this workspace.";
    }
    // A removed / deleted account has nothing active to lose.
    if (existing.deletedAt) return null;

    if (existing.role === Role.OWNER) {
      const active = await this.teamRepository.countActiveUsers(existing.organizationId);
      if (active > 1) {
        return "You own another workspace that has team members. Transfer its ownership or delete it before joining a new one.";
      }
      if (existing.organization?.onboardingCompleted) {
        return "You already own a workspace that is set up. Delete it from Settings > Profile before joining another one.";
      }
    }
    return null;
  }

  private inviteState(invite: { status: string; expiresAt: Date }) {
    if (invite.status === InviteStatus.ACCEPTED) return "accepted" as const;
    if (invite.status === InviteStatus.CANCELLED) return "cancelled" as const;
    if (invite.expiresAt.getTime() < Date.now()) return "expired" as const;
    return "valid" as const;
  }

  /**
   * What the /accept-invite page needs before it shows a form: is the link usable, who invited me, and do I
   * already have an account (password only) or not (name + password).
   * Always answers 200; `state` is valid | expired | cancelled | accepted | not_found.
   */
  async lookupInvitation(token: string) {
    const invite = await this.teamRepository.findInvitationByToken(token);
    if (!invite) {
      return {
        data: {
          state: "not_found" as const,
          message: "This invitation link isn't valid. Ask for a new one.",
        },
      };
    }

    const state = this.inviteState(invite);
    const [inviter, existing] = await Promise.all([
      invite.invitedById
        ? this.teamRepository.findUserWithOrganization(invite.invitedById)
        : Promise.resolve(null),
      this.teamRepository.findAnyUserByEmail(invite.email),
    ]);
    const blockedReason = existing
      ? await this.explainJoinBlock(existing, invite.organizationId)
      : null;

    const messages = {
      valid: null,
      expired: "This invitation has expired. Ask the person who invited you to send a new one.",
      cancelled: "This invitation was cancelled. Ask the person who invited you to send a new one.",
      accepted: "This invitation was already used. Sign in to open the workspace.",
    } as const;

    return {
      data: {
        state,
        message: messages[state],
        email: invite.email,
        name: invite.name,
        role: formatRoleLabel(invite.role === Role.OWNER ? Role.ADMIN : invite.role),
        organizationName: invite.organization?.name ?? null,
        inviterName: inviter?.name ?? null,
        accountExists: !!existing,
        canJoin: state === "valid" && !blockedReason,
        blockedReason,
        expiresAt: invite.expiresAt,
      },
    };
  }

  async acceptInvitation(input: AcceptInvitationInput) {
    const invite = await this.teamRepository.findInvitationByToken(input.token);
    if (!invite) {
      throw new AppError("This invitation link isn't valid. Ask for a new one.", 404, {
        code: "INVITE_NOT_FOUND",
      });
    }

    const state = this.inviteState(invite);
    if (state === "accepted") {
      throw new AppError("This invitation was already used. Sign in to open the workspace.", 410, {
        code: "INVITE_USED",
      });
    }
    if (state === "cancelled") {
      throw new AppError("This invitation was cancelled. Ask for a new one.", 410, {
        code: "INVITE_CANCELLED",
      });
    }
    if (state === "expired") {
      throw new AppError("This invitation has expired. Ask for a new one.", 410, {
        code: "INVITE_EXPIRED",
      });
    }

    // There is only ever one Owner, so even an old invitation that says Owner joins as Admin.
    const role = invite.role === Role.OWNER ? Role.ADMIN : invite.role;
    const existing = await this.teamRepository.findAnyUserByEmail(invite.email);

    let user;
    if (existing) {
      if (!input.password) {
        throw new AppError("Enter your password to join this workspace.", 400, {
          code: "PASSWORD_REQUIRED",
        });
      }
      const passwordOk = await bcrypt.compare(input.password, existing.passwordHash);
      if (!passwordOk) {
        throw new AppError("Incorrect password", 400, { code: "WRONG_PASSWORD" });
      }
      const blocked = await this.explainJoinBlock(existing, invite.organizationId);
      if (blocked) {
        throw new AppError(blocked, 409, { code: "CANNOT_JOIN" });
      }
      user = await this.teamRepository.acceptForExistingUser(
        invite.id,
        existing.id,
        invite.organizationId,
        role
      );
    } else {
      if (!input.password) {
        throw new AppError("Choose a password to create your account.", 400, {
          code: "PASSWORD_REQUIRED",
        });
      }
      const strength = strongPasswordSchema.safeParse(input.password);
      if (!strength.success) {
        throw new AppError(strength.error.issues.map((i) => i.message).join(", "), 400);
      }
      const passwordHash = await bcrypt.hash(input.password, 10);
      user = await this.teamRepository.acceptForNewUser(invite.id, {
        name: input.name || invite.name,
        email: invite.email,
        passwordHash,
        role,
        organizationId: invite.organizationId,
      });
    }

    if (!user) {
      // Somebody used the link a split second earlier.
      throw new AppError("This invitation was already used. Sign in to open the workspace.", 410, {
        code: "INVITE_USED",
      });
    }

    await prisma.inAppNotification.create({
      data: {
        organizationId: invite.organizationId,
        type: "team",
        title: `${user.name} joined your workspace`,
        body: `${user.name} (${user.email}) accepted the invitation and joined as ${formatRoleLabel(user.role)}.`,
        read: false,
        href: "/settings?tab=team",
      },
    }).catch(() => {});

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

    // Same shape as POST /api/auth/login, so the frontend can store it exactly like a normal sign-in.
    return {
      message: "Invitation accepted successfully",
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization: {
            id: user.organization.id,
            name: user.organization.name,
            onboardingCompleted: user.organization.onboardingCompleted ?? false,
          },
          createdAt: user.createdAt,
        },
      },
    };
  }
}
