import { prisma, ApprovalType, ApprovalStatus } from "@ai-sales-agent/database";
import { DEFAULT_NOTIFICATION_RULES } from "../modules/settings/settings.repository";
import { AppError } from "./app-error";

export async function getOrCreateWorkspaceSettings(organizationId: string) {
  return prisma.workspaceSettings.upsert({
    where: { organizationId },
    update: {},
    create: {
      organizationId,
      notificationRules: DEFAULT_NOTIFICATION_RULES,
    },
  });
}

export async function evaluateApprovalDecision(
  organizationId: string,
  type: ApprovalType,
  confidence: number
): Promise<{
  status: ApprovalStatus;
  requiresHumanApproval: boolean;
  reason: string;
}> {
  const settings = await getOrCreateWorkspaceSettings(organizationId);

  // Locked ON rules: New Emails and Video Scripts ALWAYS require human approval
  if (type === ApprovalType.NEW_EMAIL || type === ApprovalType.VIDEO_SCRIPT) {
    return {
      status: ApprovalStatus.PENDING,
      requiresHumanApproval: true,
      reason: "Mandatory human review (Locked ON in Approval Rules)",
    };
  }

  let ruleEnabled = true;
  if (type === ApprovalType.REPLY) {
    ruleEnabled = settings.requireApprovalReplies;
  } else if (type === ApprovalType.FOLLOW_UP) {
    ruleEnabled = settings.requireApprovalFollowups;
  } else if (
    type === ApprovalType.LINKEDIN_PROFILE ||
    type === ApprovalType.LINKEDIN_POST ||
    type === ApprovalType.CONNECTION_NOTE
  ) {
    ruleEnabled = settings.requireApprovalLinkedin;
  }

  if (!ruleEnabled) {
    return {
      status: ApprovalStatus.AUTO_APPROVED,
      requiresHumanApproval: false,
      reason: "Rule toggle is turned OFF (Autonomous mode)",
    };
  }

  if (confidence >= settings.approvalThreshold) {
    return {
      status: ApprovalStatus.AUTO_APPROVED,
      requiresHumanApproval: false,
      reason: `Confidence (${confidence}%) meets or exceeds auto-approval threshold (${settings.approvalThreshold}%)`,
    };
  }

  return {
    status: ApprovalStatus.PENDING,
    requiresHumanApproval: true,
    reason: `Confidence (${confidence}%) is below auto-approval threshold (${settings.approvalThreshold}%)`,
  };
}

export async function assertAiLimitsNotExceeded(
  organizationId: string,
  estimatedCostUsd = 0.02
) {
  const settings = await getOrCreateWorkspaceSettings(organizationId);

  if (settings.aiSpendThisMonth + estimatedCostUsd > settings.aiLimit) {
    throw new AppError(
      `Monthly AI spending limit reached ($${settings.aiSpendThisMonth.toFixed(
        2
      )} of $${settings.aiLimit.toFixed(2)} limit). AI drafting is paused.`,
      429
    );
  }

  if (settings.requestsToday >= settings.requestsDailyLimit) {
    throw new AppError(
      `Daily AI request limit reached (${settings.requestsToday}/${settings.requestsDailyLimit}).`,
      429
    );
  }

  return settings;
}

export async function recordAiUsage(organizationId: string, costUsd = 0.02) {
  await getOrCreateWorkspaceSettings(organizationId);
  return prisma.workspaceSettings.update({
    where: { organizationId },
    data: {
      aiSpendThisMonth: { increment: Number(costUsd.toFixed(4)) },
      requestsToday: { increment: 1 },
    },
  });
}

export async function assertOutreachGuardrails(
  organizationId: string,
  sendCount = 1
) {
  const settings = await getOrCreateWorkspaceSettings(organizationId);

  if (!settings.outreachApproved) {
    throw new AppError(
      "Outreach blocked: You must review and approve your Outreach Strategy in Settings before outreach can be dispatched.",
      403
    );
  }

  // In live mode (not dry-run testMode), enforce the daily sending cap
  if (!settings.testMode && settings.sentToday + sendCount > settings.dailyCap) {
    throw new AppError(
      `Daily sending limit reached (${settings.sentToday} of ${settings.dailyCap}). Sending resumes tomorrow.`,
      429
    );
  }

  return settings;
}

export async function triggerWorkspaceNotification(
  organizationId: string,
  params: {
    ruleId: "approvals" | "interested" | "failures" | "digest" | "system";
    title: string;
    message: string;
    tone?: "primary" | "success" | "warning" | "destructive";
    link?: string;
  }
) {
  const settings = await getOrCreateWorkspaceSettings(organizationId);
  const rawRules = Array.isArray(settings.notificationRules)
    ? (settings.notificationRules as Array<{
        id?: string;
        email?: boolean;
        inApp?: boolean;
      }>)
    : DEFAULT_NOTIFICATION_RULES;

  const matchedRule = rawRules.find((r) => r.id === params.ruleId);
  const allowInApp =
    params.ruleId === "system" ? true : matchedRule?.inApp ?? true;
  const allowEmail = matchedRule?.email ?? false;

  let notification = null;
  if (allowInApp) {
    notification = await prisma.inAppNotification.create({
      data: {
        organizationId,
        ruleId: params.ruleId,
        title: params.title,
        message: params.message,
        tone: params.tone ?? "primary",
        link: params.link ?? null,
      },
    });
  }

  if (allowEmail && process.env.NODE_ENV !== "production") {
    console.log(
      `[NOTIFICATION ALERT (${params.ruleId.toUpperCase()})]: ${params.title} — ${params.message}`
    );
  }

  return notification;
}
