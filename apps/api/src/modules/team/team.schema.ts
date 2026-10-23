import { z } from "zod";
import { Role } from "@ai-sales-agent/database";

const roleInputSchema = z
  .string()
  .transform((val) => val.trim().toUpperCase())
  .refine((val): val is Role => val === "OWNER" || val === "ADMIN" || val === "MEMBER", {
    message: "Role must be Owner, Admin, or Member",
  });

/** Invitations can only create Admins or Members. There is exactly one Owner, moved with "Make owner". */
const inviteRoleSchema = z
  .string()
  .transform((val) => val.trim().toUpperCase())
  .refine((val): val is Role => val === "ADMIN" || val === "MEMBER", {
    message: "Invitations can only be Admin or Member. Use “Make owner” to transfer ownership.",
  });

export const createInvitationSchema = z.object({
  email: z.string().trim().email("Please provide a valid work email."),
  role: inviteRoleSchema.default(Role.MEMBER),
  name: z.string().trim().min(1).optional(),
});

export const updateMemberRoleSchema = z.object({
  role: roleInputSchema,
});

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(1, "Invitation token is required"),
  // New person: the name they pick. Ignored when the email already has an account.
  name: z.string().trim().min(2, "Name must be at least 2 characters long").optional(),
  // New person: the password they choose (strength is checked in the service).
  // Existing account: their current password, which proves it is really them.
  password: z.string().min(1, "Password is required").optional(),
});

export const transferOwnershipSchema = z.object({
  // The new Owner. Also accepted from the URL: POST /members/:id/transfer-ownership
  memberId: z.string().trim().min(1).optional(),
  newOwnerId: z.string().trim().min(1).optional(),
  // No longer required: the Owner just picks the new Owner and confirms in the app. Old clients may still send it; it is ignored.
  password: z.string().optional(),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
