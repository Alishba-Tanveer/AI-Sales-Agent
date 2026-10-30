import { api } from "@/lib/api";
import { createLead } from "@/features/leads/api";
import { buildMockOpportunities, filterMock } from "./mock-data";
import type { Opportunity, SearchFilters, SearchResult } from "./types";

/**
 * The opportunities backend module is still empty, so this page runs on mock data.
 * Flip to `false` once the endpoints below exist. Nothing else in the page changes.
 */
const USE_MOCK = true;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** In-memory session for mock mode, so dismiss / restore / save survive a re-search until the page is reloaded. */
let session: Opportunity[] | null = null;
const mock = () => (session ??= buildMockOpportunities());

/** POST /api/opportunities/search  -> opportunities matching the filters + any sources that failed */
export async function searchOpportunities(filters: SearchFilters): Promise<SearchResult> {
  if (USE_MOCK) {
    await wait(900);
    return filterMock(mock(), filters);
  }
  const res = await api<{ data: SearchResult }>("/api/opportunities/search", { method: "POST", body: JSON.stringify(filters) });
  return res.data;
}

/**
 * Save as Lead. Creates a lead in the shared pipeline (stage New) and marks the opportunity saved.
 * A posting has a company, not a person, so the company becomes the lead name until enrichment finds a contact.
 * POST /api/leads (existing). The backend should also store the opportunity -> lead link.
 */
export async function saveOpportunityAsLead(o: Opportunity): Promise<{ leadId: string }> {
  const lead = await createLead({
    name: o.company,
    company: o.company,
    source: `Find Opportunities: ${o.sourceLabel}`,
    websiteUrl: o.url,
    notes: `${o.title}${o.budget ? ` (${o.budget})` : ""}\n\n${o.signals}`,
  });
  if (USE_MOCK) {
    session = mock().map((x) => (x.id === o.id ? { ...x, status: "saved", leadId: lead.id } : x));
  } else {
    await api(`/api/opportunities/${o.id}/saved`, { method: "POST", body: JSON.stringify({ leadId: lead.id }) });
  }
  return { leadId: lead.id };
}

/** POST /api/opportunities/:id/dismiss and /restore */
export async function setDismissed(o: Opportunity, dismissed: boolean): Promise<void> {
  if (USE_MOCK) {
    await wait(250);
    session = mock().map((x) => (x.id === o.id ? { ...x, status: dismissed ? "dismissed" : "open" } : x));
    return;
  }
  await api(`/api/opportunities/${o.id}/${dismissed ? "dismiss" : "restore"}`, { method: "POST" });
}
