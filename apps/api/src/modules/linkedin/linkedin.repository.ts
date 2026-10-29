import { prisma, Prisma } from "@ai-sales-agent/database";

export type SuggestionKey = "headline" | "about" | "experience" | "skills" | "featured";

export interface ProfileSuggestionItem {
  id: string;
  key: SuggestionKey;
  title: string;
  section: "intro" | "about" | "experience" | "skills" | "featured";
  current: string;
  suggested: string;
  why: string;
  /** false when the person did not give us this section, so there is nothing to compare against */
  provided?: boolean;
  done: boolean;
  appliedAt?: string;
  status: "pending" | "accepted" | "dismissed" | "applied";
}

export interface AuditHistoryEntry {
  id: string;
  profileUrl: string;
  offer: string;
  audience: string;
  score: number;
  readAt: string;
  doneCount: number;
  totalCount: number;
  createdAt: string;
}

export interface ContentSourceItem {
  name: string;
  url: string;
  enabled: boolean;
}

export interface ProfileContext {
  personName?: string;
  roleTitle?: string;
  orgName?: string;
  services?: string[];
  targetTitles?: string[];
  targetIndustries?: string[];
  currentSections?: Partial<Record<SuggestionKey, string>>;
}

/** Cuts at a word boundary (no "..." ever) so text fits a LinkedIn limit. */
function fitWords(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,|&-]+$/, "");
}

const splitList = (s: string) =>
  s.split(/[,\n;•|]+/).map((x) => x.trim()).filter(Boolean);

/**
 * Builds the list of changes from what the person told us. LinkedIn does not let apps read a profile, so
 * `ctx.currentSections` holds text the person pasted (or took from their "Save to PDF"). Nothing here is invented:
 * a section the person did not give us has an empty `current`, and anything we cannot know (a result, a booking
 * link) is left as a [bracketed] blank for them to fill in.
 */
export function buildSuggestionsForNiche(
  offer: string,
  audience: string,
  ctx?: ProfileContext,
): ProfileSuggestionItem[] {
  const services = ctx?.services?.filter(Boolean) ?? [];
  const cleanOffer = offer.trim() || services.join(", ") || "[what you do]";
  const cleanAudience =
    audience.trim() ||
    (ctx?.targetTitles?.length ? `${ctx.targetTitles.join(", ")} at ${ctx?.targetIndustries?.join(", ") || "growing"} companies` : "[who you help]");
  const role = ctx?.roleTitle?.trim();
  const org = ctx?.orgName?.trim();
  const cur = ctx?.currentSections ?? {};

  const currentHeadline = (cur.headline ?? "").trim();
  const currentAbout = (cur.about ?? "").trim();
  const currentExp = (cur.experience ?? "").trim();
  const currentSkills = (cur.skills ?? "").trim();
  const currentFeatured = (cur.featured ?? "").trim();

  const tail = [role, org ? (role ? `@ ${org}` : org) : ""].filter(Boolean).join(" ");
  const suggestedHeadline = fitWords(`${cleanOffer} for ${cleanAudience}${tail ? ` | ${tail}` : ""}`, 220);

  const bullets = (services.length ? services : splitList(cleanOffer)).slice(0, 4).map((s) => `• ${s}`);
  const suggestedAbout = [
    `I help ${cleanAudience} with ${cleanOffer}.`,
    bullets.length ? `What I do:\n${bullets.join("\n")}` : "",
    currentAbout ? `Background:\n${currentAbout}` : "",
    "Want to talk? Send me a message or book a call: [add your booking link]",
  ].filter(Boolean).join("\n\n");

  const suggestedExp = currentExp
    ? `${currentExp}\n\nAdd one real result to your latest role: [what you did] for [who], which led to [number or outcome].`
    : `${role || "[your role]"} at ${org || "[your company]"}: ${cleanOffer} for ${cleanAudience}. Result: [add a real number or outcome].`;

  const existing = splitList(currentSkills);
  const wanted = [...services, ...(ctx?.targetTitles ?? []), ...splitList(cleanOffer)].filter((s) => s.length <= 40);
  const seen = new Set(existing.map((s) => s.toLowerCase()));
  const added = wanted.filter((s) => {
    const k = s.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const suggestedSkills = [...existing, ...added].slice(0, 50).join(", ");

  const suggestedFeatured = `Pin a short demo or case study of ${org || "your work"} and a direct booking link, so a profile visit can turn into a meeting.`;

  const item = (
    key: SuggestionKey,
    title: string,
    section: ProfileSuggestionItem["section"],
    current: string,
    suggested: string,
    why: string,
  ): ProfileSuggestionItem => ({
    id: `rec_${key}`,
    key,
    title,
    section,
    current,
    suggested,
    why,
    provided: current.length > 0,
    done: false,
    status: "pending",
  });

  return [
    item("headline", "Headline", "intro", currentHeadline, suggestedHeadline,
      `Your headline is what people see in search and next to every message you send. This one names who you help (${cleanAudience}) and what you do (${cleanOffer}).`),
    item("about", "About Summary", "about", currentAbout, suggestedAbout,
      "It opens with who you help, lists what you do, keeps your own background, and ends with one clear next step."),
    item("experience", "Experience wording", "experience", currentExp, suggestedExp,
      "A result with a real number is more believable than a list of duties. Fill the [brackets] with your own figures."),
    item("skills", "Skills", "skills", currentSkills, suggestedSkills,
      "Your current skills are kept. The new ones match what you sell and who you sell to, so you show up when buyers search."),
    item("featured", "Featured / CTA", "featured", currentFeatured, suggestedFeatured,
      "Featured sits right under your summary. A demo and a booking link there turn visits into conversations."),
  ];
}

export class LinkedinRepository {
  async getOrCreateConfig(organizationId: string) {
    const existing = await prisma.linkedinConfig.findUnique({
      where: { organizationId },
    });
    if (existing) return existing;

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    const initialOffer = org?.services?.length ? org.services.join(", ") : "";
    const initialAudience = org?.targetTitles?.length ? `${org.targetTitles.join(", ")}${org.targetIndustries?.length ? ` at ${org.targetIndustries.join(", ")}` : ""}` : "";
    const defaultMessage = "Hi {first_name}, I noticed your work at {company}. I help {audience} with {offer} and would value connecting to exchange ideas.";

    return prisma.linkedinConfig.create({
      data: {
        organizationId,
        offer: initialOffer,
        audience: initialAudience,
        groundingFacts: {
          offer: initialOffer,
          audience: initialAudience,
        } as unknown as Prisma.InputJsonValue,
        latestScore: 0,
        latestReadAt: null,
        suggestions: [] as unknown as Prisma.InputJsonValue,
        auditHistory: [] as unknown as Prisma.InputJsonValue,
        contentSources: [] as unknown as Prisma.InputJsonValue,
        strategyWho: initialAudience || "Decision-makers in your target market",
        strategyMessage: defaultMessage,
      },
    });
  }

  async updateConfig(organizationId: string, data: Prisma.LinkedinConfigUpdateInput) {
    await this.getOrCreateConfig(organizationId);
    return prisma.linkedinConfig.update({
      where: { organizationId },
      data,
    });
  }

  async findScripts(organizationId: string) {
    return prisma.linkedinScript.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
  }

  async findScriptById(organizationId: string, id: string) {
    return prisma.linkedinScript.findFirst({
      where: { id, organizationId },
    });
  }

  async createScript(organizationId: string, data: Omit<Prisma.LinkedinScriptCreateInput, "organization">) {
    return prisma.linkedinScript.create({
      data: {
        ...data,
        organization: { connect: { id: organizationId } },
      },
    });
  }

  async updateScript(organizationId: string, id: string, data: Prisma.LinkedinScriptUpdateInput) {
    return prisma.linkedinScript.update({
      where: { id },
      data,
    });
  }

  async deleteScript(organizationId: string, id: string) {
    return prisma.linkedinScript.deleteMany({
      where: { id, organizationId },
    });
  }

  async findLeads(organizationId: string) {
    return prisma.linkedinLead.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
  }

  async findLeadById(organizationId: string, id: string) {
    return prisma.linkedinLead.findFirst({
      where: { id, organizationId },
    });
  }

  /** Pass `db` (a transaction client) to make this insert part of a larger all-or-nothing change. */
  async createLead(
    organizationId: string,
    data: Omit<Prisma.LinkedinLeadCreateInput, "organization">,
    db: Pick<Prisma.TransactionClient, "linkedinLead"> = prisma,
  ) {
    return db.linkedinLead.create({
      data: {
        ...data,
        organization: { connect: { id: organizationId } },
      },
    });
  }

  async updateLead(id: string, data: Prisma.LinkedinLeadUpdateInput) {
    return prisma.linkedinLead.update({
      where: { id },
      data,
    });
  }

  /** Deletes only people who are not in the CRM Leads yet; returns how many rows were removed. */
  async deleteLeadsNotInCrm(organizationId: string, ids: string[]) {
    const res = await prisma.linkedinLead.deleteMany({
      where: { organizationId, id: { in: ids }, crmLeadId: null },
    });
    return res.count;
  }
}

export const linkedinRepository = new LinkedinRepository();
