import { z } from "zod";

export const createInboundMessageSchema = z.object({
  leadId: z.string().min(1),
  channel: z.enum(["EMAIL", "LINKEDIN"]),
  subject: z.string().trim().max(240).optional().or(z.literal("")),
  body: z.string().trim().min(1).max(20_000),
  occurredAt: z.string().datetime().optional(),
});
