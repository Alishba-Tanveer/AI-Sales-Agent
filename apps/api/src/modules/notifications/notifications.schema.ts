import { z } from "zod";

export const notificationTypeSchema = z.enum([
  "reply",
  "approval",
  "failure",
  "lead",
  "team",
  "system",
]);

export const listNotificationsQuerySchema = z.object({
  filter: z.enum(["all", "unread"]).optional(),
  type: notificationTypeSchema.optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
});

export const updateNotificationSchema = z.object({
  read: z.boolean(),
});

export const createNotificationSchema = z.object({
  type: notificationTypeSchema.default("system"),
  title: z.string().min(1),
  body: z.string().min(1),
  read: z.boolean().default(false),
  href: z.string().nullable().optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type UpdateNotificationInput = z.infer<typeof updateNotificationSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
