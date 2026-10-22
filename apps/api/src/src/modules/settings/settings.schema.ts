import { z } from "zod";

export const outreachSettingsSchema = z.object({
  tone: z.enum(["professional", "friendly", "direct"]).optional(),
  maxFollowUps: z.coerce.number().int().min(1).max(7).optional(),
  followUps: z.coerce.number().int().min(1).max(7).optional(),
  intervalDays: z.coerce.number().int().min(1).max(14).optional(),
  gapDays: z.coerce.number().int().min(1).max(14).optional(),
  dailyCap: z.coerce.number().int().min(10).max(100).optional(),
  weeklyLinkedinLimit: z.coerce.number().int().min(1).max(500).optional(),
  postingFrequency: z.string().trim().min(1).max(50).optional(),
});

export const approvalRulesSchema = z.object({
  threshold: z.coerce.number().int().min(70).max(99).optional(),
  replies: z.boolean().optional(),
  followups: z.boolean().optional(),
  linkedin: z.boolean().optional(),
  toggles: z
    .object({
      replies: z.boolean().optional(),
      followups: z.boolean().optional(),
      linkedin: z.boolean().optional(),
    })
    .optional(),
});

const notificationRuleItemSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().optional(),
  badge: z
    .object({
      label: z.string(),
      tone: z.enum(["primary", "success", "warning", "destructive"]),
    })
    .optional(),
  description: z.string().optional(),
  email: z.boolean(),
  inApp: z.boolean(),
});

export const updateNotificationsSchema = z.union([
  z.array(notificationRuleItemSchema),
  z.object({
    rules: z.array(notificationRuleItemSchema),
  }),
  z.record(
    z.string(),
    z.object({
      email: z.boolean().optional(),
      inApp: z.boolean().optional(),
    })
  ),
]);

export const updateAiLimitSchema = z.object({
  aiLimit: z.coerce
    .number()
    .positive("Enter an amount greater than $0."),
});

export const updateTestModeSchema = z
  .object({
    testMode: z.boolean().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((d) => typeof d.testMode === "boolean" || typeof d.enabled === "boolean", {
    message: "Provide 'testMode' or 'enabled' as a boolean",
  });

export type OutreachSettingsInput = z.infer<typeof outreachSettingsSchema>;
export type ApprovalRulesInput = z.infer<typeof approvalRulesSchema>;
export type UpdateNotificationsInput = z.infer<typeof updateNotificationsSchema>;
export type UpdateAiLimitInput = z.infer<typeof updateAiLimitSchema>;
export type UpdateTestModeInput = z.infer<typeof updateTestModeSchema>;
