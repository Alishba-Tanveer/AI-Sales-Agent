import { z } from "zod";

const host = z.string().trim().min(3).max(200).regex(/^[a-z0-9.-]+$/i, "Enter a server name such as imap.gmail.com");

export const connectMailboxSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(4).max(200),
  fromName: z.string().trim().max(120).optional().or(z.literal("")),
  imapHost: host.optional(),
  imapPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpHost: host.optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
});

export const mailboxSettingsSchema = z.object({
  autoSync: z.boolean().optional(),
  autoDraft: z.boolean().optional(),
  dailyLimit: z.coerce.number().int().min(1).max(150).optional(),
  fromName: z.string().trim().max(120).optional(),
});

export const syncMailboxSchema = z.object({ lookbackDays: z.coerce.number().int().min(1).max(60).optional() });

export const sendDraftSchema = z.object({
  subject: z.string().trim().min(1, "The subject cannot be empty").max(240).optional(),
  body: z.string().trim().min(1, "The message cannot be empty").max(10_000).optional(),
});
