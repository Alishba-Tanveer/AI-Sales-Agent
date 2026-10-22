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

export function buildSuggestionsForNiche(
  offer: string,
  audience: string,
  currentSections?: Partial<Record<SuggestionKey, string>>,
): ProfileSuggestionItem[] {
  const cleanOffer = offer.trim() || "I build AI agents for B2B SaaS outbound";
  const cleanAudience = audience.trim() || "B2B SaaS teams";
  const isDefaultNiche =
    cleanOffer.toLowerCase() === "i build AI agents for b2b saas outbound".toLowerCase() &&
    (!audience.trim() || cleanAudience.toLowerCase().includes("saas"));

  return [
    {
      id: "rec_headline",
      key: "headline",
      title: "Headline",
      section: "intro",
      current: currentSections?.headline || "Sales Consultant | Helping businesses grow",
      suggested: isDefaultNiche
        ? "I build AI agents that book qualified meetings for B2B SaaS teams | Founder, outbound automation"
        : `${cleanOffer} for ${cleanAudience} | Book qualified pipeline on autopilot`,
      why: "Your niche is AI outbound for SaaS. A headline that names who you help and the result shows up in more searches and tells visitors what you do in one line.",
      done: false,
      status: "pending",
    },
    {
      id: "rec_about",
      key: "about",
      title: "About Summary",
      section: "about",
      current:
        currentSections?.about ||
        "Experienced professional with a passion for sales and technology. Looking for new opportunities.",
      suggested: isDefaultNiche
        ? "SaaS teams lose pipeline because outbound is slow and inconsistent. I build AI agents that research prospects, write personal messages and follow up, so your reps only talk to people who replied.\n\nWhat I do:\n• Set up AI outbound for B2B SaaS\n• Keep every message on your tone and rules\n• Report on replies and meetings, not vanity numbers\n\nWant to see how it works? Send me a message."
        : `${cleanAudience} lose pipeline when outbound is slow and manual. ${cleanOffer} that research prospects, write personal messages and follow up automatically.\n\nWhat I do:\n• Tailored outbound built for ${cleanAudience}\n• Keep every message on your tone and rules\n• Report on replies and meetings, not vanity numbers\n\nWant to see how it works? Send me a message.`,
      why: "The summary now opens with your buyer's problem, shows what you offer, and ends with one clear next step.",
      done: false,
      status: "pending",
    },
    {
      id: "rec_experience",
      key: "experience",
      title: "Experience wording",
      section: "experience",
      current:
        currentSections?.experience ||
        "Responsible for managing sales processes and supporting the team.",
      suggested:
        "Built an AI outbound system that cut manual prospecting by 70% and raised reply rates from 3% to 11% across 4 SaaS clients.",
      why: "Results with numbers are more convincing than a list of duties. Replace the sample numbers with your real ones.",
      done: false,
      status: "pending",
    },
    {
      id: "rec_skills",
      key: "skills",
      title: "Skills",
      section: "skills",
      current: currentSections?.skills || "Sales, Marketing, Communication",
      suggested: "AI Agents, Outbound Sales, B2B SaaS, Lead Generation, Sales Automation",
      why: "Recruiters and buyers search by skill. These five match your niche and replace broad words.",
      done: false,
      status: "pending",
    },
    {
      id: "rec_featured",
      key: "featured",
      title: "Featured / CTA",
      section: "featured",
      current: currentSections?.featured || "Nothing featured yet.",
      suggested: "Pin a short demo video of your AI agent and a link to book a call.",
      why: "The Featured area is the first thing under your summary. It is the easiest place to turn a visit into a conversation.",
      done: false,
      status: "pending",
    },
  ];
}

const DEFAULT_SCRIPTS_SEED = [
  {
    status: "needs_approval",
    draftNo: 1,
    source: "TechCrunch",
    sourceUrl: "https://techcrunch.com",
    date: "2026-10-21",
    title: "Why AI agents are replacing the first sales call",
    hook: "Most buyers now talk to an AI before they ever talk to your rep.",
    points: [
      "Three SaaS companies moved first-touch outreach to AI agents this quarter.",
      "Reply rates went up because messages were researched, not templated.",
      "Reps now only join once a buyer has said yes.",
    ],
    cta: "Follow me for one practical AI sales tip every day.",
    seconds: 45,
    words: 112,
  },
  {
    status: "needs_approval",
    draftNo: 1,
    source: "Reuters",
    sourceUrl: "https://reuters.com",
    date: "2026-10-21",
    title: "B2B buyers want fewer, better messages",
    hook: "Your prospects get 40 cold messages a week. Here is how to be the one they answer.",
    points: [
      "Short messages beat long ones.",
      "Mention something specific about their company.",
      "Ask one simple question.",
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
    date: "2026-10-20",
    title: "The new rules of LinkedIn outreach",
    hook: "LinkedIn just changed what counts as spam. Do this instead.",
    points: [
      "Limit requests per day.",
      "Personalise the first line.",
      "Follow up once, not five times.",
    ],
    cta: "Save this post and check your own outreach today.",
    seconds: 41,
    words: 104,
  },
  {
    status: "creating_video",
    draftNo: 1,
    source: "Reuters",
    sourceUrl: "https://reuters.com",
    date: "2026-10-20",
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
    scheduledFor: "2026-10-22T08:30:00",
  },
  {
    status: "ready",
    draftNo: 1,
    source: "TechCrunch",
    sourceUrl: "https://techcrunch.com",
    date: "2026-10-19",
    title: "Three signs a lead is ready to buy",
    hook: "Stop chasing everyone. Watch for these three signals.",
    points: [
      "They visit pricing twice.",
      "They ask about onboarding.",
      "They bring in a colleague.",
    ],
    cta: "Which signal do you see most? Tell me below.",
    seconds: 42,
    words: 108,
    scheduledFor: "2026-10-23T08:30:00",
  },
  {
    status: "posted",
    draftNo: 1,
    source: "Forbes",
    sourceUrl: "https://forbes.com",
    date: "2026-10-18",
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
    postedAt: "2026-10-18T08:30:00",
    postUrl:
      "https://www.linkedin.com/posts/ahmed_why-founders-should-post-every-day-activity-7000000000000000001-abcd",
    postDeleted: false,
  },
  {
    status: "posted",
    draftNo: 1,
    source: "TechCrunch",
    sourceUrl: "https://techcrunch.com",
    date: "2026-10-17",
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
    postedAt: "2026-10-17T08:30:00",
    postUrl:
      "https://www.linkedin.com/posts/ahmed_ai-sdrs-hype-or-help-activity-7000000000000000002-deleted",
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
    sentAt: "2026-10-12",
  }),
  makeSeedLead("Nora Fields", "Head of Sales", "Vantage", "buyer", "pending", "fit", "Matches target", {
    sentAt: "2026-10-14",
  }),
  makeSeedLead("Ben Carter", "Sales Director", "Orbit", "engaged", "pending", "like", "Liked a post", {
    sentAt: "2026-10-15",
  }),
  makeSeedLead("Maya Singh", "VP Sales", "Helio", "buyer", "connected", "fit", "Matches target", {
    connectedAt: "2026-10-09",
  }),
  makeSeedLead(
    "Chris Dunn",
    "RevOps Manager",
    "Atlas",
    "engaged",
    "connected",
    "comment",
    "Commented on a post",
    { connectedAt: "2026-10-05" },
  ),
];

export class LinkedinRepository {
  async getOrCreateConfig(organizationId: string) {
    const existing = await prisma.linkedinConfig.findUnique({
      where: { organizationId },
    });
    if (existing) return existing;

    const initialSuggestions = buildSuggestionsForNiche("I build AI agents for B2B SaaS outbound", "");
    const today = new Date().toISOString().slice(0, 10);

    return prisma.linkedinConfig.create({
      data: {
        organizationId,
        offer: "I build AI agents for B2B SaaS outbound",
        audience: "",
        groundingFacts: {
          offer: "I build AI agents for B2B SaaS outbound",
          audience: "Heads of Sales at SaaS companies with 50–500 people",
        } as unknown as Prisma.InputJsonValue,
        latestScore: 84,
        latestReadAt: today,
        suggestions: initialSuggestions as unknown as Prisma.InputJsonValue,
        auditHistory: [
          {
            id: `audit_${Date.now()}`,
            profileUrl: "https://www.linkedin.com/in/ahmed-khan",
            offer: "I build AI agents for B2B SaaS outbound",
            audience: "Heads of Sales at SaaS companies with 50–500 people",
            score: 84,
            readAt: today,
            doneCount: 0,
            totalCount: 5,
            createdAt: new Date().toISOString(),
          },
        ] as unknown as Prisma.InputJsonValue,
        contentSources: DEFAULT_SOURCES as unknown as Prisma.InputJsonValue,
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

    for (const l of DEFAULT_LEADS_SEED) {
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
