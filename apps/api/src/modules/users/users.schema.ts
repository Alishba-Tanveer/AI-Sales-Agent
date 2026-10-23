import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long").optional(),
  email: z.string().trim().email("Invalid email address").optional(),
  roleTitle: z.string().trim().max(120).optional(),
  timezone: z.string().trim().max(120).optional(),
  tz: z.string().trim().max(120).optional(),
});

/**
 * Deleting your own account needs no password or typed word: the person is signed in and the app has
 * already asked "are you sure?". Only an Owner sends anything here, to say what happens to the workspace:
 *   transferToId     hand the workspace to this active team member, then delete only the Owner's own login
 *   deleteWorkspace  delete the whole business for everyone
 */
export const deleteAccountSchema = z.object({
  transferToId: z.string().trim().min(1).optional(),
  deleteWorkspace: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
