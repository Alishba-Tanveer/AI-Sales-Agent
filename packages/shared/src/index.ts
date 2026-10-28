import { z } from "zod";

export const LEAD_STAGES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "WON",
  "LOST",
  "DO_NOT_CONTACT",
] as const;

export const leadStageSchema = z.enum(LEAD_STAGES);
export type LeadStage = z.infer<typeof leadStageSchema>;
