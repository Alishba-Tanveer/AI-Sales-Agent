import { prisma, type Prisma } from "@ai-sales-agent/database";
import type { ListActivityQuery, CreateActivityJobInput } from "./activity.schema";

export class ActivityRepository {
  async list(organizationId: string, query?: ListActivityQuery) {
    const where: Prisma.ActivityLogWhereInput = { organizationId };

    if (query?.tab && query.tab !== "all") {
      where.status = query.tab;
    } else if (query?.status) {
      where.status = query.status;
    }

    if (query?.agent) {
      where.agent = query.agent;
    }

    if (query?.kind) {
      where.kind = query.kind;
    }

    if (query?.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { leadName: { contains: query.search, mode: "insensitive" } },
        { leadContext: { contains: query.search, mode: "insensitive" } },
      ];
    }

    return prisma.activityLog.findMany({
      where,
      orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
      take: query?.limit ?? 100,
      skip: query?.page && query?.limit ? query.page * query.limit : undefined,
    });
  }

  async countTotal(organizationId: string) {
    return prisma.activityLog.count({
      where: { organizationId },
    });
  }

  async countRunning(organizationId: string) {
    return prisma.activityLog.count({
      where: {
        organizationId,
        status: "running",
      },
    });
  }

  async countByStatus(organizationId: string) {
    const [all, running, failed, completed] = await Promise.all([
      prisma.activityLog.count({ where: { organizationId } }),
      prisma.activityLog.count({ where: { organizationId, status: "running" } }),
      prisma.activityLog.count({ where: { organizationId, status: "failed" } }),
      prisma.activityLog.count({ where: { organizationId, status: "completed" } }),
    ]);

    return { all, running, failed, completed };
  }

  async findById(id: string, organizationId: string) {
    return prisma.activityLog.findFirst({
      where: { id, organizationId },
    });
  }

  async create(organizationId: string, data: CreateActivityJobInput) {
    return prisma.activityLog.create({
      data: {
        organizationId,
        kind: data.kind,
        title: data.title,
        leadId: data.leadId ?? null,
        leadName: data.leadName ?? null,
        leadContext: data.leadContext ?? "",
        agent: data.agent ?? "General Agent",
        status: data.status ?? "running",
        startedAt: data.startedAt ? new Date(data.startedAt) : data.status === "queued" ? null : new Date(),
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
        durationSec: data.durationSec ?? null,
        retries: data.retries ?? 0,
        maxRetries: data.maxRetries ?? 3,
        output: data.output ?? null,
        error: data.error ?? null,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }

  async update(id: string, organizationId: string, data: Prisma.ActivityLogUpdateInput) {
    return prisma.activityLog.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  async seedDefaultJobsIfEmpty(_organizationId: string) {
    return false;
  }
}
