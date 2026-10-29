import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({
  path: path.resolve(__dirname, "../../../../.env"),
});

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  /** Which service writes drafts first: "gemini" or "groq". If the other one has a key, it is used as a backup. */
  AI_PROVIDER: z.enum(["gemini", "groq"]).default("gemini"),
  /** Optional time limits in milliseconds (defaults: 18s per attempt, 45s in total). */
  AI_ATTEMPT_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  AI_TOTAL_BUDGET_MS: z.coerce.number().int().positive().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),
  /** Groq's free limits are per model, so a second model gives extra room. Set to an empty string to disable. */
  GROQ_FALLBACK_MODEL: z.string().default("openai/gpt-oss-20b"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  /** Tried when GEMINI_MODEL keeps timing out or returning 5xx/429. Set to an empty string to disable. */
  GEMINI_FALLBACK_MODEL: z.string().default("gemini-3.5-flash-lite"),
  TAVILY_API_KEY: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_REDIRECT_URI: z.string().url().optional(),
  LINKEDIN_API_VERSION: z.string().regex(/^\d{6}$/).default("202610"),
  ENCRYPTION_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
