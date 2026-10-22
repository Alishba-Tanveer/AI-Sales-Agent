import IORedis from "ioredis";
import { env } from "../config/env";

interface OtpEntry {
  otp: string;
  expiresAt: number;
  attempts: number;
}

const MAX_ATTEMPTS = 5;
const inMemoryOtpStore = new Map<string, OtpEntry>();

let redisClient: IORedis | null = null;

try {
  redisClient = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
  });
  redisClient.connect().catch(() => {
    // Graceful fallback to in-memory store if Redis is not running
  });
} catch {
  // In-memory fallback
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function saveOtp(
  email: string,
  otp: string,
  ttlSeconds: number = 600
): Promise<void> {
  const key = normalizeEmail(email);
  const expiresAt = Date.now() + ttlSeconds * 1000;

  inMemoryOtpStore.set(key, { otp, expiresAt, attempts: 0 });

  if (redisClient && redisClient.status === "ready") {
    try {
      await redisClient.set(
        `otp:${key}`,
        JSON.stringify({ otp, attempts: 0 }),
        "EX",
        ttlSeconds
      );
    } catch {
      // In-memory fallback already saved the OTP
    }
  }
}

export async function verifyOtpCode(
  email: string,
  otp: string,
  consume: boolean = false
): Promise<boolean> {
  const key = normalizeEmail(email);

  // 1. Check Redis if available
  if (redisClient && redisClient.status === "ready") {
    try {
      const raw = await redisClient.get(`otp:${key}`);
      if (!raw) {
        inMemoryOtpStore.delete(key);
        return false;
      }

      const data = JSON.parse(raw) as { otp: string; attempts: number };
      if (data.otp !== otp) {
        data.attempts += 1;
        if (data.attempts >= MAX_ATTEMPTS) {
          await redisClient.del(`otp:${key}`);
          inMemoryOtpStore.delete(key);
        } else {
          const ttl = await redisClient.ttl(`otp:${key}`);
          if (ttl > 0) {
            await redisClient.set(`otp:${key}`, JSON.stringify(data), "EX", ttl);
          }
        }
        return false;
      }

      if (consume) {
        await redisClient.del(`otp:${key}`);
        inMemoryOtpStore.delete(key);
      }
      return true;
    } catch {
      // Fallback to in-memory check below if Redis errors
    }
  }

  // 2. Fallback: Check in-memory store
  const entry = inMemoryOtpStore.get(key);
  if (!entry) {
    return false;
  }

  if (Date.now() > entry.expiresAt) {
    inMemoryOtpStore.delete(key);
    return false;
  }

  if (entry.otp !== otp) {
    entry.attempts += 1;
    if (entry.attempts >= MAX_ATTEMPTS) {
      inMemoryOtpStore.delete(key);
    }
    return false;
  }

  if (consume) {
    inMemoryOtpStore.delete(key);
  }

  return true;
}
