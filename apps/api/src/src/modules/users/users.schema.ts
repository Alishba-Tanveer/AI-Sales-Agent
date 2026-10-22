import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long").optional(),
  email: z.string().trim().email("Invalid email address").optional(),
  roleTitle: z.string().trim().max(120).optional(),
  timezone: z.string().trim().max(120).optional(),
  tz: z.string().trim().max(120).optional(),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required to delete your account"),
  confirm: z.string().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
