import { prisma } from "@ai-sales-agent/database";
import { OpportunitiesRepository } from "./opportunities.repository";
import type { SearchOpportunitiesInput } from "./opportunities.schema";
import { trackActivity } from "../activity/activity-logger";
import { tavilySearch } from "../../integrations/tavily";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { findCompanyContact } from "../../integrations/contact-finder";
import { leadsService } from "../leads/leads.service";
import { buildExcerpt, matchesAnyKeyword, scoreOpportunity, stripHtml } from "./opportunities.scoring";

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

const MAX_TEXT_CHARS = 30_000;

const SOURCE_LABELS: Record<string, string> = {
  jobicy: "Jobicy API",
  arbeitnow: "Arbeitnow API",
  remotive: "Remotive API",
  remoteok: "RemoteOK",
  weworkremotely: "We Work Remotely",
  company_sites: "Company website",
  sam_gov: "SAM.gov Contract Feed",
};

/** A posting as read from a source, before it is scored. `description` is the full cleaned text. */
type Candidate = {
  title: string;
  company: string;
  type?: OpportunityType;
  sourceId: string;
  sourceLabel: string;
  postedAt: Date;
  description: string;
  fallbackSignals: string;
  budget: string | null;
  location: string | null;
  url: string;
};

const clean = (html: unknown) => stripHtml(String(html ?? "").slice(0, MAX_TEXT_CHARS));

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

function getTimeLimitMs(postedWithin: "any" | "24h" | "7d" | "30d"): number {
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

/* ───────────────────────── reading the portals ───────────────────────── */

type SourceRequest = { url: string; kind: "json" | "text" };
type SourceDef = {
  /** per request; Jobicy is often slow from some regions, so it gets longer */
  timeoutMs: number;
  /** extra tries after a timeout / network error / 5xx */
  retries: number;
  requests: (input: SearchOpportunitiesInput) => SourceRequest[];
  parse: (payload: any, now: number) => Candidate[];
};

const FRESH_MS = 10 * 60_000; // reuse a portal's answer for 10 minutes
const STALE_OK_MS = 6 * 3_600_000; // ...and if the portal is down, fall back to its last good answer for 6 hours
const cache = new Map<string, { at: number; items: Candidate[] }>();
const lastGood = new Map<string, { at: number; items: Candidate[] }>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const enc = encodeURIComponent;
const topKeywords = (input: SearchOpportunitiesInput) => input.keywords.map((k: string) => k.trim()).filter(Boolean);

function friendlyError(label: string, error: unknown): string {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return `${label} is taking too long to respond`;
  }
  return error instanceof Error ? error.message : "Service temporarily unavailable";
}

async function fetchOnce(label: string, req: SourceRequest, timeoutMs: number): Promise<any> {
  const res = await fetch(req.url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": "AI-Sales-Agent/1.0", Accept: req.kind === "json" ? "application/json" : "*/*" },
  });
  if (!res.ok) {
    const err = new Error(`${label} responded with HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return req.kind === "json" ? res.json() : res.text();
}

/** One request with retries. Client errors (4xx, apart from 429) are not retried. */
async function fetchWithRetry(label: string, req: SourceRequest, timeoutMs: number, retries: number): Promise<any> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchOnce(label, req, timeoutMs);
    } catch (error) {
      lastError = error;
      const status = (error as any)?.status as number | undefined;
      if (status && status >= 400 && status < 500 && status !== 429) break;
      if (attempt < retries) await sleep(500 * (attempt + 1));
    }
  }
  throw lastError;
}

const SOURCE_DEFS: Record<string, SourceDef> = {
  jobicy: {
    timeoutMs: 15_000,
    retries: 1,
    requests: (input) => [
      { url: "https://jobicy.com/api/v2/remote-jobs?count=50", kind: "json" },
      ...topKeywords(input).map((k: string) => ({ url: `https://jobicy.com/api/v2/remote-jobs?count=50&tag=${enc(k)}`, kind: "json" as const })),
    ],
    parse: (data: { jobs?: Array<any> }, now) =>
      (Array.isArray(data?.jobs) ? data.jobs : []).map((j) => ({
        title: String(j.jobTitle || "Remote Developer"),
        company: String(j.companyName || "Client Partner"),
        sourceId: "jobicy",
        sourceLabel: SOURCE_LABELS.jobicy,
        postedAt: j.pubDate ? new Date(j.pubDate) : new Date(now - 12 * 3600_000),
        description: clean(j.jobDescription || j.jobExcerpt),
        fallbackSignals: "Seeking technical engineering partner for systems integration.",
        budget:
          j.annualSalaryMin && j.annualSalaryMax
            ? `${j.salaryCurrency || "$"}${Math.round(j.annualSalaryMin / 1000)}k–${Math.round(j.annualSalaryMax / 1000)}k`
            : null,
        location: j.jobGeo || "Remote",
        url: j.url || "https://jobicy.com",
      })),
  },
  arbeitnow: {
    timeoutMs: 10_000,
    retries: 1,
    requests: () => [1, 2, 3].map((page) => ({ url: `https://www.arbeitnow.com/api/job-board-api?page=${page}`, kind: "json" as const })),
    parse: (data: { data?: Array<any> }, now) =>
      (Array.isArray(data?.data) ? data.data : []).map((j) => ({
        title: String(j.title || "Software Solutions Specialist"),
        company: String(j.company_name || "Logistics Partner"),
        sourceId: "arbeitnow",
        sourceLabel: SOURCE_LABELS.arbeitnow,
        postedAt: j.created_at ? new Date(j.created_at * 1000) : new Date(now - 24 * 3600_000),
        description: clean(j.description),
        fallbackSignals: "Contract engagement for deploying AI integration pipelines.",
        budget: null,
        location: j.location || "Remote",
        url: j.url || "https://www.arbeitnow.com",
      })),
  },
  remotive: {
    timeoutMs: 10_000,
    retries: 1,
    requests: (input) => [
      { url: "https://remotive.com/api/remote-jobs?limit=100", kind: "json" },
      ...topKeywords(input).map((k: string) => ({ url: `https://remotive.com/api/remote-jobs?search=${enc(k)}&limit=50`, kind: "json" as const })),
    ],
    parse: (data: { jobs?: Array<any> }, now) =>
      (Array.isArray(data?.jobs) ? data.jobs : []).map((j) => ({
        title: String(j.title || "Automation Specialist"),
        company: String(j.company_name || "Client"),
        sourceId: "remotive",
        sourceLabel: SOURCE_LABELS.remotive,
        postedAt: j.publication_date ? new Date(j.publication_date) : new Date(now - 16 * 3600_000),
        description: clean(j.description),
        fallbackSignals: "Looking for an implementation partner for workflows and automation.",
        budget: j.salary || null,
        location: j.candidate_required_location || "Remote",
        url: j.url || "https://remotive.com",
      })),
  },
  remoteok: {
    timeoutMs: 10_000,
    retries: 1,
    requests: () => [{ url: "https://remoteok.com/api", kind: "json" }],
    parse: (data: Array<any>, now) =>
      (Array.isArray(data) ? data.filter((item) => item && item.position) : []).map((j) => ({
        title: String(j.position || "AI & Automation Developer"),
        company: String(j.company || "Technology Partner"),
        sourceId: "remoteok",
        sourceLabel: SOURCE_LABELS.remoteok,
        postedAt: j.date ? new Date(j.date) : new Date(now - 20 * 3600_000),
        description: clean(j.description),
        fallbackSignals: "Hiring partner or specialist for remote system integrations.",
        budget: j.salary_min && j.salary_max ? `$${Math.round(j.salary_min / 1000)}k–$${Math.round(j.salary_max / 1000)}k` : null,
        location: j.location || "Remote",
        url: j.url || `https://remoteok.com/remote-jobs/${j.id}`,
      })),
  },
  weworkremotely: {
    timeoutMs: 10_000,
    retries: 1,
    requests: () =>
      [
        "https://weworkremotely.com/categories/remote-programming-jobs.rss",
        "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
        "https://weworkremotely.com/remote-jobs.rss",
      ].map((url) => ({ url, kind: "text" as const })),
    parse: (text: string, now) => {
      const out: Candidate[] = [];
      for (const match of String(text).matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
        const itemContent = match[1];
        const rawTitle = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i);
        const titleText = stripHtml(rawTitle?.[1] || rawTitle?.[2] || "");
        const linkMatch = itemContent.match(/<link>(.*?)<\/link>/i);
        const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/i);
        const descMatch = itemContent.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/i);

        let company = "Client";
        let jobTitle = titleText;
        if (titleText.includes(":")) {
          const parts = titleText.split(":");
          company = parts[0].trim();
          jobTitle = parts.slice(1).join(":").trim();
        }
        out.push({
          title: jobTitle,
          company,
          sourceId: "weworkremotely",
          sourceLabel: SOURCE_LABELS.weworkremotely,
          postedAt: pubDateMatch ? new Date(pubDateMatch[1]) : new Date(now - 24 * 3600_000),
          description: clean(descMatch?.[1] || descMatch?.[2] || ""),
          fallbackSignals: "Contract or remote opportunity posted on We Work Remotely.",
          budget: null,
          location: "Remote",
          url: (linkMatch?.[1] || "https://weworkremotely.com").trim(),
        });
      }
      return out;
    },
  },
};

/** Searches the web (Tavily) for SAM.gov solicitations or company "we are hiring / RFP" pages. */
async function fetchTavilySource(sourceId: "sam_gov" | "company_sites", input: SearchOpportunitiesInput, now: number): Promise<Candidate[]> {
  const label = SOURCE_LABELS[sourceId];
  if (!env.TAVILY_API_KEY) {
    throw new Error(sourceId === "sam_gov" ? "SAM.gov live search requires TAVILY_API_KEY in .env" : "Company sites live crawler requires TAVILY_API_KEY in .env");
  }
  const query =
    sourceId === "sam_gov"
      ? `site:sam.gov ${input.keywords.join(" ")} "solicitation" OR "contract"`
      : `${input.keywords.join(" ")} "request for proposal" OR "we are hiring" OR "looking for agency"`;
  const results = await tavilySearch({ query, maxResults: 4 });
  return results.map((item) => {
    let company = sourceId === "sam_gov" ? "Federal Agency (SAM.gov)" : "Company";
    if (sourceId === "company_sites") {
      try {
        company = new URL(item.url).hostname.replace(/^www\./, "");
      } catch {
        /* keep the default */
      }
    }
    return {
      title: stripHtml(item.title.replace(/\|.*$/g, "")),
      company,
      type: "client_project" as const,
      sourceId,
      sourceLabel: label,
      postedAt: item.publishedDate ? new Date(item.publishedDate) : new Date(now - (sourceId === "sam_gov" ? 48 : 24) * 3600_000),
      description: clean(item.content),
      fallbackSignals: "",
      budget: null,
      location: sourceId === "sam_gov" ? "United States" : "Remote",
      url: item.url,
    };
  });
}

/**
 * Reads one source. All of its requests (general feed plus one per keyword, extra pages...) run at the same time and
 * the source counts as working when at least one answers. Answers are cached for a few minutes, so repeated searches do
 * not hammer a portal, and when a portal is down its last good answer is used instead of failing the whole search.
 */
async function fetchSource(sourceId: string, input: SearchOpportunitiesInput, now: number): Promise<Candidate[]> {
  if (sourceId === "sam_gov" || sourceId === "company_sites") return fetchTavilySource(sourceId, input, now);

  const def = SOURCE_DEFS[sourceId];
  if (!def) return [];
  const label = SOURCE_LABELS[sourceId] ?? sourceId;

  const requests = def.requests(input);
  const cacheKey = `${sourceId}|${requests.map((r) => r.url).join("|")}`;
  const hit = cache.get(cacheKey);
  if (hit && now - hit.at < FRESH_MS) return hit.items;

  const settled = await Promise.allSettled(requests.map((r) => fetchWithRetry(label, r, def.timeoutMs, def.retries)));
  const ok = settled.filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled");

  if (ok.length === 0) {
    const stale = lastGood.get(sourceId);
    if (stale && now - stale.at < STALE_OK_MS) return stale.items; // portal is down: serve what we last got
    const first = settled.find((r): r is PromiseRejectedResult => r.status === "rejected");
    throw new Error(friendlyError(label, first?.reason));
  }

  const seen = new Set<string>();
  const items: Candidate[] = [];
  for (const r of ok) {
    for (const c of def.parse(r.value, now)) {
      const key = c.url || `${c.title}|${c.company}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(c);
    }
  }
  const entry = { at: now, items };
  cache.set(cacheKey, entry);
  lastGood.set(sourceId, entry);
  return items;
}

function formatRow(o: {
  id: string;
  title: string;
  company: string;
  type: string;
  sourceId: string;
  sourceLabel: string;
  postedAt: Date;
  relevance: number;
  signals: string;
  budget: string | null;
  location: string | null;
  url: string;
  status: string;
  leadId: string | null;
}): FormattedOpportunity {
  return {
    id: o.id,
    title: o.title,
    company: o.company,
    type: o.type as OpportunityType,
    sourceId: o.sourceId,
    sourceLabel: o.sourceLabel,
    postedAt: o.postedAt.toISOString(),
    relevance: o.relevance,
    // rows saved by older versions can still hold raw HTML; show clean text either way
    signals: stripHtml(o.signals),
    budget: o.budget ?? null,
    location: o.location ?? null,
    url: o.url,
    status: o.status as OpportunityStatus,
    leadId: o.leadId ?? null,
  };
}

export class OpportunitiesService {
  constructor(private readonly opportunitiesRepository: OpportunitiesRepository) {}

  async searchOpportunities(organizationId: string, input: SearchOpportunitiesInput): Promise<SearchResult> {
    return trackActivity({
      organizationId,
      agent: "General Agent",
      kind: "discover",
      title: `Find opportunities: ${input.keywords.join(", ") || "All public sources"}`,
      context: `${input.sourceIds.length} sources (${input.postedWithin})`,
      run: async () => {
        // 1. Workspace profile, used for personalised match scoring
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { services: true },
        });
        const orgServices = org?.services ?? [];

        const now = Date.now();
        const timeLimitMs = getTimeLimitMs(input.postedWithin);

        // 2. Read every selected source at the same time, so one slow portal no longer holds up the rest
        const sourceIds = Array.from(new Set<string>(input.sourceIds));
        const settled = await Promise.allSettled(sourceIds.map((id) => fetchSource(id, input, now)));

        const failures: SourceFailure[] = [];
        const candidates: Candidate[] = [];
        let succeeded = 0;
        settled.forEach((r, i) => {
          if (r.status === "fulfilled") {
            succeeded++;
            candidates.push(...r.value);
          } else {
            failures.push({
              sourceId: sourceIds[i],
              label: SOURCE_LABELS[sourceIds[i]] ?? sourceIds[i],
              reason: friendlyError(SOURCE_LABELS[sourceIds[i]] ?? sourceIds[i], r.reason),
            });
          }
        });

        // 3. Score every posting on its own merits and keep only the real matches
        const seen = new Set<string>();
        const matches: Array<Candidate & { type: OpportunityType; relevance: number; signals: string }> = [];
        for (const c of candidates) {
          if (!Number.isFinite(c.postedAt.getTime()) || c.postedAt.getTime() > now) continue;
          if (now - c.postedAt.getTime() > timeLimitMs) continue;

          const type = c.type ?? inferOpportunityType(c.title, c.description);
          if (!input.types.includes(type)) continue;
          if (!matchesAnyKeyword(input.keywords, c.title, c.description)) continue;

          const { score } = scoreOpportunity({
            title: c.title,
            body: c.description,
            keywords: input.keywords,
            services: orgServices,
            postedAt: c.postedAt,
            hasBudget: !!c.budget,
            now,
          });
          if (score < input.minRelevance) continue;

          const key = c.url || `${c.title}|${c.company}`;
          const altKey = `${c.title.toLowerCase()}|${c.company.toLowerCase()}`;
          if (seen.has(key) || seen.has(altKey)) continue;
          seen.add(key);
          seen.add(altKey);

          matches.push({
            ...c,
            type,
            relevance: score,
            signals: buildExcerpt(c.description, input.keywords) || c.fallbackSignals,
          });
        }

        matches.sort((a, b) => b.relevance - a.relevance || b.postedAt.getTime() - a.postedAt.getTime());
        const best = matches;

        // 4. Store only those matches (a few at a time) so saves and dismissals persist and teammates see the same list
        const keepIds: string[] = [];
        const resultRows: Awaited<ReturnType<OpportunitiesRepository["upsertOpportunity"]>>[] = [];
        for (let i = 0; i < best.length; i += 10) {
          const rows = await Promise.all(
            best.slice(i, i + 10).map((item) =>
              this.opportunitiesRepository.upsertOpportunity({
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
              }),
            ),
          );
          keepIds.push(...rows.map((r) => r.id));
          resultRows.push(...rows);
        }

        // 5. This search replaces the previous untouched results. Saved and dismissed ones always stay.
        //    Skipped when every source failed, so a network blip never empties the list.
        if (succeeded > 0) {
          await this.opportunitiesRepository.deleteOpenExcept(organizationId, keepIds);
        }

        return { items: resultRows.map(formatRow), failures };
      },
      output: (result) => `Found ${result.items.length} opportunities matching your criteria (${input.sourceIds.length} sources searched).`,
    });
  }

  /**
   * Turns an opportunity into a lead, but only when the company can actually be contacted.
   * The email / LinkedIn is read from the company's website (and the posting itself). If neither can be found nothing is
   * created and the person is told why, so the pipeline never fills up with leads nobody can reach.
   */
  async saveOpportunityAsLead(organizationId: string, id: string) {
    const opp = await this.opportunitiesRepository.findById(organizationId, id);
    if (!opp) throw new AppError("Opportunity not found", 404);

    // already saved: hand back the lead that exists
    if (opp.leadId) {
      const existing = await prisma.lead.findFirst({ where: { id: opp.leadId, organizationId, archivedAt: null } });
      if (existing) return { data: { id: opp.id, status: "saved" as const, leadId: existing.id } };
    }

    const contact = await findCompanyContact({ company: opp.company, urls: [opp.url] });
    // This lead represents the company, so never attach an individual's /in/ profile
    // as if it were the company's LinkedIn page.
    const companyLinkedinUrl = contact.linkedinUrl && /linkedin\.com\/company\//i.test(contact.linkedinUrl)
      ? contact.linkedinUrl
      : null;
    if (!contact.email && !companyLinkedinUrl) {
      throw new AppError(
        `${opp.company} doesn't have an email or LinkedIn on its website, so it can't be contacted and wasn't added to Leads.`,
        422,
        { code: "NO_CONTACT" },
      );
    }

    const lead = await leadsService.create(organizationId, {
      name: opp.company,
      company: opp.company,
      source: `Find Opportunities: ${opp.sourceLabel}`,
      email: contact.email ?? undefined,
      linkedinUrl: companyLinkedinUrl ?? undefined,
      websiteUrl: contact.websiteUrl ?? opp.url,
      notes: `${opp.title}${opp.budget ? ` (${opp.budget})` : ""}\n\n${opp.signals}`,
    });

    await this.opportunitiesRepository.updateStatus(organizationId, id, "saved", lead.id);

    await prisma.inAppNotification.create({
      data: {
        organizationId,
        type: "lead",
        title: `Opportunity saved: ${opp.company}`,
        body: `"${opp.title}" from ${opp.sourceLabel} was saved to your Leads pipeline.`,
        read: false,
        href: `/leads/${lead.id}`,
      },
    }).catch(() => {});

    return { data: { id: opp.id, status: "saved" as const, leadId: lead.id } };
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

  /**
   * Permanently removes a search result for the whole team. A lead that was already created from it stays in Leads.
   * A later search can find the same posting again; it will then show up as a fresh, unactioned result.
   */
  async deleteOpportunity(organizationId: string, id: string) {
    const opp = await this.opportunitiesRepository.findById(organizationId, id);
    if (!opp) throw new AppError("Opportunity not found", 404);
    await this.opportunitiesRepository.deleteById(organizationId, id);
    return { data: { id: opp.id, deleted: true as const } };
  }

  async listOpportunities(organizationId: string) {
    const rows = await this.opportunitiesRepository.list(organizationId);
    return { data: rows.map(formatRow) };
  }
}
