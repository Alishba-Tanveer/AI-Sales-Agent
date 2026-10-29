import { LeadStage, prisma } from "@ai-sales-agent/database";
import { generateGeminiJson } from "../../integrations/ai";
import { AppError } from "../../utils/app-error";
import { trackActivity } from "../activity/activity-logger";

export class InboxService {
  /**
   * One conversation per person. Every reply logged for the same lead belongs to that lead's single thread, so the list
   * returns the newest received message of each lead (with how many they have sent) and the thread view shows everything:
   * their replies, your drafts and what you sent.
   */
  async list(organizationId: string, q?: string) {
    const messages = await prisma.leadCommunication.findMany({
      where: {
        organizationId,
        direction: "INBOUND",
        status: "RECEIVED",
        ...(q ? { OR: [
          { body: { contains: q, mode: "insensitive" } },
          { subject: { contains: q, mode: "insensitive" } },
          { lead: { is: { name: { contains: q, mode: "insensitive" } } } },
          { lead: { is: { company: { contains: q, mode: "insensitive" } } } },
        ] } : {}),
      },
      include: { lead: true },
      orderBy: { occurredAt: "desc" },
      take: 1000,
    });
    const byLead = new Map<string, { latest: (typeof messages)[number]; count: number }>();
    for (const message of messages) {
      const entry = byLead.get(message.leadId);
      if (entry) entry.count += 1;
      else byLead.set(message.leadId, { latest: message, count: 1 });
    }
    return [...byLead.values()].slice(0, 200).map(({ latest, count }) => ({ ...latest, threadReplyCount: count }));
  }

  async recordInbound(organizationId: string, input: { leadId: string; channel: "EMAIL" | "LINKEDIN"; subject?: string; body: string; occurredAt?: string }) {
    const lead = await prisma.lead.findFirst({ where: { id: input.leadId, organizationId, archivedAt: null } });
    if (!lead) throw new AppError("Lead not found", 404);
    const message = await prisma.leadCommunication.create({ data: {
      organizationId,
      leadId: lead.id,
      channel: input.channel,
      direction: "INBOUND",
      status: "RECEIVED",
      subject: input.subject?.trim() || null,
      body: input.body.trim(),
      ...(input.occurredAt ? { occurredAt: new Date(input.occurredAt) } : {}),
    } });
    if (!new Set<LeadStage>([LeadStage.WON, LeadStage.LOST, LeadStage.DO_NOT_CONTACT]).has(lead.stage)) {
      await prisma.lead.update({ where: { id: lead.id }, data: { stage: LeadStage.INTERESTED, nextFollowUpAt: null } });
    }
    return message;
  }

  async get(organizationId: string, id: string) {
    const message = await prisma.leadCommunication.findFirst({ where: { id, organizationId, direction: "INBOUND" }, include: { lead: true } });
    if (!message) throw new AppError("Inbox message not found", 404);
    const thread = await prisma.leadCommunication.findMany({ where: { organizationId, leadId: message.leadId }, orderBy: { occurredAt: "asc" } });
    return { message, thread };
  }

  async draftReply(organizationId: string, id: string, instruction?: string) {
    const message = await prisma.leadCommunication.findFirst({ where: { id, organizationId, direction: "INBOUND" }, include: { lead: true } });
    if (!message) throw new AppError("Inbox message not found", 404);
    if (message.lead.stage === LeadStage.DO_NOT_CONTACT) throw new AppError("This lead is marked Do Not Contact.", 409);
    const thread = await prisma.leadCommunication.findMany({ where: { organizationId, leadId: message.leadId }, orderBy: { occurredAt: "desc" }, take: 8 });
    return trackActivity({
      organizationId, agent: "General Agent", kind: "draft", title: `Draft ${message.channel.toLowerCase()} reply: ${message.lead.name}`, leadName: message.lead.name, context: message.lead.company ?? "",
      run: async () => {
        const draft = await generateGeminiJson<{ subject: string; body: string }>({
          system: "Draft a concise, helpful reply for this sales conversation. Return JSON with subject and body. Address only what the contact said; do not invent promises, facts, prices, or availability. Ask at most one clear next-step question.",
          prompt: JSON.stringify({ channel: message.channel, lead: { name: message.lead.name, role: message.lead.jobTitle, company: message.lead.company, notes: message.lead.notes }, conversation: thread.reverse().map((item) => ({ direction: item.direction, channel: item.channel, subject: item.subject, body: item.body })), instruction: instruction?.trim() }),
        });
        if (!draft.body?.trim()) throw new AppError("The draft provider returned an empty reply.", 502);
        return prisma.leadCommunication.create({ data: {
          organizationId,
          leadId: message.leadId,
          channel: message.channel,
          direction: "OUTBOUND",
          status: "DRAFT",
          subject: message.channel === "EMAIL" ? (draft.subject?.trim() || (message.subject ? `Re: ${message.subject}` : "Re: your message")).slice(0, 240) : null,
          body: draft.body.trim().slice(0, 10_000),
        } });
      },
      output: () => `${message.channel === "EMAIL" ? "Email" : "LinkedIn"} reply draft saved for ${message.lead.name} for manual review.`,
    });
  }

  async markSent(organizationId: string, id: string) {
    const draft = await prisma.leadCommunication.findFirst({ where: { id, organizationId, direction: "OUTBOUND", status: "DRAFT" } });
    if (!draft) throw new AppError("Draft not found", 404);
    return prisma.$transaction(async (tx) => {
      const sent = await tx.leadCommunication.update({ where: { id }, data: { status: "SENT", occurredAt: new Date() } });
      const lead = await tx.lead.findFirst({ where: { id: draft.leadId, organizationId } });
      if (lead && lead.stage === LeadStage.NEW) {
        await tx.lead.update({ where: { id: lead.id }, data: { stage: LeadStage.CONTACTED } });
      }
      return sent;
    });
  }
}

export const inboxService = new InboxService();
