import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@ai-sales-agent/database";
import { env } from "../config/env";
import {
  getOrCreateWorkspaceSettings,
  triggerWorkspaceNotification,
} from "../utils/guardrails";

export const QUEUE_NAME = "sales-agent-jobs";

let bullQueue: Queue | null = null;
let bullWorker: Worker | null = null;

function createRedisConnection() {
  const conn = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: true,
    retryStrategy: () => null,
  });
  conn.on("error", () => {
    // Handled gracefully by in-process fallback when Redis is unavailable
  });
  return conn;
}

export async function runTestJobProcessor(params: {
  activityLogId: string;
  organizationId: string;
  title: string;
  shouldFailTimes: number;
  alwaysFail: boolean;
  maxAttempts: number;
}) {
  const {
    activityLogId,
    organizationId,
    title,
    shouldFailTimes,
    alwaysFail,
    maxAttempts,
  } = params;

  const settings = await getOrCreateWorkspaceSettings(organizationId);
  let attempt = 0;
  const retryHistory: Array<{
    attempt: number;
    status: string;
    message: string;
    at: string;
  }> = [];

  while (attempt < maxAttempts) {
    attempt += 1;
    const shouldFailThisAttempt = alwaysFail || attempt <= shouldFailTimes;

    if (shouldFailThisAttempt) {
      const errorMsg = `Attempt ${attempt}/${maxAttempts} failed: Simulated upstream timeout during '${title}'`;
      retryHistory.push({
        attempt,
        status: attempt < maxAttempts ? "retrying" : "failed",
        message: errorMsg,
        at: new Date().toISOString(),
      });

      if (attempt < maxAttempts) {
        await prisma.activityLog.update({
          where: { id: activityLogId },
          data: {
            status: "retrying",
            attempts: attempt,
            error: errorMsg,
            text: `${title} failed on attempt ${attempt} — retrying (${attempt}/${maxAttempts})`,
            metadata: { retryHistory },
          },
        });
        // Short backoff for demo/retry responsiveness
        await new Promise((r) => setTimeout(r, 150));
        continue;
      } else {
        // Exhausted all retries
        const failedLog = await prisma.activityLog.update({
          where: { id: activityLogId },
          data: {
            type: "failed",
            status: "failed",
            attempts: attempt,
            error: errorMsg,
            text: `${title} failed after ${attempt} attempts (${errorMsg})`,
            metadata: { retryHistory },
            testMode: settings.testMode,
          },
        });

        await triggerWorkspaceNotification(organizationId, {
          ruleId: "failures",
          title: "Background Job Failed",
          message: `${title} failed after ${attempt} attempts.`,
          tone: "destructive",
          link: "/activity",
        });

        return failedLog;
      }
    }

    // Succeeded on this attempt
    retryHistory.push({
      attempt,
      status: "completed",
      message:
        attempt > 1
          ? `Succeeded on retry attempt ${attempt}/${maxAttempts}`
          : "Completed on first attempt",
      at: new Date().toISOString(),
    });

    const completedText =
      attempt > 1
        ? `${title} completed on retry (attempt ${attempt}/${maxAttempts})${
            settings.testMode ? " [Test Mode]" : ""
          }`
        : `${title} completed successfully${
            settings.testMode ? " [Test Mode]" : ""
          }`;

    return prisma.activityLog.update({
      where: { id: activityLogId },
      data: {
        status: settings.testMode ? "test_mode" : "completed",
        attempts: attempt,
        error: null,
        text: completedText,
        metadata: { retryHistory },
        testMode: settings.testMode,
      },
    });
  }

  return prisma.activityLog.findUnique({ where: { id: activityLogId } });
}

export async function runDispatchApprovalJob(params: {
  organizationId: string;
  approvalId: string;
  reviewerName?: string;
}) {
  const { organizationId, approvalId, reviewerName } = params;
  const item = await prisma.approvalItem.findFirst({
    where: { id: approvalId, organizationId },
  });
  if (!item) return null;

  const settings = await getOrCreateWorkspaceSettings(organizationId);
  const isTestMode = settings.testMode;

  if (!isTestMode) {
    // Live dispatch: increment daily sent counter for outbound messages
    await prisma.workspaceSettings.update({
      where: { organizationId },
      data: {
        sentToday: { increment: 1 },
      },
    });
  }

  const updatedItem = await prisma.approvalItem.update({
    where: { id: item.id },
    data: {
      testMode: isTestMode,
      dispatchedAt: new Date(),
    },
  });

  const actor = reviewerName ? ` by ${reviewerName}` : "";
  const logText = isTestMode
    ? `[TEST MODE / DRY RUN] '${item.title}' approved${actor} — saved as test send only (not sent externally)`
    : `'${item.title}' approved${actor} and dispatched`;

  const activity = await prisma.activityLog.create({
    data: {
      organizationId,
      type: "approved",
      status: isTestMode ? "test_mode" : "completed",
      title: isTestMode ? "Dry-Run Send (Test Mode)" : "Approval Dispatched",
      text: logText,
      jobName: "dispatch-approval",
      attempts: 1,
      maxAttempts: 3,
      testMode: isTestMode,
      metadata: {
        approvalId: item.id,
        approvalType: item.type,
        testMode: isTestMode,
      },
    },
  });

  return { item: updatedItem, activity };
}

export async function runPurgeExpiredDataJob(organizationId?: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const now = new Date();

  // 1. Permanently delete users soft-deleted more than 30 days ago
  const deletedUsersResult = await prisma.user.deleteMany({
    where: {
      deletedAt: {
        not: null,
        lte: thirtyDaysAgo,
      },
      ...(organizationId ? { organizationId } : {}),
    },
  });

  // 2. Delete expired team invitations
  const deletedInvitesResult = await prisma.teamInvitation.deleteMany({
    where: {
      expiresAt: {
        lt: now,
      },
      ...(organizationId ? { organizationId } : {}),
    },
  });

  // 3. Clean up any orphaned organizations that have zero users left
  const emptyOrgs = await prisma.organization.findMany({
    where: {
      users: { none: {} },
      ...(organizationId ? { id: organizationId } : {}),
    },
    select: { id: true },
  });

  let deletedOrgsCount = 0;
  if (emptyOrgs.length > 0) {
    const res = await prisma.organization.deleteMany({
      where: { id: { in: emptyOrgs.map((o) => o.id) } },
    });
    deletedOrgsCount = res.count;
  }

  const summary = {
    purgedUsers: deletedUsersResult.count,
    purgedInvitations: deletedInvitesResult.count,
    purgedOrganizations: deletedOrgsCount,
    cutoffDate: thirtyDaysAgo.toISOString(),
    ranAt: now.toISOString(),
  };

  if (organizationId) {
    const orgExists = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (orgExists) {
      await prisma.activityLog.create({
        data: {
          organizationId,
          type: "purge",
          status: "completed",
          title: "30-Day Account & Invite Purge Job",
          text: `Purge completed: removed ${summary.purgedUsers} expired deactivated account(s) and ${summary.purgedInvitations} expired invitation(s).`,
          jobName: "purge-expired-data",
          attempts: 1,
          maxAttempts: 1,
          metadata: summary,
        },
      });
    }
  }

  return summary;
}

export function initBullMqWorker() {
  if (bullWorker) return bullWorker;
  try {
    const conn = createRedisConnection();
    bullQueue = new Queue(QUEUE_NAME, { connection: conn });
    bullWorker = new Worker(
      QUEUE_NAME,
      async (job) => {
        if (job.name === "test-job") {
          return runTestJobProcessor(job.data);
        }
        if (job.name === "dispatch-approval") {
          return runDispatchApprovalJob(job.data);
        }
        if (job.name === "purge-expired-data") {
          return runPurgeExpiredDataJob(job.data?.organizationId);
        }
      },
      { connection: createRedisConnection() }
    );
    bullWorker.on("error", () => {});
  } catch {
    // Fallback to direct execution when Redis is offline
  }
  return bullWorker;
}

export async function enqueueAndRunTestJob(params: {
  organizationId: string;
  title?: string;
  shouldFailTimes?: number;
  alwaysFail?: boolean;
  maxAttempts?: number;
}) {
  const title = params.title?.trim() || "Lead Enrichment & Verification Job";
  const maxAttempts = params.maxAttempts ?? 3;
  const shouldFailTimes = params.shouldFailTimes ?? 1;
  const alwaysFail = params.alwaysFail ?? false;

  const initialLog = await prisma.activityLog.create({
    data: {
      organizationId: params.organizationId,
      type: "draft",
      status: "queued",
      title,
      text: `${title} queued`,
      jobName: "test-job",
      attempts: 0,
      maxAttempts,
      metadata: {
        shouldFailTimes,
        alwaysFail,
      },
    },
  });

  // Also push to BullMQ if connected for queue observability
  if (bullQueue) {
    try {
      const bJob = await bullQueue.add("test-job", {
        activityLogId: initialLog.id,
        organizationId: params.organizationId,
        title,
        shouldFailTimes,
        alwaysFail,
        maxAttempts,
      });
      await prisma.activityLog.update({
        where: { id: initialLog.id },
        data: { jobId: String(bJob.id) },
      });
    } catch {
      // Ignore Redis queue add error; run processor directly below
    }
  }

  const finalLog = await runTestJobProcessor({
    activityLogId: initialLog.id,
    organizationId: params.organizationId,
    title,
    shouldFailTimes,
    alwaysFail,
    maxAttempts,
  });

  return finalLog;
}
