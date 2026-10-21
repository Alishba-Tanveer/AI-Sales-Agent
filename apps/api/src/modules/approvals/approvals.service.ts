import {
  prisma,
  Prisma,
  ApprovalStatus,
  ApprovalType,
} from "@ai-sales-agent/database";
import { ApprovalsRepository } from "./approvals.repository";
import type {
  CreateApprovalInput,
  ApproveItemInput,
  RejectItemInput,
  BulkApproveInput,
} from "./approvals.schema";
import {
  evaluateApprovalDecision,
  assertAiLimitsNotExceeded,
  recordAiUsage,
  assertOutreachGuardrails,
  getOrCreateWorkspaceSettings,
  triggerWorkspaceNotification,
} from "../../utils/guardrails";
import { runDispatchApprovalJob } from "../../queue/job-queue";
import { AppError } from "../../utils/app-error";

export class ApprovalsService {
  constructor(private readonly approvalsRepository: ApprovalsRepository) {}

  async list(
    organizationId: string,
    filters?: { status?: ApprovalStatus; type?: ApprovalType }
  ) {
    const [items, counts] = await Promise.all([
      this.approvalsRepository.list(organizationId, filters),
      this.approvalsRepository.countByStatus(organizationId),
    ]);

    return {
      data: items,
      counts,
    };
  }

  async getById(organizationId: string, id: string) {
    const item = await this.approvalsRepository.findById(id, organizationId);
    if (!item) {
      throw new AppError("Approval item not found", 404);
    }
    return item;
  }

  async createDraft(
    organizationId: string,
    userId: string,
    input: CreateApprovalInput
  ) {
    // 1. Enforce AI usage & monthly AI spending limit before drafting
    await assertAiLimitsNotExceeded(organizationId, input.estimatedCostUsd);

    // 2. Record AI spend & request count
    await recordAiUsage(organizationId, input.estimatedCostUsd);

    // 3. Evaluate Human-in-the-Loop Governance Rules
    let decision = await evaluateApprovalDecision(
      organizationId,
      input.type,
      input.confidence
    );

    const settings = await getOrCreateWorkspaceSettings(organizationId);

    // If auto-approval would fire, verify that Outreach Strategy is approved and daily cap is not hit;
    // otherwise hold in PENDING for safety
    if (decision.status === ApprovalStatus.AUTO_APPROVED) {
      const canDispatchNow =
        settings.outreachApproved &&
        (settings.testMode || settings.sentToday < settings.dailyCap);

      if (!canDispatchNow) {
        decision = {
          status: ApprovalStatus.PENDING,
          requiresHumanApproval: true,
          reason: !settings.outreachApproved
            ? "Outreach Strategy is not approved yet — held in Approvals queue"
            : "Daily sending cap reached — held in Approvals queue",
        };
      }
    }

    const created = await this.approvalsRepository.create({
      organizationId,
      type: input.type,
      status: decision.status,
      title: input.title,
      subtitle: input.subtitle,
      content: input.content as Prisma.InputJsonValue,
      confidence: input.confidence,
      leadId: input.leadId,
      createdById: userId,
    });

    if (decision.status === ApprovalStatus.AUTO_APPROVED) {
      await runDispatchApprovalJob({
        organizationId,
        approvalId: created.id,
        reviewerName: "Auto-Approval Engine",
      });
      const refreshed = await this.approvalsRepository.findById(
        created.id,
        organizationId
      );
      return {
        message: `Auto-approved (${decision.reason})`,
        decision,
        data: refreshed ?? created,
      };
    }

    // Pending human approval: log draft activity & notify workspace
    await prisma.activityLog.create({
      data: {
        organizationId,
        type: "draft",
        status: "completed",
        title: "Draft Queued for Approval",
        text: `AI draft created: ${created.title} (${created.confidence}% confidence)`,
        jobName: "create-draft",
        attempts: 1,
        maxAttempts: 1,
        testMode: settings.testMode,
        metadata: {
          approvalId: created.id,
          type: created.type,
          confidence: created.confidence,
          reason: decision.reason,
        },
      },
    });

    await triggerWorkspaceNotification(organizationId, {
      ruleId: "approvals",
      title: "New Item Waiting for Approval",
      message: `${created.title} (${created.type}) is waiting in your Approvals queue.`,
      tone: "warning",
      link: "/approvals",
    });

    return {
      message: "Draft added to the Approvals queue",
      decision,
      data: created,
    };
  }

  async approve(
    organizationId: string,
    userId: string,
    id: string,
    input: ApproveItemInput
  ) {
    const item = await this.approvalsRepository.findById(id, organizationId);
    if (!item) {
      throw new AppError("Approval item not found", 404);
    }

    if (
      item.status === ApprovalStatus.APPROVED ||
      item.status === ApprovalStatus.AUTO_APPROVED
    ) {
      throw new AppError("This item has already been approved", 400);
    }

    // Enforce Outreach Strategy approval & daily sending cap before dispatching
    await assertOutreachGuardrails(organizationId, 1);

    const reviewer = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    await this.approvalsRepository.update(item.id, {
      status: ApprovalStatus.APPROVED,
      reviewedById: userId,
      reviewedAt: new Date(),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
      ...(input.content !== undefined
        ? { content: input.content as Prisma.InputJsonValue }
        : {}),
    });

    const dispatchResult = await runDispatchApprovalJob({
      organizationId,
      approvalId: item.id,
      reviewerName: reviewer?.name ?? "Reviewer",
    });

    const updated =
      dispatchResult?.item ??
      (await this.approvalsRepository.findById(item.id, organizationId));

    return {
      message: updated?.testMode
        ? "Approved and simulated in Test Mode (dry run — not sent externally)"
        : "Approved and dispatched successfully",
      data: updated,
    };
  }

  async reject(
    organizationId: string,
    userId: string,
    id: string,
    input: RejectItemInput
  ) {
    const item = await this.approvalsRepository.findById(id, organizationId);
    if (!item) {
      throw new AppError("Approval item not found", 404);
    }

    const updated = await this.approvalsRepository.update(item.id, {
      status: ApprovalStatus.REJECTED,
      reviewedById: userId,
      reviewedAt: new Date(),
      rejectionReason: input.reason ?? "Dismissed by reviewer",
    });

    await prisma.activityLog.create({
      data: {
        organizationId,
        type: "draft",
        status: "completed",
        title: "Approval Draft Rejected",
        text: `'${item.title}' was rejected${
          input.reason ? `: ${input.reason}` : ""
        }`,
        metadata: {
          approvalId: item.id,
          reason: input.reason ?? null,
        },
      },
    });

    return {
      message: "Approval item rejected",
      data: updated,
    };
  }

  async bulkApprove(
    organizationId: string,
    userId: string,
    input: BulkApproveInput
  ) {
    const items = await this.approvalsRepository.findManyByIds(
      input.ids,
      organizationId
    );
    const pendingItems = items.filter(
      (i) => i.status === ApprovalStatus.PENDING
    );

    if (pendingItems.length === 0) {
      throw new AppError("No pending approval items found for the given IDs", 400);
    }

    await assertOutreachGuardrails(organizationId, pendingItems.length);

    const reviewer = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const approvedResults = [];
    for (const item of pendingItems) {
      await this.approvalsRepository.update(item.id, {
        status: ApprovalStatus.APPROVED,
        reviewedById: userId,
        reviewedAt: new Date(),
      });
      const res = await runDispatchApprovalJob({
        organizationId,
        approvalId: item.id,
        reviewerName: reviewer?.name ?? "Reviewer",
      });
      if (res?.item) approvedResults.push(res.item);
    }

    return {
      message: `${approvedResults.length} item(s) approved and dispatched`,
      data: approvedResults,
    };
  }
}
