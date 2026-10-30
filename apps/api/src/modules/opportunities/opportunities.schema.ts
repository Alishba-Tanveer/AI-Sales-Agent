import { z } from "zod";

export const opportunityTypeSchema = z.enum(["client_project", "job_posting", "freelance"]);
export const opportunityStatusSchema = z.enum(["open", "saved", "dismissed"]);
export const postedWithinSchema = z.enum(["any", "24h", "7d", "30d"]);

export const searchOpportunitiesSchema = z.object({
  keywords: z.array(z.string()).default([]),
  sourceIds: z.array(z.string()).default([]),
  types: z.array(opportunityTypeSchema).default(["client_project", "job_posting", "freelance"]),
  minRelevance: z.number().min(0).max(100).default(75),
  postedWithin: postedWithinSchema.default("30d"),
});

export const saveOpportunitySchema = z.object({
  leadId: z.string().min(1, "leadId is required"),
});

export type SearchOpportunitiesInput = z.infer<typeof searchOpportunitiesSchema>;
export type SaveOpportunityInput = z.infer<typeof saveOpportunitySchema>;
