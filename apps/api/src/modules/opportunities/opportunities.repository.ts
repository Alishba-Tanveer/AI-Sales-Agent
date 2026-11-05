import { prisma, type Prisma } from "@ai-sales-agent/database";

export class OpportunitiesRepository {
  async list(organizationId: string, options?: {
    status?: string;
    sourceIds?: string[];
    minRelevance?: number;
    since?: Date;
    /** hard cap on rows returned (default 100) so a huge table can never be sent to the browser at once */
    take?: number;
  }) {
    const where: Prisma.OpportunityWhereInput = {
      organizationId,
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.sourceIds?.length ? { sourceId: { in: options.sourceIds } } : {}),
      ...(options?.minRelevance != null ? { relevance: { gte: options.minRelevance } } : {}),
      ...(options?.since ? { postedAt: { gte: options.since } } : {}),
    };

    return prisma.opportunity.findMany({
      where,
      orderBy: [{ relevance: "desc" }, { postedAt: "desc" }, { id: "asc" }],
      take: Math.min(Math.max(options?.take ?? 100, 1), 100),
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.opportunity.findFirst({
      where: { id, organizationId },
    });
  }

  async findByUrl(organizationId: string, url: string) {
    return prisma.opportunity.findFirst({
      where: { organizationId, url },
    });
  }

  async findByTitleAndCompany(organizationId: string, title: string, company: string) {
    return prisma.opportunity.findFirst({
      where: { organizationId, title, company },
    });
  }

  async upsertOpportunity(data: {
    organizationId: string;
    title: string;
    company: string;
    type: string;
    sourceId: string;
    sourceLabel: string;
    postedAt: Date;
    relevance: number;
    signals: string;
    budget?: string | null;
    location?: string | null;
    url: string;
    status?: string;
    leadId?: string | null;
  }) {
    // Check if an existing opportunity matches by url or title+company
    const existing = await prisma.opportunity.findFirst({
      where: {
        organizationId: data.organizationId,
        OR: [
          { url: data.url },
          { AND: [{ title: data.title }, { company: data.company }] },
        ],
      },
    });

    if (existing) {
      // Keep existing status (e.g. if saved or dismissed) and existing leadId
      return prisma.opportunity.update({
        where: { id: existing.id },
        data: {
          title: data.title,
          company: data.company,
          type: data.type,
          sourceId: data.sourceId,
          sourceLabel: data.sourceLabel,
          postedAt: data.postedAt,
          // always the freshly computed score; keeping the old maximum would preserve stale / inflated values
          relevance: data.relevance,
          signals: data.signals,
          budget: data.budget ?? existing.budget,
          location: data.location ?? existing.location,
          url: data.url,
          // Preserved status unless previously open
          status: existing.status,
          leadId: existing.leadId,
        },
      });
    }

    return prisma.opportunity.create({
      data: {
        organizationId: data.organizationId,
        title: data.title,
        company: data.company,
        type: data.type,
        sourceId: data.sourceId,
        sourceLabel: data.sourceLabel,
        postedAt: data.postedAt,
        relevance: data.relevance,
        signals: data.signals,
        budget: data.budget ?? null,
        location: data.location ?? null,
        url: data.url,
        status: data.status ?? "open",
        leadId: data.leadId ?? null,
      },
    });
  }

  /**
   * Removes results nobody has acted on (status "open") that the latest search did not return.
   * Saved and dismissed results are never touched.
   */
  async deleteOpenExcept(organizationId: string, keepIds: string[]) {
    return prisma.opportunity.deleteMany({
      where: {
        organizationId,
        status: "open",
        ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
      },
    });
  }

  async deleteById(organizationId: string, id: string) {
    return prisma.opportunity.deleteMany({ where: { id, organizationId } });
  }

  async updateStatus(organizationId: string, id: string, status: "open" | "saved" | "dismissed", leadId?: string | null) {
    return prisma.opportunity.updateMany({
      where: { id, organizationId },
      data: {
        status,
        ...(leadId !== undefined ? { leadId } : {}),
      },
    });
  }
}
