import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  organizationName: z.string().trim().min(2).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;