import { LeadStage, Prisma, prisma } from "@ai-sales-agent/database";
import { generateGeminiJson } from "../../integrations/ai";
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
    return { leads, total, counts };
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

  async draftEmail(organizationId: string, id: string, instruction?: string) {
    const [lead, organization] = await Promise.all([
      prisma.lead.findFirst({ where: { id, organizationId } }),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, description: true, services: true, differentiation: true } }),
    ]);
    if (!lead) throw new AppError("Lead not found", 404);
    if (lead.stage === LeadStage.DO_NOT_CONTACT) throw new AppError("This lead is marked Do Not Contact.", 409);
    return trackActivity({
      organizationId, agent: "General Agent", kind: "draft", title: `Draft email: ${lead.name}`, leadName: lead.name, context: lead.company ?? "",
      run: async () => {
        const draft = await generateGeminiJson<{ subject: string; body: string }>({
          system: "Write a short, respectful first-touch B2B sales email. Return JSON with subject and body. Do not invent facts about the recipient or their company. Include one clear, low-pressure question. Keep the body under 120 words.",
          prompt: JSON.stringify({ sender: organization, recipient: { name: lead.name, role: lead.jobTitle, company: lead.company }, context: lead.notes, instruction: instruction?.trim() || "Introduce the sender's offer and ask if a short conversation would be useful." }),
        });
        if (!draft.subject?.trim() || !draft.body?.trim()) throw new AppError("The draft provider returned an incomplete email.", 502);
        return prisma.leadCommunication.create({ data: {
          organizationId, leadId: id, channel: "EMAIL", direction: "OUTBOUND", status: "DRAFT",
          subject: draft.subject.trim().slice(0, 240), body: draft.body.trim().slice(0, 10_000),
        } });
      },
      output: (draft) => `Email draft saved for ${lead.name} for manual review.`,
    });
  }
}

export const leadsService = new LeadsService();
