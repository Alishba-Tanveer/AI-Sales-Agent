import { LeadStage, prisma } from "@ai-sales-agent/database";
import { generateGeminiJson } from "../../integrations/ai";
import { ensureOutreachGreeting, outreachGreeting, researchRecipient } from "../../integrations/outreach-research";
import { AppError } from "../../utils/app-error";
import { trackActivity } from "../activity/activity-logger";
import { mailboxDb } from "../mailbox/mailbox.db";

/** Stages a lead only reaches after you have reached out to them. */
const CONTACTED_STAGES = new Set<LeadStage>([LeadStage.CONTACTED, LeadStage.INTERESTED, LeadStage.WON, LeadStage.LOST]);

export class InboxService {
  async deleteThread(organizationId: string, id: string) {
    const message = await prisma.leadCommunication.findFirst({ where: { id, organizationId }, select: { leadId: true } });
    if (!message) throw new AppError("Conversation not found", 404);
    await prisma.leadCommunication.deleteMany({ where: { organizationId, leadId: message.leadId } });
    return { deleted: true };
  }
  /**
   * One conversation per person. Every reply logged for the same lead belongs to that lead's single thread, so the list
   * returns the newest received or sent message for each lead and the thread view shows the full conversation.
   */
  async list(organizationId: string, q?: string) {
    const messages = await prisma.leadCommunication.findMany({
      where: {
        organizationId,
        OR: [
          { direction: "INBOUND", status: "RECEIVED" },
          { direction: "OUTBOUND", status: "SENT" },
        ],
        ...(q ? { AND: [{ OR: [
          { body: { contains: q, mode: "insensitive" } },
          { subject: { contains: q, mode: "insensitive" } },
          { lead: { is: { name: { contains: q, mode: "insensitive" } } } },
          { lead: { is: { company: { contains: q, mode: "insensitive" } } } },
        ] }] } : {}),
      },
      include: { lead: true },
      orderBy: { occurredAt: "desc" },
      take: 1000,
    });
    const byLead = new Map<string, { latest: (typeof messages)[number]; replyCount: number }>();
    for (const message of messages) {
      const entry = byLead.get(message.leadId);
      if (entry) {
        if (message.direction === "INBOUND") entry.replyCount += 1;
      } else byLead.set(message.leadId, { latest: message, replyCount: message.direction === "INBOUND" ? 1 : 0 });
    }
    const entries = [...byLead.values()].slice(0, 200);
    // Replies that arrived through the mailbox automation carry what the AI understood them to mean (interested, question, ...).
    const intents = await mailboxDb.intents(organizationId, entries.map(({ latest }) => latest.id));
    return entries.map(({ latest, replyCount }) => ({ ...latest, threadReplyCount: replyCount, intent: intents[latest.id] ?? null }));
  }

  async recordInbound(organizationId: string, input: { leadId: string; channel: "EMAIL" | "LINKEDIN"; subject?: string; body: string; occurredAt?: string }) {
    const lead = await prisma.lead.findFirst({ where: { id: input.leadId, organizationId, archivedAt: null } });
    if (!lead) throw new AppError("Lead not found", 404);
    // A reply can only come from someone you contacted on that same channel. Leads moved to Contacted by hand (no message
    // sent through the app on any channel) are accepted on either channel.
    const sent = await prisma.leadCommunication.findMany({
      where: { organizationId, leadId: lead.id, direction: "OUTBOUND", status: "SENT" },
      select: { channel: true },
    });
    const onChannel = sent.some((item) => item.channel === input.channel);
    if (!onChannel && !(sent.length === 0 && CONTACTED_STAGES.has(lead.stage))) {
      throw new AppError(input.channel === "LINKEDIN"
        ? `You haven't messaged ${lead.name} on LinkedIn yet. Connect with them, draft and send a LinkedIn message from the lead page, then log their reply.`
        : `You haven't emailed ${lead.name} yet. Draft and send an email from the lead page, then log their reply.`, 409);
    }
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
      await prisma.lead.update({ where: { id: lead.id }, data: { stage: LeadStage.INTERESTED } });
    }
    return message;
  }

  async get(organizationId: string, id: string) {
    const message = await prisma.leadCommunication.findFirst({ where: { id, organizationId }, include: { lead: true } });
    if (!message) throw new AppError("Inbox message not found", 404);
    const thread = await prisma.leadCommunication.findMany({ where: { organizationId, leadId: message.leadId }, orderBy: { occurredAt: "asc" } });
    const intents = await mailboxDb.intents(organizationId, thread.map((item) => item.id));
    return { message, thread: thread.map((item) => ({ ...item, intent: intents[item.id] ?? null })) };
  }

  async draftReply(organizationId: string, id: string, instruction?: string) {
    const message = await prisma.leadCommunication.findFirst({
      where: {
        id,
        organizationId,
        OR: [
          { direction: "INBOUND", status: "RECEIVED" },
          { direction: "OUTBOUND", status: "SENT", channel: "EMAIL" },
        ],
      },
      include: { lead: true },
    });
    if (!message) throw new AppError("Inbox message not found", 404);
    if (message.lead.stage === LeadStage.DO_NOT_CONTACT) throw new AppError("This lead is marked Do Not Contact.", 409);
    const [thread, organization] = await Promise.all([
      prisma.leadCommunication.findMany({
        where: {
          organizationId,
          leadId: message.leadId,
          OR: [
            { direction: "INBOUND", status: "RECEIVED" },
            { direction: "OUTBOUND", status: "SENT" },
          ],
        },
        orderBy: { occurredAt: "desc" },
        take: 12,
      }),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, description: true, services: true, differentiation: true } }),
    ]);
    thread.reverse();
    const latest = thread.at(-1);
    const isFollowup = latest?.direction === "OUTBOUND";
    const greeting = outreachGreeting(message.lead.name, message.lead.company);
    return trackActivity({
      organizationId, agent: "General Agent", kind: "draft", title: `${isFollowup ? "Draft email follow-up" : `Draft ${message.channel.toLowerCase()} reply`}: ${message.lead.name}`, leadName: message.lead.name, context: message.lead.company ?? "",
      run: async () => {
        const publicResearch = await researchRecipient({ name: message.lead.name, company: message.lead.company, jobTitle: message.lead.jobTitle });
        const draft = await generateGeminiJson<{ subject: string; body: string }>({
          system: `${isFollowup
            ? "Write a courteous follow-up after the latest email we sent. Do not imply the prospect replied or opened it."
            : "Reply directly to the prospect's latest incoming message and address what they actually said."} Start with the greeting supplied in the prompt. Make the message specific to this person and conversation, and connect the relevant point to the sender's exact services only when useful. Use the sender's services and differentiation. Every sentence must relate to the person, their company, their role, the conversation, or the relevant offer. Do not invent facts, promises, prices, availability, or familiarity. Avoid generic filler and empty praise. Ask at most one clear, low-pressure question. Keep the reply concise, 80 to 140 words. Return JSON with subject and body.`,
          prompt: JSON.stringify({
            scenario: isFollowup ? "follow-up after our sent email" : "reply to the prospect's latest inbound message",
            sender: organization,
            recipient: { name: message.lead.name, greeting, role: message.lead.jobTitle, company: message.lead.company, website: message.lead.websiteUrl },
            leadContext: message.lead.notes,
            publicResearch,
            conversation: thread.map((item) => ({ direction: item.direction, channel: item.channel, subject: item.subject, body: item.body })),
            instruction: instruction?.trim() || "Use a specific detail from the conversation, notes, or public research. Explain why the sender's offer is relevant to that detail. If no reliable detail is available, do not make one up; use only verified role and company information.",
          }),
        });
        if (!draft.body?.trim()) throw new AppError("The draft provider returned an empty reply.", 502);
        const body = ensureOutreachGreeting(draft.body, greeting);
        return prisma.leadCommunication.create({ data: {
          organizationId,
          leadId: message.leadId,
          channel: message.channel,
          direction: "OUTBOUND",
          status: "DRAFT",
          subject: message.channel === "EMAIL" ? (draft.subject?.trim() || (message.subject ? `Re: ${message.subject}` : "Re: your message")).slice(0, 240) : null,
          body: body.slice(0, 10_000),
        } });
      },
      output: () => `${message.direction === "OUTBOUND" ? "Email follow-up" : `${message.channel === "EMAIL" ? "Email" : "LinkedIn"} reply`} draft saved for ${message.lead.name} for manual review.`,
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
