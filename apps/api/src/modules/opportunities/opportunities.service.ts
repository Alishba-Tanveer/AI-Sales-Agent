import { prisma, type Opportunity } from "@ai-sales-agent/database";
import { OpportunitiesRepository } from "./opportunities.repository";
import type { SearchOpportunitiesInput, SaveOpportunityInput } from "./opportunities.schema";
import { trackActivity } from "../activity/activity-logger";
import { tavilySearch } from "../../integrations/tavily";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";

export type OpportunityType = "client_project" | "job_posting" | "freelance";
export type OpportunityStatus = "open" | "saved" | "dismissed";

export type FormattedOpportunity = {
  id: string;
  title: string;
  company: string;
  type: OpportunityType;
  sourceId: string;
  sourceLabel: string;
  postedAt: string;
  relevance: number;
  signals: string;
  budget: string | null;
  location: string | null;
  url: string;
  status: OpportunityStatus;
  leadId: string | null;
};

export type SourceFailure = {
  sourceId: string;
  label: string;
  reason: string;
};

export type SearchResult = {
  items: FormattedOpportunity[];
  failures: SourceFailure[];
};

const SOURCE_LABELS: Record<string, string> = {
  jobicy: "Jobicy API",
  arbeitnow: "Arbeitnow API",
  remotive: "Remotive API",
  remoteok: "RemoteOK",
  weworkremotely: "We Work Remotely",
  company_sites: "Company website",
  sam_gov: "SAM.gov Contract Feed",
};

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function inferOpportunityType(title: string, description: string): OpportunityType {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes("freelance") || text.includes("part-time") || text.includes("gig")) {
    return "freelance";
  }
  if (text.includes("contract") || text.includes("project") || text.includes("consultant") || text.includes("rfp")) {
    return "client_project";
  }
  return "job_posting";
}

export class OpportunitiesService {
  constructor(private readonly opportunitiesRepository: OpportunitiesRepository) {}

  private calculateRelevance(
    title: string,
    signals: string,
    keywords: string[],
    orgServices: string[],
    baseRelevance: number = 65
  ): number {
    const combined = `${title} ${signals}`.toLowerCase();
    let score = baseRelevance;

    // Bonus for matching explicit search keywords
    for (const kw of keywords) {
      const lower = kw.toLowerCase().trim();
      if (!lower) continue;
      if (title.toLowerCase().includes(lower)) {
        score += 15;
      } else if (combined.includes(lower)) {
        score += 8;
      }
    }

    // Bonus for matching workspace services
    for (const s of orgServices) {
      const lower = s.toLowerCase().trim();
      if (!lower) continue;
      if (title.toLowerCase().includes(lower)) {
        score += 10;
      } else if (combined.includes(lower)) {
        score += 5;
      }
    }

    return Math.min(Math.max(score, 50), 99);
  }

  private getTimeLimitMs(postedWithin: "any" | "24h" | "7d" | "30d"): number {
    const H = 3_600_000;
    switch (postedWithin) {
      case "24h":
        return 24 * H;
      case "7d":
        return 7 * 24 * H;
      case "30d":
        return 30 * 24 * H;
      case "any":
      default:
        return Infinity;
    }
  }

  async searchOpportunities(organizationId: string, input: SearchOpportunitiesInput): Promise<SearchResult> {
    return trackActivity({
      organizationId,
      agent: "General Agent",
      kind: "discover",
      title: `Find opportunities: ${input.keywords.join(", ") || "All public sources"}`,
      context: `${input.sourceIds.length} sources (${input.postedWithin})`,
      run: async () => {
        const failures: SourceFailure[] = [];
        const foundItems: Array<{
          title: string;
          company: string;
          type: OpportunityType;
          sourceId: string;
          sourceLabel: string;
          postedAt: Date;
          relevance: number;
          signals: string;
          budget: string | null;
          location: string | null;
          url: string;
        }> = [];

        // 1. Fetch organization profile for personalized match scoring
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { services: true, description: true, targetIndustries: true },
        });
        const orgServices = org?.services ?? [];

        const now = Date.now();
        const timeLimitMs = this.getTimeLimitMs(input.postedWithin);

        // 2. Fetch live data from each requested public source
        for (const sourceId of input.sourceIds) {
          try {
            if (sourceId === "jobicy") {
              const res = await fetch("https://jobicy.com/api/v2/remote-jobs?count=25", {
                signal: AbortSignal.timeout(6_000),
                headers: { "User-Agent": "AI-Sales-Agent/1.0" },
              });
              if (!res.ok) throw new Error(`Jobicy responded with HTTP ${res.status}`);
              const data = (await res.json()) as { jobs?: Array<any> };
              if (data.jobs && Array.isArray(data.jobs)) {
                for (const j of data.jobs) {
                  const postedAt = j.pubDate ? new Date(j.pubDate) : new Date(now - 12 * 3600_000);
                  if (now - postedAt.getTime() > timeLimitMs) continue;
                  const cleanSignals = stripHtml(j.jobExcerpt || j.jobDescription || "").slice(0, 260);
                  const budget = j.annualSalaryMin && j.annualSalaryMax
                    ? `${j.salaryCurrency || "$"}${Math.round(j.annualSalaryMin / 1000)}k–${Math.round(j.annualSalaryMax / 1000)}k`
                    : null;
                  const title = j.jobTitle || "Remote Developer";
                  const rel = this.calculateRelevance(title, cleanSignals, input.keywords, orgServices, 65);
                  foundItems.push({
                    title,
                    company: j.companyName || "Client Partner",
                    type: inferOpportunityType(title, cleanSignals),
                    sourceId: "jobicy",
                    sourceLabel: SOURCE_LABELS.jobicy,
                    postedAt,
                    relevance: rel,
                    signals: cleanSignals || "Seeking technical engineering partner for systems integration.",
                    budget,
                    location: j.jobGeo || "Remote",
                    url: j.url || "https://jobicy.com",
                  });
                }
              }
            } else if (sourceId === "arbeitnow") {
              const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
                signal: AbortSignal.timeout(6_000),
              });
              if (!res.ok) throw new Error(`Arbeitnow responded with HTTP ${res.status}`);
              const data = (await res.json()) as { data?: Array<any> };
              if (data.data && Array.isArray(data.data)) {
                for (const j of data.data) {
                  const postedAt = j.created_at ? new Date(j.created_at * 1000) : new Date(now - 24 * 3600_000);
                  if (now - postedAt.getTime() > timeLimitMs) continue;
                  const cleanSignals = stripHtml(j.description || "").slice(0, 260);
                  const title = j.title || "Software Solutions Specialist";
                  const rel = this.calculateRelevance(title, cleanSignals, input.keywords, orgServices, 65);
                  foundItems.push({
                    title,
                    company: j.company_name || "Logistics Partner",
                    type: inferOpportunityType(title, cleanSignals),
                    sourceId: "arbeitnow",
                    sourceLabel: SOURCE_LABELS.arbeitnow,
                    postedAt,
                    relevance: rel,
                    signals: cleanSignals || "Contract engagement for deploying AI integration pipelines.",
                    budget: null,
                    location: j.location || "Remote",
                    url: j.url || "https://www.arbeitnow.com",
                  });
                }
              }
            } else if (sourceId === "remotive") {
              const res = await fetch("https://remotive.com/api/remote-jobs?limit=25", {
                signal: AbortSignal.timeout(6_000),
                headers: { "User-Agent": "AI-Sales-Agent/1.0" },
              });
              if (!res.ok) throw new Error(`Remotive responded with HTTP ${res.status}`);
              const data = (await res.json()) as { jobs?: Array<any> };
              if (data.jobs && Array.isArray(data.jobs)) {
                for (const j of data.jobs) {
                  const postedAt = j.publication_date ? new Date(j.publication_date) : new Date(now - 16 * 3600_000);
                  if (now - postedAt.getTime() > timeLimitMs) continue;
                  const cleanSignals = stripHtml(j.description || "").slice(0, 260);
                  const title = j.title || "Automation Specialist";
                  const rel = this.calculateRelevance(title, cleanSignals, input.keywords, orgServices, 65);
                  foundItems.push({
                    title,
                    company: j.company_name || "Client",
                    type: inferOpportunityType(title, cleanSignals),
                    sourceId: "remotive",
                    sourceLabel: SOURCE_LABELS.remotive,
                    postedAt,
                    relevance: rel,
                    signals: cleanSignals || "Looking for an implementation partner for workflows and automation.",
                    budget: j.salary || null,
                    location: j.candidate_required_location || "Remote",
                    url: j.url || "https://remotive.com",
                  });
                }
              }
            } else if (sourceId === "remoteok") {
              const res = await fetch("https://remoteok.com/api", {
                signal: AbortSignal.timeout(6_000),
                headers: { "User-Agent": "AI-Sales-Agent/1.0" },
              });
              if (!res.ok) throw new Error(`RemoteOK responded with HTTP ${res.status}`);
              const data = (await res.json()) as Array<any>;
              if (Array.isArray(data)) {
                for (const j of data.filter((item) => item && item.position)) {
                  const postedAt = j.date ? new Date(j.date) : new Date(now - 20 * 3600_000);
                  if (now - postedAt.getTime() > timeLimitMs) continue;
                  const cleanSignals = stripHtml(j.description || "").slice(0, 260);
                  const title = j.position || "AI & Automation Developer";
                  const rel = this.calculateRelevance(title, cleanSignals, input.keywords, orgServices, 65);
                  const budget = j.salary_min && j.salary_max
                    ? `$${Math.round(j.salary_min / 1000)}k–$${Math.round(j.salary_max / 1000)}k`
                    : null;
                  foundItems.push({
                    title,
                    company: j.company || "Technology Partner",
                    type: inferOpportunityType(title, cleanSignals),
                    sourceId: "remoteok",
                    sourceLabel: SOURCE_LABELS.remoteok,
                    postedAt,
                    relevance: rel,
                    signals: cleanSignals || "Hiring partner or specialist for remote system integrations.",
                    budget,
                    location: j.location || "Remote",
                    url: j.url || `https://remoteok.com/remote-jobs/${j.id}`,
                  });
                }
              }
            } else if (sourceId === "weworkremotely") {
              const res = await fetch("https://weworkremotely.com/categories/remote-programming-jobs.rss", {
                signal: AbortSignal.timeout(6_000),
                headers: { "User-Agent": "AI-Sales-Agent/1.0" },
              });
              if (!res.ok) throw new Error(`We Work Remotely responded with HTTP ${res.status}`);
              const text = await res.text();
              const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/gi);
              for (const match of itemMatches) {
                const itemContent = match[1];
                const rawTitle = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i);
                const titleText = (rawTitle?.[1] || rawTitle?.[2] || "").trim();
                const linkMatch = itemContent.match(/<link>(.*?)<\/link>/i);
                const linkText = (linkMatch?.[1] || "https://weworkremotely.com").trim();
                const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/i);
                const postedAt = pubDateMatch ? new Date(pubDateMatch[1]) : new Date(now - 24 * 3600_000);
                if (now - postedAt.getTime() > timeLimitMs) continue;
                const descMatch = itemContent.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/i);
                const cleanSignals = stripHtml(descMatch?.[1] || descMatch?.[2] || "").slice(0, 260);

                let company = "Client";
                let jobTitle = titleText;
                if (titleText.includes(":")) {
                  const parts = titleText.split(":");
                  company = parts[0].trim();
                  jobTitle = parts.slice(1).join(":").trim();
                }

                const rel = this.calculateRelevance(jobTitle, cleanSignals, input.keywords, orgServices, 65);
                foundItems.push({
                  title: jobTitle,
                  company,
                  type: inferOpportunityType(jobTitle, cleanSignals),
                  sourceId: "weworkremotely",
                  sourceLabel: SOURCE_LABELS.weworkremotely,
                  postedAt,
                  relevance: rel,
                  signals: cleanSignals || "Contract or remote opportunity posted on We Work Remotely.",
                  budget: null,
                  location: "Remote",
                  url: linkText,
                });
              }
            } else if (sourceId === "sam_gov") {
              if (env.TAVILY_API_KEY) {
                const query = `site:sam.gov ${input.keywords.join(" ")} "solicitation" OR "contract"`;
                const searchRes = await tavilySearch({ query, maxResults: 4 });
                for (const item of searchRes) {
                  const title = item.title.replace(/\|.*$/g, "").trim();
                  const rel = this.calculateRelevance(title, item.content, input.keywords, orgServices, 70);
                  foundItems.push({
                    title,
                    company: "Federal Agency (SAM.gov)",
                    type: "client_project",
                    sourceId: "sam_gov",
                    sourceLabel: SOURCE_LABELS.sam_gov,
                    postedAt: item.publishedDate ? new Date(item.publishedDate) : new Date(now - 48 * 3600_000),
                    relevance: rel,
                    signals: item.content.slice(0, 260),
                    budget: null,
                    location: "United States",
                    url: item.url,
                  });
                }
              } else {
                failures.push({
                  sourceId: "sam_gov",
                  label: SOURCE_LABELS.sam_gov,
                  reason: "SAM.gov live search requires TAVILY_API_KEY in .env",
                });
              }
            } else if (sourceId === "company_sites") {
              if (env.TAVILY_API_KEY) {
                const query = `${input.keywords.join(" ")} "request for proposal" OR "we are hiring" OR "looking for agency"`;
                const searchRes = await tavilySearch({ query, maxResults: 4 });
                for (const item of searchRes) {
                  const title = item.title.replace(/\|.*$/g, "").trim();
                  let company = "Company";
                  try {
                    const parsedUrl = new URL(item.url);
                    company = parsedUrl.hostname.replace(/^www\./, "");
                  } catch {}
                  const rel = this.calculateRelevance(title, item.content, input.keywords, orgServices, 70);
                  foundItems.push({
                    title,
                    company,
                    type: "client_project",
                    sourceId: "company_sites",
                    sourceLabel: SOURCE_LABELS.company_sites,
                    postedAt: item.publishedDate ? new Date(item.publishedDate) : new Date(now - 24 * 3600_000),
                    relevance: rel,
                    signals: item.content.slice(0, 260),
                    budget: null,
                    location: "Remote",
                    url: item.url,
                  });
                }
              } else {
                failures.push({
                  sourceId: "company_sites",
                  label: SOURCE_LABELS.company_sites,
                  reason: "Company sites live crawler requires TAVILY_API_KEY in .env",
                });
              }
            }
          } catch (error) {
            failures.push({
              sourceId,
              label: SOURCE_LABELS[sourceId] ?? sourceId,
              reason: error instanceof Error ? error.message : "Service temporarily unavailable",
            });
          }
        }

        // 3. Upsert discovered real opportunities into the database to persist user saves/dismissals
        const savedOpportunities: Opportunity[] = [];
        for (const item of foundItems) {
          const row = await this.opportunitiesRepository.upsertOpportunity({
            organizationId,
            title: item.title,
            company: item.company,
            type: item.type,
            sourceId: item.sourceId,
            sourceLabel: item.sourceLabel,
            postedAt: item.postedAt,
            relevance: item.relevance,
            signals: item.signals,
            budget: item.budget,
            location: item.location,
            url: item.url,
          });
          savedOpportunities.push(row);
        }

        // 4. Also load existing opportunities for this organization from DB
        const existingDbItems = await this.opportunitiesRepository.list(organizationId, {
          sourceIds: input.sourceIds,
          minRelevance: input.minRelevance,
          since: timeLimitMs !== Infinity ? new Date(now - timeLimitMs) : undefined,
        });

        // Merge DB rows (giving priority to items already in DB with user modifications)
        const mergedMap = new Map<string, Opportunity>();
        for (const opp of savedOpportunities) {
          mergedMap.set(opp.id, opp);
        }
        for (const opp of existingDbItems) {
          mergedMap.set(opp.id, opp);
        }

        // 5. Apply filters strictly to the real discovered data
        const keywordWords = input.keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
        const filteredItems = Array.from(mergedMap.values()).filter((o) => {
          if (!input.sourceIds.includes(o.sourceId)) return false;
          if (!input.types.includes(o.type as OpportunityType)) return false;
          if (o.relevance < input.minRelevance) return false;

          const text = `${o.title} ${o.signals} ${o.company}`.toLowerCase();
          const matchesKeyword =
            keywordWords.length === 0 ||
            keywordWords.some((w) => text.includes(w)) ||
            o.relevance >= 80;

          return matchesKeyword;
        });

        // Sort: highest relevance first, then newest
        filteredItems.sort((a, b) => b.relevance - a.relevance || b.postedAt.getTime() - a.postedAt.getTime());

        const items: FormattedOpportunity[] = filteredItems.map((o) => ({
          id: o.id,
          title: o.title,
          company: o.company,
          type: o.type as OpportunityType,
          sourceId: o.sourceId,
          sourceLabel: o.sourceLabel,
          postedAt: o.postedAt.toISOString(),
          relevance: o.relevance,
          signals: o.signals,
          budget: o.budget ?? null,
          location: o.location ?? null,
          url: o.url,
          status: o.status as OpportunityStatus,
          leadId: o.leadId ?? null,
        }));

        return {
          items,
          failures,
        };
      },
      output: (result) => `Found ${result.items.length} opportunities matching your criteria (${input.sourceIds.length} sources searched).`,
    });
  }

  async saveOpportunityAsLead(organizationId: string, id: string, input: SaveOpportunityInput) {
    const opp = await this.opportunitiesRepository.findById(organizationId, id);
    if (!opp) throw new AppError("Opportunity not found", 404);

    await this.opportunitiesRepository.updateStatus(organizationId, id, "saved", input.leadId);

    // Also create in-app notification for the workspace
    await prisma.inAppNotification.create({
      data: {
        organizationId,
        type: "lead",
        title: `Opportunity saved: ${opp.company}`,
        body: `"${opp.title}" from ${opp.sourceLabel} was saved to your Leads pipeline.`,
        read: false,
        href: `/leads?search=${encodeURIComponent(opp.company)}`,
      },
    }).catch(() => {});

    return {
      data: {
        id: opp.id,
        status: "saved" as const,
        leadId: input.leadId,
      },
    };
  }

  async setDismissed(organizationId: string, id: string, dismissed: boolean) {
    const opp = await this.opportunitiesRepository.findById(organizationId, id);
    if (!opp) throw new AppError("Opportunity not found", 404);

    const status = dismissed ? "dismissed" : "open";
    await this.opportunitiesRepository.updateStatus(organizationId, id, status);

    return {
      data: {
        id: opp.id,
        status,
      },
    };
  }

  async listOpportunities(organizationId: string) {
    const rows = await this.opportunitiesRepository.list(organizationId);
    return {
      data: rows.map((o) => ({
        id: o.id,
        title: o.title,
        company: o.company,
        type: o.type as OpportunityType,
        sourceId: o.sourceId,
        sourceLabel: o.sourceLabel,
        postedAt: o.postedAt.toISOString(),
        relevance: o.relevance,
        signals: o.signals,
        budget: o.budget,
        location: o.location,
        url: o.url,
        status: o.status as OpportunityStatus,
        leadId: o.leadId,
      })),
    };
  }
}
