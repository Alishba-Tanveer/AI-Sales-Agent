import type { Opportunity, SearchFilters, SearchResult } from "./types";

export function buildMockOpportunities(): Opportunity[] {
  return [];
}

export function filterMock(_all: Opportunity[], _f: SearchFilters): SearchResult {
  return { items: [], failures: [] };
}
