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
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  TAVILY_API_KEY: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_REDIRECT_URI: z.string().url().optional(),
  LINKEDIN_API_VERSION: z.string().regex(/^\d{6}$/).default("202610"),
  ENCRYPTION_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
