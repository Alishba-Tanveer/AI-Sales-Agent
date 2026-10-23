import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean().optional(),
});
export type LoginValues = z.infer<typeof loginSchema>;

/** Password policy shared by Sign up and Reset password. */
export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters long")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[0-9]/, "Password must include at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one symbol (e.g. ! @ # $)");

// Mirrors backend registerSchema (name >= 2, email, password >= 6) + UI-only fields
export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters long"),
    email: z.string().trim().email("Enter a valid work email address"),
    password: passwordSchema,
    confirmPassword: z.string(),
    terms: z.literal(true, {
      errorMap: () => ({ message: "You must agree to the Terms of Service and Privacy Policy to continue." }),
    }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
export type SignupValues = z.infer<typeof signupSchema>;

/** Invitation acceptance: existing account confirms its password. */
export const acceptExistingSchema = z.object({
  password: z.string().min(1, "Enter your password"),
});
export type AcceptExistingValues = z.infer<typeof acceptExistingSchema>;

/** Invitation acceptance: new account supplies a name and password. */
export const acceptNewSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters long"),
    password: passwordSchema,
    confirmPassword: z.string(),
    terms: z.literal(true, {
      errorMap: () => ({ message: "You must agree to the Terms of Service and Privacy Policy to continue." }),
    }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
export type AcceptNewValues = z.infer<typeof acceptNewSchema>;

export const forgotSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});
export type ForgotValues = z.infer<typeof forgotSchema>;

/** Each rule needs at least one match; more than one is fine. */
export const PASSWORD_RULES = [
  { id: "length", label: "6+ characters", test: (p: string) => p.length >= 6 },
  { id: "upper", label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { id: "number", label: "Number", test: (p: string) => /[0-9]/.test(p) },
  { id: "symbol", label: "Symbol", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

/** 0-4 for the strength bar: counts the four character-type rules. */
export function passwordStrength(p: string) {
  return PASSWORD_RULES.filter((r) => r.id !== "length" && r.test(p)).length;
}

export const OTP_LENGTH = 6;

export const otpSchema = z.object({
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});
export type OtpValues = z.infer<typeof otpSchema>;

export const resetSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });
export type ResetValues = z.infer<typeof resetSchema>;
