import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean().optional(),
});
export type LoginValues = z.infer<typeof loginSchema>;

// Mirrors backend registerSchema (name >= 2, email, password >= 6) + UI-only fields
export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters long"),
    email: z.string().trim().email("Enter a valid work email address"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
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

export const forgotSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});
export type ForgotValues = z.infer<typeof forgotSchema>;

export function passwordStrength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

export const resetSchema = z
  .object({
    newPassword: z.string().min(6, "New password must be at least 6 characters long"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });
export type ResetValues = z.infer<typeof resetSchema>;
