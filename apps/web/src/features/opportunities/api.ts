import { api } from "@/lib/api";
import { createLead } from "@/features/leads/api";
import type { Opportunity, SearchFilters, SearchResult } from "./types";

/** POST /api/opportunities/search -> opportunities matching the filters + any sources that failed */
export async function searchOpportunities(filters: SearchFilters): Promise<SearchResult> {
  const res = await api<{ data: SearchResult }>("/api/opportunities/search", {
    method: "POST",
    body: JSON.stringify(filters),
  });
  return res.data;
}

/**
 * Save as Lead. Creates a lead in the shared pipeline (stage New) and marks the opportunity saved.
 * A posting has a company, not a person, so the company becomes the lead name until enrichment finds a contact.
 */
export async function saveOpportunityAsLead(o: Opportunity): Promise<{ leadId: string }> {
  const lead = await createLead({
    name: o.company,
    company: o.company,
    source: `Find Opportunities: ${o.sourceLabel}`,
    websiteUrl: o.url,
    notes: `${o.title}${o.budget ? ` (${o.budget})` : ""}\n\n${o.signals}`,
  });
  await api(`/api/opportunities/${o.id}/saved`, {
    method: "POST",
    body: JSON.stringify({ leadId: lead.id }),
  });
  return { leadId: lead.id };
}

/** POST /api/opportunities/:id/dismiss and /restore */
export async function setDismissed(o: Opportunity, dismissed: boolean): Promise<void> {
  await api(`/api/opportunities/${o.id}/${dismissed ? "dismiss" : "restore"}`, {
    method: "POST",
  });
}
