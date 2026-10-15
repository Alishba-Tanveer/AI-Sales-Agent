import { z } from "zod";

const list = (label: string, max = 10) =>
  z.array(z.string().trim().min(1)).min(1, `Add at least one ${label}`).max(max, `Up to ${max} ${label}s`);

export const onboardingSchema = z.object({
  companyName: z.string().trim().min(2, "Enter your company name"),
  websiteUrl: z.string().trim().min(1, "Enter your website URL").regex(/^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/.*)?$/i, "Enter a valid URL, e.g. https://example.com"),
  industry: z.string().min(1, "Select an industry"),
  description: z.string().optional(),
  services: list("service", 5),
  differentiation: z.string().optional(),
  targetIndustries: list("industry"),
  targetTitles: list("job title"),
  locations: list("location"),
  companySize: z.string().min(1, "Select a company size"),
  customerDescription: z.string().optional(),
});
export type OnboardingValues = z.infer<typeof onboardingSchema>;

export const STEP_FIELDS: (keyof OnboardingValues)[][] = [
  ["companyName", "websiteUrl", "industry", "description"],
  ["services", "differentiation"],
  ["targetIndustries", "targetTitles", "locations", "companySize", "customerDescription"],
  [],
];
