import { prisma, Prisma } from "@ai-sales-agent/database";

export const DEFAULT_NOTIFICATION_RULES = [
  {
    id: "approvals",
    title: "Pending Approvals Queue",
    badge: { label: "Immediate", tone: "warning" as const },
    description: "Notify when drafts enter the Approvals queue waiting for sign-off.",
    email: true,
    inApp: true,
  },
  {
    id: "interested",
    title: "Interested Leads (Positive Reply Intent)",
    badge: { label: "P0 Highest Priority", tone: "success" as const },
    description:
      "Trigger instant webhook and notification when an AI sentiment analyzer flags positive buying sentiment.",
    email: true,
    inApp: true,
  },
  {
    id: "failures",
    title: "Failed Jobs & Sync Errors",
    badge: { label: "System Warning", tone: "destructive" as const },
    description:
      "Notify when mailbox SMTP warmup disconnects, LinkedIn session cookie invalidates, or scraping jobs abort.",
    email: true,
    inApp: false,
  },
  {
    id: "digest",
    title: "Daily Pipeline Summary Digest",
    badge: { label: "08:30 AM Daily", tone: "primary" as const },
    description:
      "Send an executive morning briefing with conversion analytics, email reply rates, and queued opportunities.",
    email: true,
    inApp: true,
  },
];

export class SettingsRepository {
  async getOrCreate(organizationId: string) {
    return prisma.workspaceSettings.upsert({
      where: { organizationId },
      update: {},
      create: {
        organizationId,
        notificationRules: DEFAULT_NOTIFICATION_RULES,
      },
    });
  }

  async update(organizationId: string, data: Prisma.WorkspaceSettingsUpdateInput) {
    await this.getOrCreate(organizationId);
    return prisma.workspaceSettings.update({
      where: { organizationId },
      data,
    });
  }
}
