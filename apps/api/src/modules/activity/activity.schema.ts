import { z } from "zod";

export const jobKindSchema = z.enum([
  "research",
  "draft",
  "sync",
  "enrich",
  "invite",
  "analyze",
  "discover",
  "followup",
]);

export const jobStatusSchema = z.enum([
  "completed",
  "running",
  "failed",
  "queued",
  "cancelled",
]);

export const agentNameSchema = z.enum(["General Agent", "LinkedIn Agent"]);

export const listActivityQuerySchema = z.object({
  tab: z.enum(["all", "running", "failed", "completed"]).optional(),
  agent: agentNameSchema.optional(),
  kind: jobKindSchema.optional(),
  status: jobStatusSchema.optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(0).optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
});

export const createActivityJobSchema = z.object({
  kind: jobKindSchema,
  title: z.string().min(1),
  leadId: z.string().nullable().optional(),
  leadName: z.string().nullable().optional(),
  leadContext: z.string().default(""),
  agent: agentNameSchema.default("General Agent"),
  status: jobStatusSchema.default("running"),
  startedAt: z.string().nullable().optional(),
  scheduledFor: z.string().nullable().optional(),
  durationSec: z.number().nullable().optional(),
  retries: z.number().default(0),
  maxRetries: z.number().default(3),
  output: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>;
export type CreateActivityJobInput = z.infer<typeof createActivityJobSchema>;
