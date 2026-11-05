import { prisma, Prisma } from "@ai-sales-agent/database";

export const DEFAULT_NOTIFICATION_RULES = [
  {
    id: "interested",
    title: "Interested Leads (Positive Reply Intent)",
    badge: { label: "P0 Highest Priority", tone: "success" as const },
    description:
      "Choose whether to receive email and in-app alerts when a reply is classified as interested.",
    email: true,
    inApp: true,
  },
  {
    id: "failures",
    title: "Failed Jobs & Sync Errors",
    badge: { label: "System Warning", tone: "destructive" as const },
    description:
      "Choose whether to receive email and in-app alerts for mailbox, LinkedIn, and other reported system failures.",
    email: true,
    inApp: false,
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
