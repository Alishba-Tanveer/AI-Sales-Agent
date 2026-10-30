import type { Opportunity, OpportunityType, SearchFilters, SearchResult } from "./types";
import { SOURCES } from "./constants";

const H = 3_600_000;

type Seed = Omit<Opportunity, "id" | "postedAt" | "status" | "leadId" | "sourceLabel" | "url"> & { hoursAgo: number };

const LABEL: Record<string, string> = {
  jobicy: "Jobicy API",
  arbeitnow: "Arbeitnow API",
  remotive: "Remotive API",
  remoteok: "RemoteOK",
  weworkremotely: "We Work Remotely",
  company_sites: "Company website",
  sam_gov: "SAM.gov Contract Feed",
};
const HOME: Record<string, string> = {
  jobicy: "https://jobicy.com",
  arbeitnow: "https://www.arbeitnow.com",
  remotive: "https://remotive.com",
  remoteok: "https://remoteok.com",
  weworkremotely: "https://weworkremotely.com",
  company_sites: "https://example.com",
  sam_gov: "https://sam.gov",
};

const SEEDS: Seed[] = [
  { title: "AI workflow automation developer", company: "BrightCart", type: "client_project", sourceId: "jobicy", relevance: 92, budget: "$40k–$60k", location: "Remote", hoursAgo: 3, signals: "Seeking enterprise partner to architect autonomous order routing and multi-channel inventory sync. Explicit urgency to deploy LLM-based exception handlers across the warehouse management stack." },
  { title: "Automated Lead Triage & CRM Routing Engine", company: "ClearRoute Inc.", type: "client_project", sourceId: "company_sites", relevance: 91, budget: null, location: "Remote (US)", hoursAgo: 4, signals: "Request for proposal to replace manual BDR lead grading with automated LangChain agents connecting HubSpot to Slack alerts." },
  { title: "Autonomous Customer Support & Agent Integration", company: "DentalSphere UK", type: "client_project", sourceId: "sam_gov", relevance: 88, budget: null, location: "United Kingdom", hoursAgo: 20, signals: "Published RFP for AI conversational triage to reduce emergency call load across 24 clinics. Looking to integrate Zendesk, a custom EHR and an appointment scheduling agent." },
  { title: "Enterprise Knowledge Base RAG Migration", company: "Vanguard Nordic", type: "client_project", sourceId: "remotive", relevance: 86, budget: "€30k–€45k", location: "Remote (EU)", hoursAgo: 27, signals: "Hiring contract implementation partner for Pinecone vector search integration across internal technical documentation." },
  { title: "Senior AI Solutions Architect (Contract)", company: "ShipEasy Logistics", type: "job_posting", sourceId: "arbeitnow", relevance: 84, budget: null, location: "Berlin / Remote", hoursAgo: 50, signals: "Contract position for a specialist to deploy document parsers and freight rate predictive matching. Mentions open budget for third-party agency engagement if talent delivery is rapid." },
  { title: "Voice agent for appointment booking", company: "Lumen Health", type: "freelance", sourceId: "remoteok", relevance: 83, budget: "$8k–$12k", location: "Remote", hoursAgo: 55, signals: "Wants a voice AI agent that books and reschedules patient appointments and syncs with their existing calendar system." },
  { title: "Zapier to custom agent migration", company: "Orbit Analytics", type: "freelance", sourceId: "weworkremotely", relevance: 81, budget: "$5k–$9k", location: "Remote", hoursAgo: 70, signals: "Outgrown Zapier flows for lead enrichment. Looking for someone to move them to a maintainable agent-based pipeline." },
  { title: "Custom LLM & Zapier/Make Automation Stack", company: "Apex Media Works", type: "freelance", sourceId: "jobicy", relevance: 79, budget: null, location: "Remote", hoursAgo: 78, signals: "Small marketing firm seeking a low-budget Zapier connection for blog post generation." },
  { title: "Invoice processing automation", company: "Marlow & Co", type: "client_project", sourceId: "company_sites", relevance: 77, budget: "$15k–$20k", location: "London", hoursAgo: 96, signals: "Procurement notice for automated invoice capture and approval routing into their ERP." },
  { title: "AI sales assistant for inbound leads", company: "Helix Freight", type: "client_project", sourceId: "remotive", relevance: 76, budget: null, location: "Remote (US)", hoursAgo: 120, signals: "Wants an assistant that qualifies inbound website leads and hands warm ones to the sales team." },
  { title: "Prompt engineer / automation consultant", company: "Kite Logistics", type: "job_posting", sourceId: "arbeitnow", relevance: 72, budget: null, location: "Amsterdam", hoursAgo: 160, signals: "Part-time consultant to review prompts and automation flows across support and operations." },
  { title: "Chatbot rebuild for member support", company: "Greenfield Energy", type: "freelance", sourceId: "remoteok", relevance: 68, budget: "$6k–$10k", location: "Remote", hoursAgo: 210, signals: "Existing rule-based chatbot is failing. Looking for an LLM-powered replacement with human handoff." },
  { title: "Data enrichment agent for outbound", company: "Solstice Solar", type: "client_project", sourceId: "jobicy", relevance: 64, budget: null, location: "Remote", hoursAgo: 300, signals: "Early mention of building an enrichment step before outbound campaigns; no budget or timeline given." },
];

/** Same shape the real API will return. Statuses are applied on top by the in-memory session in api.ts. */
export function buildMockOpportunities(now = Date.now()): Opportunity[] {
  return SEEDS.map(({ hoursAgo, ...s }, i) => ({
    ...s,
    id: `opp-${String(i + 1).padStart(3, "0")}`,
    sourceLabel: LABEL[s.sourceId] ?? s.sourceId,
    url: HOME[s.sourceId] ?? "https://example.com",
    postedAt: new Date(now - hoursAgo * H).toISOString(),
    status: i === 2 ? "saved" : i === 7 ? "dismissed" : "open",
    leadId: null,
  }));
}

/** Narrow the mock set the way the server would. */
export function filterMock(all: Opportunity[], f: SearchFilters, now = Date.now()): SearchResult {
  const words = f.keywords.map((k) => k.toLowerCase());
  const windowMs = { any: Infinity, "24h": 24 * H, "7d": 168 * H, "30d": 720 * H }[f.postedWithin];
  const items = all.filter((o) => {
    const text = `${o.title} ${o.signals}`.toLowerCase();
    return (
      f.sourceIds.includes(o.sourceId) &&
      f.types.includes(o.type as OpportunityType) &&
      o.relevance >= f.minRelevance &&
      now - new Date(o.postedAt).getTime() <= windowMs &&
      (words.length === 0 || words.some((w) => text.includes(w.split(" ")[0])) || o.relevance >= 85)
    );
  });
  // pretend one source is flaky when the person searches the registry, so the "partial results" state is reachable
  const failures = f.sourceIds.includes("sam_gov") && f.sourceIds.length > 3
    ? [{ sourceId: "sam_gov", label: "SAM.gov contracts", reason: "Timed out after 8s" }]
    : [];
  return { items: failures.length ? items.filter((o) => o.sourceId !== "sam_gov" || o.status === "saved") : items, failures };
}

export const sourceName = (id: string) => SOURCES.find((s) => s.id === id)?.label ?? id;
