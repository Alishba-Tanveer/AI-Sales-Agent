/** What kind of opportunity this is. */
export type OpportunityType = "client_project" | "job_posting" | "freelance";

/** open = not acted on yet. saved = turned into a lead. dismissed = hidden from the working list (can be restored). */
export type OpportunityStatus = "open" | "saved" | "dismissed";

export type SourceGroup = "job_portal" | "company_site" | "registry";

/** A public, permitted place the agent can read opportunities from. LinkedIn is NOT a source here (it has its own pages). */
export type OpportunitySource = {
  id: string;
  label: string;
  group: SourceGroup;
};

export type SortKey = "relevance" | "newest" | "company";

export type PostedWithin = "any" | "24h" | "7d" | "30d";

/** What the person picks in the filter panel. Sent to POST /api/opportunities/search. */
export type SearchFilters = {
  keywords: string[];
  sourceIds: string[];
  types: OpportunityType[];
  /** 0-100. Opportunities scoring lower are left out. */
  minRelevance: number;
  postedWithin: PostedWithin;
};

/**
 * One opportunity the agent found.
 * POST /api/opportunities/search returns these, best match first.
 */
export type Opportunity = {
  id: string;
  /** "AI workflow automation developer" */
  title: string;
  company: string;
  type: OpportunityType;
  sourceId: string;
  /** Display name of the source, e.g. "Jobicy API". */
  sourceLabel: string;
  /** ISO. When the source published it. */
  postedAt: string;
  /** 0-100 fit with the workspace's niche / ICP. */
  relevance: number;
  /** Short text the agent extracted: what they want, urgency, tools mentioned. */
  signals: string;
  /** Budget if the posting states one, e.g. "$40k–$60k". */
  budget: string | null;
  location: string | null;
  /** Link to the original posting on the source's own site. */
  url: string;
  status: OpportunityStatus;
  /** Set once saved as a lead, so the page can link to it. */
  leadId: string | null;
};

/** A source that failed during a search (timeout, rate limit...). */
export type SourceFailure = { sourceId: string; label: string; reason: string };

export type SearchResult = {
  items: Opportunity[];
  failures: SourceFailure[];
};
