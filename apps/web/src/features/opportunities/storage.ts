import { userStore } from "@/features/auth/user-store";
import type { SearchFilters } from "./types";

/**
 * Only the filters the person last used are remembered in this browser (so the panel is how they left it).
 * The RESULTS are not kept here: they live on the server and are shared by the whole workspace.
 */
const PREFIX = "opportunities:last-filters:";
/** older versions kept the whole result list here, which only the person who searched could see; it is removed */
const LEGACY_PREFIX = "opportunities:last-search:";

const currentKey = () => {
  const id = userStore.get()?.id;
  return id ? `${PREFIX}${id}` : null;
};

export const currentSearchOwner = () => userStore.get()?.id ?? null;

export function loadSavedFilters(): SearchFilters | null {
  if (typeof window === "undefined") return null;
  const key = currentKey();
  if (!key) return null;
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(LEGACY_PREFIX)) localStorage.removeItem(k);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SearchFilters>;
    if (!parsed || !Array.isArray(parsed.keywords) || !Array.isArray(parsed.sourceIds) || !Array.isArray(parsed.types)) return null;
    return parsed as SearchFilters;
  } catch {
    return null;
  }
}

export function saveFilters(filters: SearchFilters) {
  if (typeof window === "undefined") return;
  const key = currentKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(filters));
  } catch {
    // storage full or blocked: the filters just won't be remembered
  }
}

/** Called on sign-out so the next person on this browser does not inherit someone else's filters. */
export function clearSavedSearches() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX) || key.startsWith(LEGACY_PREFIX)) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
