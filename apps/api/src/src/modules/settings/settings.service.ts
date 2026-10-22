import {
  SettingsRepository,
  DEFAULT_NOTIFICATION_RULES,
} from "./settings.repository";
import type {
  OutreachSettingsInput,
  ApprovalRulesInput,
  UpdateNotificationsInput,
  UpdateAiLimitInput,
  UpdateTestModeInput,
} from "./settings.schema";

export class SettingsService {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  private formatOutreach(s: Awaited<ReturnType<SettingsRepository["getOrCreate"]>>) {
    return {
      tone: s.tone,
      maxFollowUps: s.maxFollowUps,
      followUps: s.maxFollowUps,
      intervalDays: s.intervalDays,
      gapDays: s.intervalDays,
      dailyCap: s.dailyCap,
      weeklyLinkedinLimit: s.weeklyLinkedinLimit,
      postingFrequency: s.postingFrequency,
      approved: s.outreachApproved,
      approvedAt: s.outreachApprovedAt,
    };
  }

  private formatApprovalRules(
    s: Awaited<ReturnType<SettingsRepository["getOrCreate"]>>
  ) {
    return {
      threshold: s.approvalThreshold,
      newEmails: true,
      videoScripts: true,
      replies: s.requireApprovalReplies,
      followups: s.requireApprovalFollowups,
      linkedin: s.requireApprovalLinkedin,
      toggles: {
        newEmails: true,
        videoScripts: true,
        replies: s.requireApprovalReplies,
        followups: s.requireApprovalFollowups,
        linkedin: s.requireApprovalLinkedin,
      },
    };
  }

  private normalizeNotifications(raw: unknown) {
    if (Array.isArray(raw) && raw.length > 0) {
      return DEFAULT_NOTIFICATION_RULES.map((def) => {
        const found = raw.find(
          (r): r is { id: string; email?: boolean; inApp?: boolean } =>
            typeof r === "object" && r !== null && "id" in r && r.id === def.id
        );
        return {
          ...def,
          email: typeof found?.email === "boolean" ? found.email : def.email,
          inApp: typeof found?.inApp === "boolean" ? found.inApp : def.inApp,
        };
      });
    }
    return DEFAULT_NOTIFICATION_RULES;
  }

  async getOutreach(organizationId: string) {
    const s = await this.settingsRepository.getOrCreate(organizationId);
    return this.formatOutreach(s);
  }

  async saveOutreach(organizationId: string, input: OutreachSettingsInput) {
    const maxFollowUps = input.maxFollowUps ?? input.followUps;
    const intervalDays = input.intervalDays ?? input.gapDays;

    const updated = await this.settingsRepository.update(organizationId, {
      ...(input.tone !== undefined ? { tone: input.tone } : {}),
      ...(maxFollowUps !== undefined ? { maxFollowUps } : {}),
      ...(intervalDays !== undefined ? { intervalDays } : {}),
      ...(input.dailyCap !== undefined ? { dailyCap: input.dailyCap } : {}),
      ...(input.weeklyLinkedinLimit !== undefined
        ? { weeklyLinkedinLimit: input.weeklyLinkedinLimit }
        : {}),
      ...(input.postingFrequency !== undefined
        ? { postingFrequency: input.postingFrequency }
        : {}),
    });

    return this.formatOutreach(updated);
  }

  async approveOutreach(organizationId: string, input: OutreachSettingsInput) {
    const maxFollowUps = input.maxFollowUps ?? input.followUps;
    const intervalDays = input.intervalDays ?? input.gapDays;

    const updated = await this.settingsRepository.update(organizationId, {
      ...(input.tone !== undefined ? { tone: input.tone } : {}),
      ...(maxFollowUps !== undefined ? { maxFollowUps } : {}),
      ...(intervalDays !== undefined ? { intervalDays } : {}),
      ...(input.dailyCap !== undefined ? { dailyCap: input.dailyCap } : {}),
      ...(input.weeklyLinkedinLimit !== undefined
        ? { weeklyLinkedinLimit: input.weeklyLinkedinLimit }
        : {}),
      ...(input.postingFrequency !== undefined
        ? { postingFrequency: input.postingFrequency }
        : {}),
      outreachApproved: true,
      outreachApprovedAt: new Date(),
    });

    return this.formatOutreach(updated);
  }

  async getApprovalRules(organizationId: string) {
    const s = await this.settingsRepository.getOrCreate(organizationId);
    return this.formatApprovalRules(s);
  }

  async saveApprovalRules(organizationId: string, input: ApprovalRulesInput) {
    const replies = input.replies ?? input.toggles?.replies;
    const followups = input.followups ?? input.toggles?.followups;
    const linkedin = input.linkedin ?? input.toggles?.linkedin;

    const updated = await this.settingsRepository.update(organizationId, {
      ...(input.threshold !== undefined
        ? { approvalThreshold: input.threshold }
        : {}),
      ...(replies !== undefined ? { requireApprovalReplies: replies } : {}),
      ...(followups !== undefined ? { requireApprovalFollowups: followups } : {}),
      ...(linkedin !== undefined ? { requireApprovalLinkedin: linkedin } : {}),
      requireApprovalNewEmails: true,
      requireApprovalVideoScripts: true,
    });

    return this.formatApprovalRules(updated);
  }

  async getNotifications(organizationId: string) {
    const s = await this.settingsRepository.getOrCreate(organizationId);
    return this.normalizeNotifications(s.notificationRules);
  }

  async saveNotifications(
    organizationId: string,
    input: UpdateNotificationsInput
  ) {
    const current = await this.getNotifications(organizationId);

    const incomingArray = Array.isArray(input)
      ? input
      : "rules" in input && Array.isArray(input.rules)
      ? input.rules
      : null;

    let merged;
    if (incomingArray) {
      merged = current.map((rule) => {
        const match = incomingArray.find((r) => r.id === rule.id);
        return match
          ? { ...rule, email: match.email, inApp: match.inApp }
          : rule;
      });
    } else {
      const record = input as Record<
        string,
        { email?: boolean; inApp?: boolean }
      >;
      merged = current.map((rule) => {
        const match = record[rule.id];
        return match
          ? {
              ...rule,
              email: typeof match.email === "boolean" ? match.email : rule.email,
              inApp: typeof match.inApp === "boolean" ? match.inApp : rule.inApp,
            }
          : rule;
      });
    }

    const updated = await this.settingsRepository.update(organizationId, {
      notificationRules: merged,
    });

    return this.normalizeNotifications(updated.notificationRules);
  }

  async getUsage(organizationId: string) {
    const s = await this.settingsRepository.getOrCreate(organizationId);
    return {
      sentToday: s.sentToday,
      dailyCap: s.dailyCap,
      aiSpendThisMonth: Number(s.aiSpendThisMonth.toFixed(2)),
      aiLimit: Number(s.aiLimit.toFixed(2)),
      requestsToday: s.requestsToday,
      requestsDailyLimit: s.requestsDailyLimit,
      testMode: s.testMode,
    };
  }

  async updateAiLimit(organizationId: string, input: UpdateAiLimitInput) {
    const updated = await this.settingsRepository.update(organizationId, {
      aiLimit: Number(input.aiLimit.toFixed(2)),
    });
    return {
      sentToday: updated.sentToday,
      dailyCap: updated.dailyCap,
      aiSpendThisMonth: Number(updated.aiSpendThisMonth.toFixed(2)),
      aiLimit: Number(updated.aiLimit.toFixed(2)),
      requestsToday: updated.requestsToday,
      requestsDailyLimit: updated.requestsDailyLimit,
      testMode: updated.testMode,
    };
  }

  async getTestMode(organizationId: string) {
    const s = await this.settingsRepository.getOrCreate(organizationId);
    return {
      testMode: s.testMode,
      enabled: s.testMode,
    };
  }

  async updateTestMode(organizationId: string, input: UpdateTestModeInput) {
    const nextValue = Boolean(input.testMode ?? input.enabled);
    const updated = await this.settingsRepository.update(organizationId, {
      testMode: nextValue,
    });
    return {
      testMode: updated.testMode,
      enabled: updated.testMode,
    };
  }
}
