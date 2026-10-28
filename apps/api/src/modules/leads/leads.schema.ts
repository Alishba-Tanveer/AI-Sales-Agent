import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const webUrl = z.string().trim().url().optional().or(z.literal(""));

export const leadStageSchema = z.enum(["NEW", "CONTACTED", "INTERESTED", "WON", "LOST", "DO_NOT_CONTACT"]);

export const createLeadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.union([z.string().trim().email().max(320), z.literal("")]).optional(),
  company: optionalText(160),
  jobTitle: optionalText(160),
  source: optionalText(80),
  notes: optionalText(10_000),
  linkedinUrl: webUrl,
  websiteUrl: webUrl,
  nextFollowUpAt: z.string().datetime().optional().or(z.literal("")),
  stage: leadStageSchema.optional(),
});

export const updateLeadSchema = createLeadSchema.partial();
export const importLeadsSchema = z.object({ leads: z.array(createLeadSchema).min(1).max(500) });
export const listLeadsQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  stage: leadStageSchema.optional(),
  includeArchived: z.string().optional().transform((value) => value === "true"),
});

export const draftEmailSchema = z.object({ instruction: optionalText(500).optional() });
