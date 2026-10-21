import { z } from "zod";
import { ApprovalType, ApprovalStatus } from "@ai-sales-agent/database";

const approvalTypeSchema = z
  .string()
  .transform((v) => v.trim().toUpperCase().replace(/-/g, "_"))
  .refine(
    (v): v is ApprovalType =>
      v === "NEW_EMAIL" ||
      v === "VIDEO_SCRIPT" ||
      v === "REPLY" ||
      v === "FOLLOW_UP" ||
      v === "LINKEDIN_PROFILE" ||
      v === "LINKEDIN_POST" ||
      v === "CONNECTION_NOTE",
    {
      message:
        "Invalid approval type. Use NEW_EMAIL, VIDEO_SCRIPT, REPLY, FOLLOW_UP, LINKEDIN_PROFILE, LINKEDIN_POST, or CONNECTION_NOTE.",
    }
  );

export const createApprovalSchema = z.object({
  type: approvalTypeSchema.default(ApprovalType.NEW_EMAIL),
  title: z.string().trim().min(2, "Title is required").max(200),
  subtitle: z.string().trim().max(300).optional(),
  content: z
    .record(z.string(), z.unknown())
    .or(z.object({}).passthrough())
    .default({}),
  confidence: z.coerce.number().int().min(0).max(100).default(90),
  leadId: z.string().trim().optional(),
  estimatedCostUsd: z.coerce.number().min(0).max(10).default(0.02),
});

export const approveItemSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  subtitle: z.string().trim().max(300).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
});

export const rejectItemSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const bulkApproveSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, "Provide at least one approval ID"),
});

export const listApprovalsQuerySchema = z.object({
  status: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .refine(
      (v): v is ApprovalStatus =>
        v === "PENDING" ||
        v === "APPROVED" ||
        v === "AUTO_APPROVED" ||
        v === "REJECTED",
      { message: "Invalid status filter" }
    )
    .optional(),
  type: approvalTypeSchema.optional(),
});

export type CreateApprovalInput = z.infer<typeof createApprovalSchema>;
export type ApproveItemInput = z.infer<typeof approveItemSchema>;
export type RejectItemInput = z.infer<typeof rejectItemSchema>;
export type BulkApproveInput = z.infer<typeof bulkApproveSchema>;
