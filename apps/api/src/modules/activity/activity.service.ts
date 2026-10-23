import { ActivityRepository } from "./activity.repository";
import type { ActivityLog } from "@ai-sales-agent/database";
import type { ListActivityQuery, CreateActivityJobInput } from "./activity.schema";
import { AppError } from "../../utils/app-error";

export class ActivityService {
  constructor(private readonly activityRepository: ActivityRepository) {}

  async listActivity(organizationId: string, query?: ListActivityQuery) {
    // Auto-seed realistic initial jobs if none exist yet
    await this.activityRepository.seedDefaultJobsIfEmpty(organizationId);

    const logs = await this.activityRepository.list(organizationId, query);

    const formatted = logs.map((log: ActivityLog) => ({
      id: log.id,
      kind: log.kind,
      title: log.title,
      lead: {
        id: log.leadId ?? null,
        name: log.leadName ?? null,
        context: log.leadContext ?? "",
      },
      agent: log.agent,
      status: log.status,
      startedAt: log.startedAt ? log.startedAt.toISOString() : null,
      scheduledFor: log.scheduledFor ? log.scheduledFor.toISOString() : null,
      durationSec: log.durationSec ?? null,
      retries: log.retries,
      maxRetries: log.maxRetries,
      output: log.output ?? null,
      error: log.error ?? null,
    }));

    return {
      data: formatted,
    };
  }

  async retryJob(organizationId: string, id: string) {
    const job = await this.activityRepository.findById(id, organizationId);
    if (!job) {
      throw new AppError("Activity task not found", 404);
    }

    const nextRetries = Math.min(job.retries + 1, job.maxRetries);
    const now = new Date();

    await this.activityRepository.update(id, organizationId, {
      status: "running",
      startedAt: now,
      scheduledFor: null,
      durationSec: null,
      retries: nextRetries,
      error: null,
    });

    return {
      data: {
        id: job.id,
        status: "running",
        startedAt: now.toISOString(),
        scheduledFor: null,
        durationSec: null,
        retries: nextRetries,
        error: null,
      },
    };
  }

  async cancelJob(organizationId: string, id: string) {
    const job = await this.activityRepository.findById(id, organizationId);
    if (!job) {
      throw new AppError("Activity task not found", 404);
    }

    const ran = job.startedAt ? Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000) : null;

    await this.activityRepository.update(id, organizationId, {
      status: "cancelled",
      durationSec: ran,
      scheduledFor: null,
    });

    return {
      data: {
        id: job.id,
        status: "cancelled",
        durationSec: ran,
        scheduledFor: null,
      },
    };
  }

  async createJob(organizationId: string, input: CreateActivityJobInput) {
    const created = await this.activityRepository.create(organizationId, input);
    return {
      data: {
        id: created.id,
        kind: created.kind,
        title: created.title,
        lead: {
          id: created.leadId,
          name: created.leadName,
          context: created.leadContext,
        },
        agent: created.agent,
        status: created.status,
        startedAt: created.startedAt ? created.startedAt.toISOString() : null,
        scheduledFor: created.scheduledFor ? created.scheduledFor.toISOString() : null,
        durationSec: created.durationSec,
        retries: created.retries,
        maxRetries: created.maxRetries,
        output: created.output,
        error: created.error,
      },
    };
  }

  async getRunningCount(organizationId: string) {
    const running = await this.activityRepository.countRunning(organizationId);
    return {
      data: {
        running,
      },
    };
  }
}
