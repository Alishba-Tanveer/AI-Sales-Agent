import { Worker } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@ai-sales-agent/database";
import { env } from "./config/env";
import { RECOVERY_WINDOW_MS } from "./utils/account-rules";

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "sales-agent-jobs",
  async (job) => {
    console.log(`Processing job ${job.id}: ${job.name}`);

    // Sales research, email generation, and follow-up
    // jobs will be implemented in later project steps.
  },
  { connection },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed.`);
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id ?? "unknown"} failed:`, error.message);
});

/**
 * Removed and deleted accounts are kept for 30 days so they can be restored. After that window they are
 * permanently deleted here, and a workspace whose last account was purged is deleted with it.
 * Each record is handled on its own, so one that cannot be deleted (for example because other data still
 * points to it) is logged and retried on the next run instead of stopping the job.
 */
async function purgeExpiredAccounts() {
  const cutoff = new Date(Date.now() - RECOVERY_WINDOW_MS);
  const expired = await prisma.user.findMany({
    where: { deletedAt: { not: null, lt: cutoff } },
    select: { id: true, organizationId: true },
  });
  if (expired.length === 0) return;

  const touchedOrgs = new Set<string>();
  let purged = 0;
  for (const u of expired) {
    try {
      await prisma.user.delete({ where: { id: u.id } });
      touchedOrgs.add(u.organizationId);
      purged += 1;
    } catch (err) {
      console.error(`[purge] could not delete user ${u.id}:`, (err as Error).message);
    }
  }

  for (const organizationId of touchedOrgs) {
    try {
      const left = await prisma.user.count({ where: { organizationId } });
      if (left === 0) {
        await prisma.organization.delete({ where: { id: organizationId } });
        console.log(`[purge] deleted workspace ${organizationId} (no accounts left)`);
      }
    } catch (err) {
      console.error(`[purge] could not delete workspace ${organizationId}:`, (err as Error).message);
    }
  }
  console.log(`[purge] permanently deleted ${purged} expired account(s).`);
}

const SIX_HOURS = 6 * 60 * 60 * 1000;
const runPurge = () =>
  purgeExpiredAccounts().catch((err) => console.error("[purge] failed:", err));
void runPurge();
setInterval(runPurge, SIX_HOURS);

console.log("Sales agent background worker started.");
