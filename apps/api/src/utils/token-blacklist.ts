import IORedis from "ioredis";
import { env } from "../config/env";

const inMemoryBlacklist = new Set<string>();

let redisClient: IORedis | null = null;

try {
  redisClient = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
  });
  redisClient.connect().catch(() => {
    // Graceful fallback to in-memory blacklist if Redis is not running
  });
} catch {
  // In-memory fallback
}

export async function blacklistToken(token: string, expirySeconds: number = 3600): Promise<void> {
  inMemoryBlacklist.add(token);
  if (redisClient && redisClient.status === "ready") {
    try {
      await redisClient.set(`bl:${token}`, "1", "EX", Math.max(expirySeconds, 60));
    } catch {
      // In-memory fallback already has the token
    }
  }
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  if (inMemoryBlacklist.has(token)) {
    return true;
  }
  if (redisClient && redisClient.status === "ready") {
    try {
      const exists = await redisClient.exists(`bl:${token}`);
      return exists === 1;
    } catch {
      return false;
    }
  }
  return false;
}
