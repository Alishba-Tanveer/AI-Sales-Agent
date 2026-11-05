import { findCompanyContact } from "../../integrations/contact-finder";
import { LeadStage, Prisma, prisma } from "@ai-sales-agent/database";
import { generateGeminiJson } from "../../integrations/ai";
import { ensureOutreachGreeting, outreachGreeting, researchRecipient } from "../../integrations/outreach-research";
import { AppError } from "../../utils/app-error";
import { trackActivity } from "../activity/activity-logger";

const emptyToNull = (value: string | undefined) => value?.trim() || null;
const toDateOrNull = (value: string | undefined) => value?.trim() ? new Date(value) : null;

export class LeadsService {
  async list(organizationId: string, input: { q?: string; stage?: string; includeArchived?: boolean }) {
    const q = input.q?.trim();
    const where: Prisma.LeadWhereInput = {
      organizationId,
      ...(input.includeArchived ? {} : { archivedAt: null }),
      ...(input.stage ? { stage: input.stage as LeadStage } : {}),
      ...(q ? { OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
        { jobTitle: { contains: q, mode: "insensitive" } },
      ] } : {}),
    };
    const [leads, total, stageGroups] = await Promise.all([
      prisma.lead.findMany({ where, orderBy: [{ updatedAt: "desc" }, { name: "asc" }] }),
      prisma.lead.count({ where }),
      prisma.lead.groupBy({ by: ["stage"], where: { organizationId, archivedAt: null }, _count: { _all: true } }),
    ]);
    const counts = Object.fromEntries(stageGroups.map((item) => [item.stage, item._count._all]));
    // which channels each lead has actually been messaged on (decides where a reply can be logged)
    const sent = leads.length ? await prisma.leadCommunication.groupBy({
      by: ["leadId", "channel"],
      where: { organizationId, leadId: { in: leads.map((lead) => lead.id) }, direction: "OUTBOUND", status: "SENT"},
    }) : [];
    const withChannels = leads.map((lead) => ({ ...lead, sentChannels: sent.filter((item) => item.leadId === lead.id).map((item) => item.channel) }));
    return { leads: withChannels, total, counts };
  }

  async get(organizationId: string, id: string) {
    const lead = await prisma.lead.findFirst({
      where: { id, organizationId },
      include: { communications: { orderBy: { occurredAt: "desc" } }, linkedinLead: { select: { id: true } } },
    });
    if (!lead) throw new AppError("Lead not found", 404);
    return lead;
  }

  async create(organizationId: string, input: {
    name: string; email?: string; company?: string; jobTitle?: string; source?: string;
    notes?: string; linkedinUrl?: string; websiteUrl?: string; nextFollowUpAt?: string; stage?: string;
  }) {
    return trackActivity({
      organizationId, agent: "General Agent", kind: "lead", title: `Add lead: ${input.name.trim()}`, leadName: input.name.trim(), context: input.company,
      run: () => prisma.lead.create({ data: {
        organizationId,
        name: input.name.trim(),
        email: emptyToNull(input.email),
        company: emptyToNull(input.company),
        jobTitle: emptyToNull(input.jobTitle),
        source: emptyToNull(input.source) ?? "Manual",
        notes: emptyToNull(input.notes),
        linkedinUrl: emptyToNull(input.linkedinUrl),
        websiteUrl: emptyToNull(input.websiteUrl),
        nextFollowUpAt: toDateOrNull(input.nextFollowUpAt),
        stage: (input.stage as LeadStage | undefined) ?? LeadStage.NEW,
      } }),
      output: (lead) => `${lead.name} added to the lead pipeline as ${lead.stage}.`,
    });
  }

  async import(organizationId: string, leads: Array<{
    name: string; email?: string; company?: string; jobTitle?: string; source?: string;
    notes?: string; linkedinUrl?: string; websiteUrl?: string; nextFollowUpAt?: string; stage?: string;
  }>) {
    const data = leads.map((lead) => ({
      organizationId,
      name: lead.name.trim(),
      email: emptyToNull(lead.email),
      company: emptyToNull(lead.company),
      jobTitle: emptyToNull(lead.jobTitle),
      source: emptyToNull(lead.source) ?? "CSV import",
      notes: emptyToNull(lead.notes),
      linkedinUrl: emptyToNull(lead.linkedinUrl),
      websiteUrl: emptyToNull(lead.websiteUrl),
      nextFollowUpAt: toDateOrNull(lead.nextFollowUpAt),
      stage: (lead.stage as LeadStage | undefined) ?? LeadStage.NEW,
    }));
    return trackActivity({
      organizationId, agent: "General Agent", kind: "lead", title: `Import ${data.length} leads`, context: "CSV import",
      run: async () => {
        const created = await prisma.$transaction(data.map((item) => prisma.lead.create({ data: item })));
        return { importedCount: created.length, leads: created };
      },
      output: (result) => `${result.importedCount} leads imported into the pipeline.`,
    });
  }

  async update(organizationId: string, id: string, input: {
    name?: string; email?: string; company?: string; jobTitle?: string; source?: string;
    notes?: string; linkedinUrl?: string; websiteUrl?: string; nextFollowUpAt?: string; stage?: string;
  }) {
    const existing = await prisma.lead.findFirst({ where: { id, organizationId } });
    if (!existing) throw new AppError("Lead not found", 404);
    const data: Prisma.LeadUpdateInput = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.email !== undefined ? { email: emptyToNull(input.email) } : {}),
      ...(input.company !== undefined ? { company: emptyToNull(input.company) } : {}),
      ...(input.jobTitle !== undefined ? { jobTitle: emptyToNull(input.jobTitle) } : {}),
      ...(input.source !== undefined ? { source: emptyToNull(input.source) } : {}),
      ...(input.notes !== undefined ? { notes: emptyToNull(input.notes) } : {}),
      ...(input.linkedinUrl !== undefined ? { linkedinUrl: emptyToNull(input.linkedinUrl) } : {}),
      ...(input.websiteUrl !== undefined ? { websiteUrl: emptyToNull(input.websiteUrl) } : {}),
      ...(input.nextFollowUpAt !== undefined ? { nextFollowUpAt: toDateOrNull(input.nextFollowUpAt) } : {}),
      ...(input.stage !== undefined ? { stage: input.stage as LeadStage } : {}),
      ...(input.stage === LeadStage.DO_NOT_CONTACT ? { nextFollowUpAt: null } : {}),
    };
    return prisma.lead.update({ where: { id }, data });
  }

  async archive(organizationId: string, id: string) {
    const result = await prisma.lead.updateMany({ where: { id, organizationId, archivedAt: null }, data: { archivedAt: new Date() } });
    if (!result.count) throw new AppError("Lead not found", 404);
    return { archived: true };
  }

  async draftEmail(organizationId: string, id: string, instruction?: string, channel: "EMAIL" | "LINKEDIN" = "EMAIL") {
    const [lead, organization] = await Promise.all([
      prisma.lead.findFirst({ where: { id, organizationId } }),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, description: true, services: true, differentiation: true } }),
    ]);
    if (!lead) throw new AppError("Lead not found", 404);
    if (lead.stage === LeadStage.DO_NOT_CONTACT) throw new AppError("This lead is marked Do Not Contact.", 409);
    const isLinkedIn = channel === "LINKEDIN";
    if (isLinkedIn && !lead.linkedinUrl) throw new AppError("Add a LinkedIn profile link to this lead to draft a LinkedIn message.", 422);
    if (isLinkedIn && lead.stage === LeadStage.NEW && !lead.linkedinConnectedAt) {
      throw new AppError(`Connect with ${lead.name} on LinkedIn first, mark them as connected, then draft your message.`, 409);
    }
    const conversation = (await prisma.leadCommunication.findMany({
      where: {
        organizationId,
        leadId: lead.id,
        OR: [
          { direction: "INBOUND", status: "RECEIVED" },
          { direction: "OUTBOUND", status: "SENT" },
        ],
      },
      orderBy: { occurredAt: "desc" },
      take: 12,
    })).reverse();
    const greeting = outreachGreeting(lead.name, lead.company);
    const lastMessage = conversation.at(-1);
    const isReply = lastMessage?.direction === "INBOUND";
    const isFollowup = conversation.length > 0 && lastMessage?.direction === "OUTBOUND";
    return trackActivity({
      organizationId, agent: "General Agent", kind: "draft", title: `Draft ${isLinkedIn ? "LinkedIn message" : "email"}: ${lead.name}`, leadName: lead.name, context: lead.company ?? "",
      run: async () => {
        const publicResearch = await researchRecipient({ name: lead.name, company: lead.company, jobTitle: lead.jobTitle });
        const scenario = isLinkedIn
          ? "first-touch LinkedIn message"
          : isReply
            ? "email reply to the latest message the prospect sent"
            : isFollowup
              ? "follow-up email after the latest message we sent"
              : "first-touch email";
        const emailScenarioRule = isReply
          ? "Reply directly to the prospect's latest incoming message and address what they actually said."
          : isFollowup
            ? "Write a courteous follow-up to our latest sent email. Do not suggest that the prospect replied or opened it."
            : "Write a first-touch email. Do not imply prior contact or a relationship that is not in the supplied context.";
        const draft = await generateGeminiJson<{ subject: string; body: string }>({
          system: isLinkedIn
            ? "Write a genuinely personalized, friendly LinkedIn message to a new connection. Start with the greeting supplied in the prompt. Connect one verified detail about the recipient or company to the sender's exact services, then ask one clear, low-pressure question. Do not use generic praise or claim familiarity. Never invent facts. No signature or links. Keep it under 70 words. Return JSON with subject (a short internal label) and body."
            : `${emailScenarioRule} Write a genuinely personalized B2B email. Start exactly with the greeting from the prompt. Make the message about this specific recipient: reference one concrete, relevant fact from the supplied notes, conversation, or public research, then explain why the sender's exact service is relevant to that fact and the recipient's role. Use the sender's services and differentiation, not a generic pitch. Every sentence after the greeting must be specific to the recipient, their company, their role, the conversation, or the relevant offer. Do not invent facts, use empty praise, or include unrelated claims. Ask one clear, low-pressure question. Make the subject specific to this contact's context. Keep it concise, 80 to 140 words, and return JSON with subject and body.`,
          prompt: JSON.stringify({
            scenario,
            sender: organization,
            recipient: { name: lead.name, greeting, role: lead.jobTitle, company: lead.company, website: lead.websiteUrl },
            leadContext: lead.notes,
            publicResearch,
            conversation: conversation.map((message) => ({ direction: message.direction, channel: message.channel, subject: message.subject, body: message.body })),
            instruction: instruction?.trim() || "Use the strongest verified detail to make this message relevant. If there is no reliable personal detail, be transparent and personalize only from the verified company, role, and offer. Do not make up a trigger or pain point.",
          }),
        });
        if (!draft.body?.trim() || (!isLinkedIn && !draft.subject?.trim())) throw new AppError("The draft provider returned an incomplete message.", 502);
        const personalizedBody = ensureOutreachGreeting(draft.body, greeting);
        return prisma.leadCommunication.create({ data: {
          organizationId, leadId: id, channel, direction: "OUTBOUND", status: "DRAFT",
          subject: isLinkedIn ? null : draft.subject.trim().slice(0, 240), body: personalizedBody.slice(0, 10_000),
        } });
      },
      output: () => `${isLinkedIn ? "LinkedIn message" : "Email"} draft saved for ${lead.name} for manual review.`,
    });
  }

  /** Records that the lead accepted your LinkedIn connection request, which unlocks drafting the first LinkedIn message. */
  async markLinkedInConnected(organizationId: string, id: string) {
    const lead = await prisma.lead.findFirst({ where: { id, organizationId, archivedAt: null } });
    if (!lead) throw new AppError("Lead not found", 404);
    if (lead.stage === LeadStage.DO_NOT_CONTACT) throw new AppError("This lead is marked Do Not Contact.", 409);
    if (lead.linkedinConnectedAt) return lead;
    return prisma.lead.update({ where: { id }, data: { linkedinConnectedAt: new Date() } });
  }

  async findContact(organizationId: string, id: string) {
    const lead = await prisma.lead.findFirst({ where: { id, organizationId } });
    if (!lead) throw new AppError("Lead not found", 404);

    return trackActivity({
      organizationId,
      agent: "General Agent",
      kind: "enrich",
      title: `Find contact: ${lead.company || lead.name}`,
      leadName: lead.name,
      context: lead.company ?? "",
      run: async () => {
        // Reads the lead's website and, when that is not enough, a web search. Only real finds are saved:
        // no LinkedIn "search link" is stored as if it were a profile.
        const found = await findCompanyContact({
          company: lead.company || lead.name,
          urls: [lead.websiteUrl],
          known: { email: lead.email, linkedinUrl: lead.linkedinUrl },
        });
        return prisma.lead.update({
          where: { id },
          data: {
            email: found.email ?? lead.email,
            linkedinUrl: found.linkedinUrl ?? lead.linkedinUrl,
            ...(!lead.websiteUrl && found.websiteUrl ? { websiteUrl: found.websiteUrl } : {}),
          },
        });
      },
      output: (l) => `Contact search for ${l.company || l.name}: Email: ${l.email || "not found"}, LinkedIn: ${l.linkedinUrl ? "found" : "not found"}.`,
    });
  }
}

export const leadsService = new LeadsService();
