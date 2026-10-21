import { z } from "zod";

export const listActivityQuerySchema = z.object({
  type: z.string().trim().optional(),
  status: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const triggerTestJobSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  shouldFailTimes: z.coerce.number().int().min(0).max(5).default(1),
  alwaysFail: z.boolean().default(false),
  maxAttempts: z.coerce.number().int().min(1).max(5).default(3),
});

export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>;
export type TriggerTestJobInput = z.infer<typeof triggerTestJobSchema>;
