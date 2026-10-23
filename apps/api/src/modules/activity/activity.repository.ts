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

  async seedDefaultJobsIfEmpty(organizationId: string) {
    const count = await this.countTotal(organizationId);
    if (count > 0) return false;

    const now = Date.now();
    const MIN = 60_000;

    const seeds = [
      {
        kind: "research",
        title: "Research lead: Daniel Hughes",
        leadName: "Daniel Hughes",
        leadContext: "Northwind Dental",
        agent: "General Agent",
        status: "completed",
        startedAt: new Date(now - 18 * MIN),
        scheduledFor: null,
        durationSec: 42,
        retries: 0,
        output: "Profile built for Daniel Hughes: role, company size, recent news and 3 talking points saved to the lead.",
        error: null,
      },
      {
        kind: "draft",
        title: "Draft email: Sarah Mitchell",
        leadName: "Sarah Mitchell",
        leadContext: "BrightCart",
        agent: "General Agent",
        status: "completed",
        startedAt: new Date(now - 28 * MIN),
        scheduledFor: null,
        durationSec: 14,
        retries: 0,
        output: "Draft written for Sarah Mitchell and sent to the Approvals queue for review.",
        error: null,
      },
      {
        kind: "discover",
        title: "Check job portals",
        leadName: null,
        leadContext: "E-commerce Segment",
        agent: "General Agent",
        status: "running",
        startedAt: new Date(now - 64_000),
        scheduledFor: null,
        durationSec: null,
        retries: 0,
        output: null,
        error: null,
      },
      {
        kind: "research",
        title: "Research lead: Tom Becker",
        leadName: "Tom Becker",
        leadContext: "Lumen Health",
        agent: "General Agent",
        status: "failed",
        startedAt: new Date(now - 45 * MIN),
        scheduledFor: null,
        durationSec: 90,
        retries: 2,
        output: null,
        error: "The company website blocked automated access (HTTP 403) and no other public sources were found. Retried 2 of 3 times.",
      },
      {
        kind: "followup",
        title: "Draft follow-up",
        leadName: "Daniel Hughes",
        leadContext: "Follow-up Sequence #2",
        agent: "General Agent",
        status: "queued",
        startedAt: null,
        scheduledFor: new Date(now + 2 * 60 * MIN),
        durationSec: null,
        retries: 0,
        output: null,
        error: null,
      },
      {
        kind: "sync",
        title: "Sync LinkedIn Connections",
        leadName: null,
        leadContext: "Global Sync Routine",
        agent: "LinkedIn Agent",
        status: "completed",
        startedAt: new Date(now - 120 * MIN),
        scheduledFor: null,
        durationSec: 135,
        retries: 0,
        output: "Connections synced. 14 new connections found, 2 matched existing leads.",
        error: null,
      },
      {
        kind: "enrich",
        title: "Enrich company: CloudScale",
        leadName: "Alex Rivera",
        leadContext: "CloudScale Inc",
        agent: "General Agent",
        status: "completed",
        startedAt: new Date(now - 180 * MIN),
        scheduledFor: null,
        durationSec: 38,
        retries: 0,
        output: "Company data for CloudScale enriched: industry, headcount, funding stage and website.",
        error: null,
      },
      {
        kind: "invite",
        title: "Send invite: Marcus Brody",
        leadName: "Marcus Brody",
        leadContext: "FinTech Labs",
        agent: "LinkedIn Agent",
        status: "completed",
        startedAt: new Date(now - 240 * MIN),
        scheduledFor: null,
        durationSec: 19,
        retries: 0,
        output: "Connection invite with a personal note sent to Marcus Brody.",
        error: null,
      },
      {
        kind: "analyze",
        title: "Analyze stack: Apex Global",
        leadName: "Apex Global",
        leadContext: "Systems",
        agent: "General Agent",
        status: "failed",
        startedAt: new Date(now - 300 * MIN),
        scheduledFor: null,
        durationSec: 45,
        retries: 3,
        output: null,
        error: "Tech stack lookup timed out after 30 seconds on every attempt (3 of 3). Try again later or check the lookup service in Integrations.",
      },
      {
        kind: "discover",
        title: "Find decision makers",
        leadName: null,
        leadContext: "Hyperion Logistics",
        agent: "General Agent",
        status: "running",
        startedAt: new Date(now - 22_000),
        scheduledFor: null,
        durationSec: null,
        retries: 0,
        output: null,
        error: null,
      },
      {
        kind: "research",
        title: "Research lead: Priya Nair",
        leadName: "Priya Nair",
        leadContext: "Orbit Analytics",
        agent: "General Agent",
        status: "completed",
        startedAt: new Date(now - 360 * MIN),
        scheduledFor: null,
        durationSec: 51,
        retries: 0,
        output: "Profile built for Priya Nair: role, company size, recent news and 3 talking points saved to the lead.",
        error: null,
      },
      {
        kind: "draft",
        title: "Draft email: Liam O'Connor",
        leadName: "Liam O'Connor",
        leadContext: "Greenfield Energy",
        agent: "General Agent",
        status: "completed",
        startedAt: new Date(now - 400 * MIN),
        scheduledFor: null,
        durationSec: 17,
        retries: 0,
        output: "Draft written for Liam O'Connor and sent to the Approvals queue for review.",
        error: null,
      },
      {
        kind: "invite",
        title: "Send invite: Hannah Weiss",
        leadName: "Hannah Weiss",
        leadContext: "Sprout Labs",
        agent: "LinkedIn Agent",
        status: "completed",
        startedAt: new Date(now - 480 * MIN),
        scheduledFor: null,
        durationSec: 21,
        retries: 0,
        output: "Connection invite with a personal note sent to Hannah Weiss.",
        error: null,
      },
      {
        kind: "enrich",
        title: "Enrich company: Brightwave",
        leadName: "Omar Haddad",
        leadContext: "Brightwave Media",
        agent: "General Agent",
        status: "completed",
        startedAt: new Date(now - 540 * MIN),
        scheduledFor: null,
        durationSec: 33,
        retries: 0,
        output: "Company data for Brightwave Media enriched: industry, headcount, funding stage and website.",
        error: null,
      },
      {
        kind: "discover",
        title: "Find opportunities: SaaS founders",
        leadName: null,
        leadContext: "Saved search",
        agent: "General Agent",
        status: "completed",
        startedAt: new Date(now - 600 * MIN),
        scheduledFor: null,
        durationSec: 184,
        retries: 0,
        output: "Discovery run finished. 9 new prospects added to Leads as New.",
        error: null,
      },
    ];

    await prisma.activityLog.createMany({
      data: seeds.map((s, idx) => ({
        organizationId,
        kind: s.kind,
        title: s.title,
        leadId: s.leadName ? `lead-${idx + 1}` : null,
        leadName: s.leadName,
        leadContext: s.leadContext,
        agent: s.agent,
        status: s.status,
        startedAt: s.startedAt,
        scheduledFor: s.scheduledFor,
        durationSec: s.durationSec,
        retries: s.retries,
        maxRetries: 3,
        output: s.output,
        error: s.error,
      })),
    });

    return true;
  }
}
