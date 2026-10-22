import { z } from "zod";
import { Role } from "@ai-sales-agent/database";
import { strongPasswordSchema } from "../auth/auth.schema";

const roleInputSchema = z
  .string()
  .transform((val) => val.trim().toUpperCase())
  .refine((val): val is Role => val === "OWNER" || val === "ADMIN" || val === "MEMBER", {
    message: "Role must be Owner, Admin, or Member",
  });

export const createInvitationSchema = z.object({
  email: z.string().trim().email("Please provide a valid work email."),
  role: roleInputSchema.default(Role.MEMBER),
  name: z.string().trim().min(1).optional(),
});

export const updateMemberRoleSchema = z.object({
  role: roleInputSchema,
});

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(1, "Invitation token is required"),
  name: z.string().trim().min(2, "Name must be at least 2 characters long").optional(),
  password: strongPasswordSchema.optional(),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
