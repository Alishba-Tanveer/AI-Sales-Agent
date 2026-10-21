/**
 * LinkedIn feature data layer.
 *
 * The backend has no LinkedIn routes yet, so every function below returns mock data.
 * Each one notes the endpoint it will call, so swapping to `api()` later only changes this file.
 */
import { MOCK_ANALYSIS, MOCK_LEADS, MOCK_SCRIPTS, MOCK_STRATEGY } from "./mock-data";
import type { ContentScript, Lead, NicheInput, OutreachStrategy, ProfileAnalysis } from "./types";

const wait = <T,>(value: T, ms = 700) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

// Link checking lives in ./links (accepts links with or without https://)
export { isLinkedInProfileUrl, normalizeLinkedInProfileUrl } from "./links";

/** POST /api/linkedin/profile/analyze  { profileUrl, offer, audience } */
export async function analyzeProfile(_profileUrl: string, _niche: NicheInput): Promise<ProfileAnalysis> {
  return wait({ ...MOCK_ANALYSIS, readAt: new Date().toISOString().slice(0, 10) }, 1200);
}

export type PostStatus = "live" | "deleted" | "unknown";

/**
 * POST /api/linkedin/posts/check  { postUrl }  ->  { status }
 * A browser cannot look inside LinkedIn (login wall + CORS), so the backend has to check.
 * Until that route exists this mock treats any link containing "deleted" as removed.
 */
export async function checkPostStatus(postUrl?: string): Promise<PostStatus> {
  if (!postUrl) return wait<PostStatus>("unknown", 400);
  return wait<PostStatus>(/deleted/i.test(postUrl) ? "deleted" : "live", 700);
}

/** GET /api/linkedin/content/scripts */
export const fetchScripts = (): Promise<ContentScript[]> => wait(MOCK_SCRIPTS.map((s) => ({ ...s })), 300);

/** GET /api/linkedin/strategy */
export const fetchStrategy = (): Promise<OutreachStrategy> => wait({ ...MOCK_STRATEGY }, 300);

/** GET /api/linkedin/leads */
export const fetchLeads = (): Promise<Lead[]> => wait(MOCK_LEADS.map((l) => ({ ...l })), 300);
