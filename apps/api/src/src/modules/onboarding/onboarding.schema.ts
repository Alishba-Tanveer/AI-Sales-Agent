import { z } from "zod";

export const onboardingSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required"),
  websiteUrl: z.string().trim().optional().or(z.literal("")),
  industry: z.string().optional().or(z.literal("")),
  description: z.string().optional(),
  services: z.array(z.string()).default([]),
  differentiation: z.string().optional(),
  targetIndustries: z.array(z.string()).default([]),
  targetTitles: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  companySize: z.string().optional().or(z.literal("")),
  customerDescription: z.string().optional(),
  complete: z.boolean().optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
