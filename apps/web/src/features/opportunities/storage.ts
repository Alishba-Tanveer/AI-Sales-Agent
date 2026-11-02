import { userStore } from "@/features/auth/user-store";
import type { Opportunity, SearchFilters, SourceFailure } from "./types";

/**
 * The last finished search is kept in this browser, so reloading the page (or coming back later) shows the same results
 * until the person runs a new search. One entry per signed-in user.
 */
const PREFIX = "opportunities:last-search:";

export type SavedSearch = {
  filters: SearchFilters;
  items: Opportunity[];
  failures: SourceFailure[];
};

const currentKey = () => {
  const id = userStore.get()?.id;
  return id ? `${PREFIX}${id}` : null;
};

export const currentSearchOwner = () => userStore.get()?.id ?? null;

export function loadSavedSearch(): SavedSearch | null {
  if (typeof window === "undefined") return null;
  const key = currentKey();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedSearch>;
    if (!parsed || !parsed.filters || !Array.isArray(parsed.items)) return null;
    return { filters: parsed.filters, items: parsed.items, failures: Array.isArray(parsed.failures) ? parsed.failures : [] };
  } catch {
    return null;
  }
}

export function saveSearch(search: SavedSearch) {
  if (typeof window === "undefined") return;
  const key = currentKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(search));
  } catch {
    // storage full or blocked: the results still show for this visit, they just won't survive a reload
  }
}

/** Called on sign-out so the next person on this browser does not see someone else's results. */
export function clearSavedSearches() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
