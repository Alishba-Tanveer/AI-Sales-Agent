import { z } from "zod";

export const strongPasswordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters long")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[0-9]/, "Password must include at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one symbol (e.g. ! @ # $)");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long"),
  email: z.string().trim().email("Invalid email address"),
  password: strongPasswordSchema,
  organizationName: z.string().trim().min(2).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  otp: z.string().trim().regex(/^\d{6}$/, "OTP must be a 6-digit numeric code"),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  otp: z.string().trim().regex(/^\d{6}$/, "OTP must be a 6-digit numeric code"),
  newPassword: strongPasswordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required").optional(),
    current: z.string().min(1, "Current password is required").optional(),
    newPassword: strongPasswordSchema.optional(),
    next: strongPasswordSchema.optional(),
  })
  .refine((d) => Boolean(d.currentPassword || d.current), {
    message: "Current password is required",
  })
  .refine((d) => Boolean(d.newPassword || d.next), {
    message: "New password is required",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
