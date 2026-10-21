import {
  prisma,
  Prisma,
  ApprovalStatus,
  ApprovalType,
} from "@ai-sales-agent/database";

export class ApprovalsRepository {
  async list(
    organizationId: string,
    filters?: { status?: ApprovalStatus; type?: ApprovalType }
  ) {
    return prisma.approvalItem.findMany({
      where: {
        organizationId,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.type ? { type: filters.type } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async countByStatus(organizationId: string) {
    const [pending, approved, autoApproved, rejected] = await Promise.all([
      prisma.approvalItem.count({
        where: { organizationId, status: ApprovalStatus.PENDING },
      }),
      prisma.approvalItem.count({
        where: { organizationId, status: ApprovalStatus.APPROVED },
      }),
      prisma.approvalItem.count({
        where: { organizationId, status: ApprovalStatus.AUTO_APPROVED },
      }),
      prisma.approvalItem.count({
        where: { organizationId, status: ApprovalStatus.REJECTED },
      }),
    ]);

    return {
      pending,
      approved: approved + autoApproved,
      humanApproved: approved,
      autoApproved,
      rejected,
      total: pending + approved + autoApproved + rejected,
    };
  }

  async findById(id: string, organizationId: string) {
    return prisma.approvalItem.findFirst({
      where: { id, organizationId },
    });
  }

  async findManyByIds(ids: string[], organizationId: string) {
    return prisma.approvalItem.findMany({
      where: {
        id: { in: ids },
        organizationId,
      },
    });
  }

  async create(data: {
    organizationId: string;
    type: ApprovalType;
    status: ApprovalStatus;
    title: string;
    subtitle?: string;
    content: Prisma.InputJsonValue;
    confidence: number;
    leadId?: string;
    createdById?: string;
  }) {
    return prisma.approvalItem.create({ data });
  }

  async update(
    id: string,
    data: Prisma.ApprovalItemUpdateInput
  ) {
    return prisma.approvalItem.update({
      where: { id },
      data,
    });
  }
}
