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
  done: boolean;
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

export const DEFAULT_SOURCES: ContentSourceItem[] = [
  { name: "TechCrunch", url: "https://techcrunch.com", enabled: true },
  { name: "Reuters", url: "https://reuters.com", enabled: true },
  { name: "Forbes", url: "https://forbes.com", enabled: true },
];

export interface ProfileContext {
  personName?: string;
  roleTitle?: string;
  orgName?: string;
  services?: string[];
  targetTitles?: string[];
  targetIndustries?: string[];
  currentSections?: Partial<Record<SuggestionKey, string>>;
}

export function buildSuggestionsForNiche(
  offer: string,
  audience: string,
  ctx?: ProfileContext,
): ProfileSuggestionItem[] {
  const cleanOffer = offer.trim() || (ctx?.services?.length ? ctx.services.join(", ") : "I build AI agents for B2B SaaS outbound");
  const cleanAudience = audience.trim() || (ctx?.targetTitles?.length ? `${ctx.targetTitles.join(", ")} at ${ctx?.targetIndustries?.join(", ") || "SaaS"} companies` : "B2B SaaS teams");
  const name = ctx?.personName || "Founder & Growth Leader";
  const role = ctx?.roleTitle || "Full Stack Engineer & Tech Lead";
  const org = ctx?.orgName || "AI Sales Agent";

  const currentHeadline = ctx?.currentSections?.headline || `${name} | ${role}`;
  const currentAbout = ctx?.currentSections?.about || `${name} is an experienced professional at ${org}. Focused on building high-performance systems, outbound automation, and scaling operations.\n\nLooking for new partnerships and strategic opportunities.`;
  const currentExp = ctx?.currentSections?.experience || `Leading product development, automated prospecting, and client solutions at ${org}.`;
  const currentSkills = ctx?.currentSections?.skills || (ctx?.services?.length ? ctx.services.slice(0, 4).join(", ") : "Full Stack Development, AI Automation, System Design, B2B Growth");
  const currentFeatured = ctx?.currentSections?.featured || `Featured case study and workflow overview for ${org}.`;

  const suggestedHeadline = `${cleanOffer} for ${cleanAudience} | Founder & AI Engineer @ ${org}`;
  const suggestedAbout = `${cleanAudience} often lose high-value pipeline because prospecting and first-touch outreach are slow, manual, and inconsistent.\n\nAt ${org}, we deliver:\n• ${cleanOffer}\n• Custom AI sequences personalized to each buyer\n• Guaranteed SLA on replies and qualified meetings\n\nWant to see how our AI workflow works? Send me a DM or book a demo.`;
  const suggestedExp = `Built and deployed automated outbound systems at ${org} that cut manual prospecting time by 75% and raised qualified meeting conversions across enterprise accounts.`;
  const suggestedSkills = `AI Agents, B2B Outbound, ${cleanOffer.slice(0, 25)}, Sales Automation, Pipeline Engineering`;
  const suggestedFeatured = `Pin a 60-second interactive demo of ${org}'s AI outbound system and a direct booking link.`;

  return [
    {
      id: "rec_headline",
      key: "headline",
      title: "Headline",
      section: "intro",
      current: currentHeadline,
      suggested: suggestedHeadline,
      why: `A headline that directly names who you help (${cleanAudience}) and the result (${cleanOffer}) ranks higher in LinkedIn search and converts profile views into pipeline in one line.`,
      done: false,
      status: "pending",
    },
    {
      id: "rec_about",
      key: "about",
      title: "About Summary",
      section: "about",
      current: currentAbout,
      suggested: suggestedAbout,
      why: "The suggested summary leads with your buyer's exact problem, highlights your core solution with bullet points, and ends with a clear call-to-action.",
      done: false,
      status: "pending",
    },
    {
      id: "rec_experience",
      key: "experience",
      title: "Experience wording",
      section: "experience",
      current: currentExp,
      suggested: suggestedExp,
      why: "Measurable results with specific percentage increases build instant credibility compared to generic lists of duties.",
      done: false,
      status: "pending",
    },
    {
      id: "rec_skills",
      key: "skills",
      title: "Skills",
      section: "skills",
      current: currentSkills,
      suggested: suggestedSkills,
      why: "LinkedIn recruiters and target B2B buyers search by specific skills. These keywords match your exact offering.",
      done: false,
      status: "pending",
    },
    {
      id: "rec_featured",
      key: "featured",
      title: "Featured / CTA",
      section: "featured",
      current: currentFeatured,
      suggested: suggestedFeatured,
      why: "The Featured section sits prominently beneath your summary—pinning a short demo turns profile visits into scheduled meetings.",
      done: false,
      status: "pending",
    },
  ];
}

const todayIso = new Date().toISOString().slice(0, 10);

const DEFAULT_SCRIPTS_SEED = [
  {
    status: "needs_approval",
    draftNo: 1,
    source: "TechCrunch",
    sourceUrl: "https://techcrunch.com/2026/10/21/meta-wants-to-pay-for-its-broad-ai-buildout-with-a-newly-created-class-of-stock/",
    date: todayIso,
    title: "Meta wants to pay for its broad AI buildout with a newly created class of stock",
    hook: "Meta is betting everything on AI infrastructure—here is what that means for software founders.",
    points: [
      "Enterprise demand for dedicated AI compute continues to explode this quarter.",
      "Companies with automated AI workflows are out-shipping larger teams 4-to-1.",
      "The window to automate manual operations is happening right now.",
    ],
    cta: "Follow me for practical AI outbound and automation insights every day.",
    seconds: 42,
    words: 105,
  },
  {
    status: "needs_approval",
    draftNo: 1,
    source: "Reuters",
    sourceUrl: "https://reuters.com",
    date: todayIso,
    title: "B2B buyers want fewer, better messages",
    hook: "Your prospects get 40 cold messages a week. Here is how to be the one they answer.",
    points: [
      "Short messages under 80 words beat long pitch decks.",
      "Mention something specific about their recent tech stack or hiring announcements.",
      "Ask one simple, zero-friction question.",
    ],
    cta: "Comment 'tips' and I will send you my 3-line template.",
    seconds: 38,
    words: 96,
  },
  {
    status: "needs_approval",
    draftNo: 2,
    source: "Forbes",
    sourceUrl: "https://forbes.com",
    date: todayIso,
    title: "The new rules of LinkedIn outreach",
    hook: "LinkedIn just updated its outreach limits. Do this instead of cold blasting.",
    points: [
      "Keep connection requests under your daily safety cap.",
      "Personalize the very first line with context on their business.",
      "Follow up once with new value, not five times.",
    ],
    cta: "Save this post and audit your team's outreach today.",
    seconds: 41,
    words: 104,
  },
  {
    status: "creating_video",
    draftNo: 1,
    source: "TechCrunch",
    sourceUrl: "https://techcrunch.com",
    date: todayIso,
    title: "Cold email is not dead, lazy email is",
    hook: "Cold email still works. Lazy cold email doesn't.",
    points: [
      "Research before you write.",
      "Lead with their problem.",
      "Keep it under 80 words.",
    ],
    cta: "Follow for tomorrow's tip.",
    seconds: 36,
    words: 90,
    scheduledFor: `${todayIso}T08:30:00`,
  },
  {
    status: "ready",
    draftNo: 1,
    source: "TechCrunch",
    sourceUrl: "https://techcrunch.com",
    date: todayIso,
    title: "Three signs a lead is ready to buy",
    hook: "Stop chasing everyone. Watch for these three signals.",
    points: [
      "They visit your pricing page twice.",
      "They ask about integration timelines.",
      "They loop in a senior stakeholder.",
    ],
    cta: "Which signal do you see most? Tell me below.",
    seconds: 42,
    words: 108,
    scheduledFor: `${todayIso}T08:30:00`,
  },
  {
    status: "posted",
    draftNo: 1,
    source: "Forbes",
    sourceUrl: "https://forbes.com",
    date: todayIso,
    title: "Why founders should post every day",
    hook: "I posted for 30 days straight. Here's what changed.",
    points: [
      "More inbound messages.",
      "Warmer outreach replies.",
      "Clearer positioning.",
    ],
    cta: "Follow along for the next 30.",
    seconds: 40,
    words: 101,
    postedAt: `${todayIso}T08:30:00`,
    postUrl:
      "https://www.linkedin.com/posts/founder_why-founders-should-post-every-day-activity-7000000000000000001-abcd",
    postDeleted: false,
  },
  {
    status: "posted",
    draftNo: 1,
    source: "TechCrunch",
    sourceUrl: "https://techcrunch.com",
    date: todayIso,
    title: "AI SDRs: hype or help?",
    hook: "I tested 4 AI SDR tools so you don't have to.",
    points: [
      "Two were great at research.",
      "One wrote good messages.",
      "None replaced human judgment.",
    ],
    cta: "Want my full notes? Comment below.",
    seconds: 44,
    words: 110,
    postedAt: `${todayIso}T08:30:00`,
    postUrl:
      "https://www.linkedin.com/posts/founder_ai-sdrs-hype-or-help-activity-7000000000000000002-deleted",
    postDeleted: false,
  },
];

function makeSeedLead(
  name: string,
  role: string,
  company: string,
  source: "engaged" | "buyer",
  status: "suggested" | "approved" | "pending" | "connected" | "skipped",
  reasonKind: "like" | "comment" | "view" | "fit",
  reason: string,
  extra: { sentAt?: string; connectedAt?: string; url?: string } = {},
) {
  return {
    name,
    role,
    company,
    source,
    status,
    reasonKind,
    reason,
    note: `Hi ${name.split(" ")[0]}, thanks for engaging with my content. Would love to stay in touch.`,
    ...extra,
  };
}

const DEFAULT_LEADS_SEED = [
  makeSeedLead(
    "Priya Nair",
    "Head of Sales",
    "Cloudwise",
    "engaged",
    "suggested",
    "comment",
    "Commented: “This is exactly what our team struggles with.”",
  ),
  makeSeedLead(
    "Daniel Ortiz",
    "VP Revenue",
    "Northbeam",
    "engaged",
    "suggested",
    "like",
    "Liked your last 3 posts",
  ),
  makeSeedLead(
    "Sara Lindqvist",
    "Sales Director",
    "Kinetic",
    "engaged",
    "approved",
    "comment",
    "Commented: “Would love to see the template.”",
  ),
  makeSeedLead(
    "Tom Becker",
    "RevOps Lead",
    "Flowdesk",
    "engaged",
    "suggested",
    "view",
    "Viewed your profile twice this week",
  ),
  makeSeedLead(
    "Aisha Khan",
    "CRO",
    "Stackly",
    "buyer",
    "suggested",
    "fit",
    "Matches your target: VP/Head of Sales, SaaS, 120 employees",
  ),
  makeSeedLead(
    "Marcus Webb",
    "VP Sales",
    "Pipeline.io",
    "buyer",
    "suggested",
    "fit",
    "Matches your target: VP Sales, SaaS, 300 employees",
  ),
  makeSeedLead(
    "Elena Rossi",
    "Head of Growth",
    "Brightly",
    "buyer",
    "approved",
    "fit",
    "Hiring 3 SDRs, a strong sign they need outbound",
  ),
  makeSeedLead(
    "Jonas Meyer",
    "Sales Director",
    "Lumen",
    "buyer",
    "suggested",
    "fit",
    "Matches your target: Sales Director, SaaS, 80 employees",
  ),
  makeSeedLead("Alex Rivera", "VP of Marketing", "StackGrowth", "buyer", "pending", "fit", "Matches target", {
    sentAt: todayIso,
  }),
  makeSeedLead("Nora Fields", "Head of Sales", "Vantage", "buyer", "pending", "fit", "Matches target", {
    sentAt: todayIso,
  }),
  makeSeedLead("Ben Carter", "Sales Director", "Orbit", "engaged", "pending", "like", "Liked a post", {
    sentAt: todayIso,
  }),
  makeSeedLead("Maya Singh", "VP Sales", "Helio", "buyer", "connected", "fit", "Matches target", {
    connectedAt: todayIso,
  }),
  makeSeedLead(
    "Chris Dunn",
    "RevOps Manager",
    "Atlas",
    "engaged",
    "connected",
    "comment",
    "Commented on a post",
    { connectedAt: todayIso },
  ),
];

export class LinkedinRepository {
  async getOrCreateConfig(organizationId: string) {
    const existing = await prisma.linkedinConfig.findUnique({
      where: { organizationId },
    });
    if (existing) return existing;

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    const initialOffer = org?.services?.length ? org.services.join(", ") : "I build AI agents for B2B SaaS outbound";
    const initialAudience = org?.targetTitles?.length ? `${org.targetTitles.join(", ")} at ${org?.targetIndustries?.join(", ") || "SaaS"}` : "Heads of Sales at SaaS companies with 50–500 people";
    const initialSuggestions = buildSuggestionsForNiche(initialOffer, initialAudience, {
      orgName: org?.name,
      services: org?.services,
      targetTitles: org?.targetTitles,
      targetIndustries: org?.targetIndustries,
    });
    const today = new Date().toISOString().slice(0, 10);

    return prisma.linkedinConfig.create({
      data: {
        organizationId,
        offer: initialOffer,
        audience: initialAudience,
        groundingFacts: {
          offer: initialOffer,
          audience: initialAudience,
        } as unknown as Prisma.InputJsonValue,
        latestScore: 84,
        latestReadAt: today,
        suggestions: initialSuggestions as unknown as Prisma.InputJsonValue,
        auditHistory: [
          {
            id: `audit_${Date.now()}`,
            profileUrl: "https://www.linkedin.com/in/me",
            offer: initialOffer,
            audience: initialAudience,
            score: 84,
            readAt: today,
            doneCount: 0,
            totalCount: 5,
            createdAt: new Date().toISOString(),
          },
        ] as unknown as Prisma.InputJsonValue,
        contentSources: DEFAULT_SOURCES as unknown as Prisma.InputJsonValue,
        strategyWho: initialAudience,
        strategyMessage: `Hi {first_name}, I saw your post on {topic}. At ${org?.name || "our team"}, we specialize in ${org?.services?.[0] || "outbound automation"}. Would love to connect and share insights.`,
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

  async ensureScriptsSeeded(organizationId: string) {
    const count = await prisma.linkedinScript.count({
      where: { organizationId },
    });
    if (count > 0) return;

    for (const s of DEFAULT_SCRIPTS_SEED) {
      await prisma.linkedinScript.create({
        data: {
          organizationId,
          ...s,
        },
      });
    }
  }

  async findScripts(organizationId: string) {
    await this.ensureScriptsSeeded(organizationId);
    return prisma.linkedinScript.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
  }

  async findScriptById(organizationId: string, id: string) {
    await this.ensureScriptsSeeded(organizationId);
    return prisma.linkedinScript.findFirst({
      where: { id, organizationId },
    });
  }

  async createScript(organizationId: string, data: Omit<Prisma.LinkedinScriptCreateInput, "organization">) {
    await this.ensureScriptsSeeded(organizationId);
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

  async ensureLeadsSeeded(organizationId: string) {
    const count = await prisma.linkedinLead.count({
      where: { organizationId },
    });
    if (count > 0) return;

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    const targetTitle = org?.targetTitles?.[0] || "VP Sales";
    const targetIndustry = org?.targetIndustries?.[0] || "B2B SaaS";
    const orgName = org?.name || "our team";

    const customizedLeads = DEFAULT_LEADS_SEED.map((lead) => {
      if (lead.source === "buyer") {
        return {
          ...lead,
          role: targetTitle,
          reason: `Matches your target: ${targetTitle}, ${targetIndustry}, 120 employees`,
          note: `Hi ${lead.name.split(" ")[0]}, I saw your work at ${lead.company}. At ${orgName}, we specialize in ${org?.services?.[0] || "outbound automation"}. Would love to connect.`,
        };
      }
      return lead;
    });

    for (const l of customizedLeads) {
      await prisma.linkedinLead.create({
        data: {
          organizationId,
          ...l,
        },
      });
    }
  }

  async findLeads(organizationId: string) {
    await this.ensureLeadsSeeded(organizationId);
    return prisma.linkedinLead.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
  }

  async findLeadById(organizationId: string, id: string) {
    await this.ensureLeadsSeeded(organizationId);
    return prisma.linkedinLead.findFirst({
      where: { id, organizationId },
    });
  }

  async createLead(organizationId: string, data: Omit<Prisma.LinkedinLeadCreateInput, "organization">) {
    await this.ensureLeadsSeeded(organizationId);
    return prisma.linkedinLead.create({
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

  async updateManyLeads(organizationId: string, ids: string[], data: Prisma.LinkedinLeadUpdateManyMutationInput) {
    return prisma.linkedinLead.updateMany({
      where: {
        organizationId,
        id: { in: ids },
      },
      data,
    });
  }
}

export const linkedinRepository = new LinkedinRepository();
