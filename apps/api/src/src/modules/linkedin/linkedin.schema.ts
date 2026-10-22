import { z } from "zod";

const PROFILE_RE = /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)?linkedin\.com\/(?:in|pub)\/([^/?#\s]+)/i;

export function normalizeLinkedInProfileUrl(value: string): string | null {
  const m = value.trim().match(PROFILE_RE);
  return m ? `https://www.linkedin.com/in/${m[1]}` : null;
}

export function normalizeWebUrl(value: string): string | null {
  const v = value.trim();
  if (!v || /\s/.test(v)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export const suggestionKeySchema = z.enum(["headline", "about", "experience", "skills", "featured"]);

export const analyzeProfileSchema = z.object({
  profileUrl: z.string().trim().optional(),
  offer: z.string().trim().max(1000).optional(),
  audience: z.string().trim().max(1000).optional(),
  niche: z
    .object({
      offer: z.string().trim().max(1000).optional(),
      audience: z.string().trim().max(1000).optional(),
    })
    .optional(),
  headline: z.string().trim().max(500).optional(),
  about: z.string().trim().max(3000).optional(),
  experience: z.string().trim().max(3000).optional(),
  skills: z.string().trim().max(1000).optional(),
  featured: z.string().trim().max(1000).optional(),
});

export const updateSuggestionSchema = z.object({
  done: z.boolean().optional(),
  status: z.enum(["pending", "accepted", "dismissed", "applied"]).optional(),
  suggested: z.string().trim().min(1).max(3000).optional(),
  current: z.string().trim().max(3000).optional(),
  why: z.string().trim().max(1000).optional(),
});

export const markAppliedSchema = z.object({
  keys: z.array(z.string().trim()).optional(),
  key: z.string().trim().optional(),
});

export const updateGroundingFactSchema = z.object({
  value: z.string().trim().max(2000).optional(),
  answer: z.string().trim().max(2000).optional(),
  offer: z.string().trim().max(2000).optional(),
  audience: z.string().trim().max(2000).optional(),
});

export const scriptStatusSchema = z.enum(["needs_approval", "creating_video", "ready", "posted"]);

export const createScriptSchema = z
  .object({
    topic: z.string().trim().min(3, "Enter a topic of at least 3 characters.").max(300).optional(),
    title: z.string().trim().min(3).max(300).optional(),
    hook: z.string().trim().max(1000).optional(),
    points: z.array(z.string().trim().min(1)).max(15).optional(),
    cta: z.string().trim().max(500).optional(),
    source: z.string().trim().max(120).optional(),
    sourceUrl: z.string().trim().max(500).optional(),
  })
  .refine((data) => Boolean(data.topic || data.title), {
    message: "Enter a topic of at least 3 characters.",
    path: ["topic"],
  });

export const updateScriptSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  hook: z.string().trim().min(1).max(1000).optional(),
  points: z.array(z.string().trim().min(1)).max(15).optional(),
  cta: z.string().trim().min(1).max(500).optional(),
  status: scriptStatusSchema.optional(),
  draftNo: z.number().int().min(1).optional(),
  source: z.string().trim().max(120).optional(),
  sourceUrl: z.string().trim().max(500).optional(),
  date: z.string().trim().optional(),
  seconds: z.number().int().min(1).max(600).optional(),
  words: z.number().int().min(1).max(5000).optional(),
  scheduledFor: z.string().trim().nullable().optional(),
  postedAt: z.string().trim().nullable().optional(),
  postUrl: z.string().trim().nullable().optional(),
  postDeleted: z.boolean().optional(),
});

export const approveScriptSchema = z.object({
  scheduledFor: z.string().trim().optional(),
  scheduledAt: z.string().trim().optional(),
  remindAt: z.string().trim().optional(),
  readyImmediately: z.boolean().optional(),
});

export const bulkApproveScriptsSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, "Select at least one script to approve."),
  scheduledFor: z.string().trim().optional(),
});

export const markPostedSchema = z.object({
  postUrl: z.string().trim().optional(),
});

export const checkPostStatusSchema = z.object({
  postUrl: z.string().trim().optional(),
  scriptId: z.string().trim().optional(),
});

export const updateContentSettingsSchema = z.object({
  remindAt: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Pick a valid reminder time (HH:MM).")
    .optional(),
  avatar: z.string().trim().min(1, "Enter an avatar name.").max(120).optional(),
  heygenConnected: z.boolean().optional(),
});

export const updateContentSourcesSchema = z.object({
  sources: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        url: z.string().trim().min(1).max(500),
        enabled: z.boolean().optional(),
      }),
    )
    .min(1),
});

export const updateStrategySchema = z.object({
  who: z.string().trim().min(1, "Fill in who to target and what to say.").max(1000),
  message: z.string().trim().min(1, "Fill in who to target and what to say.").max(1000),
  perDay: z.coerce
    .number()
    .int("Requests per day must be between 1 and 40.")
    .min(1, "Requests per day must be between 1 and 40.")
    .max(40, "Requests per day must be between 1 and 40."),
  followUpDays: z.coerce
    .number()
    .int("Follow-up must be between 1 and 30 days.")
    .min(1, "Follow-up must be between 1 and 30 days.")
    .max(30, "Follow-up must be between 1 and 30 days."),
  agreedOn: z.string().trim().optional(),
});

export const leadSourceSchema = z.enum(["engaged", "buyer"]);
export const leadStatusSchema = z.enum(["suggested", "approved", "pending", "connected", "skipped"]);
export const leadReasonKindSchema = z.enum(["like", "comment", "view", "fit"]);

export const createLeadSchema = z.object({
  name: z.string().trim().min(2, "Enter a name and a LinkedIn profile link.").max(120),
  role: z.string().trim().max(120).optional(),
  company: z.string().trim().max(120).optional(),
  url: z.string().trim().optional(),
  source: leadSourceSchema.optional(),
  status: leadStatusSchema.optional(),
  reason: z.string().trim().max(500).optional(),
  reasonKind: leadReasonKindSchema.optional(),
  note: z.string().trim().max(300, "Connection note must be 300 characters or fewer.").optional(),
});

export const updateLeadSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.string().trim().max(120).optional(),
  company: z.string().trim().max(120).optional(),
  url: z.string().trim().nullable().optional(),
  source: leadSourceSchema.optional(),
  status: leadStatusSchema.optional(),
  reason: z.string().trim().max(500).optional(),
  reasonKind: leadReasonKindSchema.optional(),
  note: z.string().trim().min(1).max(300, "Connection note must be 300 characters or fewer.").optional(),
  sentAt: z.string().trim().nullable().optional(),
  connectedAt: z.string().trim().nullable().optional(),
});

export const updateLeadNoteSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, "Note cannot be empty.")
    .max(300, "Connection note must be 300 characters or fewer."),
  send: z.boolean().optional(),
});

export const bulkApproveLeadsSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, "Select at least one person to approve."),
});

export const importLeadsSchema = z.object({
  leads: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(120),
        role: z.string().trim().optional(),
        company: z.string().trim().optional(),
        url: z.string().trim().optional(),
        source: leadSourceSchema.optional(),
        reason: z.string().trim().optional(),
        note: z.string().trim().max(300).optional(),
      }),
    )
    .optional(),
  csv: z.string().optional(),
});

export const connectAccountSchema = z.object({
  profileUrl: z.string().trim().optional(),
  accountName: z.string().trim().max(120).optional(),
  avatar: z.string().trim().max(120).optional(),
  remindAt: z.string().trim().optional(),
});
