import { z } from "zod";

export const opportunityTypeSchema = z.enum(["client_project", "job_posting", "freelance"]);
export const opportunityStatusSchema = z.enum(["open", "saved", "dismissed"]);
export const postedWithinSchema = z.enum(["any", "24h", "7d", "30d"]);

export const searchOpportunitiesSchema = z.object({
  // An empty keyword list used to match every posting, so "clear the keywords and search" showed everything again.
  keywords: z
    .array(z.string())
    .default([])
    .transform((list) => list.map((k) => k.trim()).filter(Boolean))
    .refine((list) => list.length > 0, { message: "Add at least one keyword before searching." }),
  sourceIds: z.array(z.string()).default([]),
  types: z.array(opportunityTypeSchema).default(["client_project", "job_posting", "freelance"]),
  minRelevance: z.number().min(0).max(100).default(75),
  postedWithin: postedWithinSchema.default("30d"),
});

/** Saving needs no input: the server finds the contact itself from the company's website. */
export const saveOpportunitySchema = z.object({}).passthrough();

export type SearchOpportunitiesInput = z.infer<typeof searchOpportunitiesSchema>;
export type SaveOpportunityInput = z.infer<typeof saveOpportunitySchema>;
