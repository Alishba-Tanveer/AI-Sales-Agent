import { api } from "@/lib/api";
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
 * Save as Lead. The server reads the company's website for an email or LinkedIn and only creates the lead when it finds
 * at least one. Otherwise it answers 422 with a message the page shows ("... can't be contacted and wasn't added to Leads").
 */
export async function saveOpportunityAsLead(o: Opportunity): Promise<{ leadId: string }> {
  const res = await api<{ data: { leadId: string } }>(`/api/opportunities/${o.id}/saved`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return { leadId: res.data.leadId };
}

/** POST /api/opportunities/:id/dismiss and /restore */
export async function setDismissed(o: Opportunity, dismissed: boolean): Promise<void> {
  await api(`/api/opportunities/${o.id}/${dismissed ? "dismiss" : "restore"}`, {
    method: "POST",
  });
}
