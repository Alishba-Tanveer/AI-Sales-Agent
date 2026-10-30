import type { OpportunitySource, OpportunityType, PostedWithin, SearchFilters, SourceGroup } from "./types";

/** Public sources only. About five job portals, plus company pages and public registries. */
export const SOURCES: OpportunitySource[] = [
  { id: "jobicy", label: "Jobicy", group: "job_portal" },
  { id: "arbeitnow", label: "Arbeitnow", group: "job_portal" },
  { id: "remotive", label: "Remotive", group: "job_portal" },
  { id: "remoteok", label: "RemoteOK", group: "job_portal" },
  { id: "weworkremotely", label: "We Work Remotely", group: "job_portal" },
  { id: "company_sites", label: "Company websites", group: "company_site" },
  { id: "sam_gov", label: "SAM.gov contracts", group: "registry" },
];

export const SOURCE_GROUP_LABEL: Record<SourceGroup, string> = {
  job_portal: "Job portals",
  company_site: "Company pages",
  registry: "Public registries",
};

/** One hue per type and per source group, used for chips, card accents and filter pills. */
export const TYPE_META: Record<OpportunityType, { label: string; color: string }> = {
  client_project: { label: "Client project", color: "#818CF8" },
  job_posting: { label: "Job posting", color: "#FBBF24" },
  freelance: { label: "Freelance", color: "#34D399" },
};

export const SOURCE_GROUP_COLOR: Record<SourceGroup, string> = {
  job_portal: "#38BDF8",
  company_site: "#A78BFA",
  registry: "#F472B6",
};

export const TYPE_ORDER: OpportunityType[] = ["client_project", "freelance", "job_posting"];

export const POSTED_OPTIONS: { value: PostedWithin; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

export const KEYWORD_SUGGESTIONS = ["AI agents", "Workflow automation", "CRM integration", "Chatbot", "RAG"];

export const DEFAULT_FILTERS: SearchFilters = {
  keywords: ["AI agents", "automation"],
  sourceIds: SOURCES.filter((s) => s.group === "job_portal").map((s) => s.id),
  types: [...TYPE_ORDER],
  minRelevance: 75,
  postedWithin: "30d",
};

/** Opportunities scoring at least this get a "Top match" label. */
export const TOP_MATCH = 85;
