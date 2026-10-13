import { z } from "zod";

export const LEAD_STAGES = [
  "NEW",
  "REVIEWED",
  "CONTACTED",
  "INTERESTED",
  "WON",
  "LOST"
] as const;

export const leadStageSchema = z.enum(LEAD_STAGES);
export type LeadStage = z.infer<typeof leadStageSchema>;