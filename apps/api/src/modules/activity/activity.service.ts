import { Role } from "@ai-sales-agent/database";
import { ActivityRepository } from "./activity.repository";
import type { ListActivityQuery, TriggerTestJobInput } from "./activity.schema";
import {
  enqueueAndRunTestJob,
  runTestJobProcessor,
  runPurgeExpiredDataJob,
} from "../../queue/job-queue";
import { AppError } from "../../utils/app-error";

export class ActivityService {
  constructor(private readonly activityRepository: ActivityRepository) {}

  async listActivity(organizationId: string, query: ListActivityQuery) {
    const [logs, counts] = await Promise.all([
      this.activityRepository.list(organizationId, query),
      this.activityRepository.countSummary(organizationId),
    ]);

    const formatted = logs.map((l) => ({
      ...l,
      at: l.createdAt.toISOString(),
    }));

    return {
      data: formatted,
      counts,
    };
  }

  async runTestJob(organizationId: string, input: TriggerTestJobInput) {
    const result = await enqueueAndRunTestJob({
      organizationId,
      title: input.title,
      shouldFailTimes: input.shouldFailTimes,
      alwaysFail: input.alwaysFail,
      maxAttempts: input.maxAttempts,
    });

    return {
      message:
        result?.status === "failed"
          ? `Job failed after ${result.attempts} attempts`
          : `Job completed on attempt ${result?.attempts ?? 1}`,
      data: result
        ? {
            ...result,
            at: result.createdAt.toISOString(),
          }
        : null,
    };
  }

  async retryActivityJob(organizationId: string, id: string) {
    const existing = await this.activityRepository.findById(id, organizationId);
    if (!existing) {
      throw new AppError("Activity log / job not found", 404);
    }

    const updated = await runTestJobProcessor({
      activityLogId: existing.id,
      organizationId,
      title: existing.title,
      shouldFailTimes: 0,
      alwaysFail: false,
      maxAttempts: existing.maxAttempts,
    });

    return {
      message: "Job retried and completed successfully",
      data: updated
        ? {
            ...updated,
            at: updated.createdAt.toISOString(),
          }
        : null,
    };
  }

  async runPurgeJob(organizationId: string, userRole: string) {
    if (userRole !== Role.OWNER && userRole !== Role.ADMIN) {
      throw new AppError(
        "Only workspace Owners and Admins can run the purge job",
        403
      );
    }

    const summary = await runPurgeExpiredDataJob(organizationId);
    return {
      message: "30-day expired account and invitation purge job completed",
      data: summary,
    };
  }

  async listNotifications(organizationId: string) {
    const { items, unreadCount } =
      await this.activityRepository.listNotifications(organizationId);
    return {
      data: items,
      unreadCount,
    };
  }

  async markNotificationRead(organizationId: string, id: string) {
    const notif = await this.activityRepository.findNotificationById(
      id,
      organizationId
    );
    if (!notif) {
      throw new AppError("Notification not found", 404);
    }
    const updated = await this.activityRepository.markNotificationRead(notif.id);
    return {
      message: "Notification marked as read",
      data: updated,
    };
  }

  async markAllNotificationsRead(organizationId: string) {
    const res =
      await this.activityRepository.markAllNotificationsRead(organizationId);
    return {
      message: "All notifications marked as read",
      data: { updatedCount: res.count },
    };
  }
}
