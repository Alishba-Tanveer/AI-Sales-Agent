/**
 * LinkedIn feature data layer. Every function calls the real backend (JWT is attached by lib/api.ts).
 *
 *   Profile Optimizer   /api/linkedin/profile/*, /api/linkedin/posts/check
 *   Content Engine      /api/linkedin/content/*
 *   Connections         /api/linkedin/strategy, /api/linkedin/leads/*
 */
import { api as baseApi } from "@/lib/api";
import type { ContentScript, ContentSettings, Lead, OutreachStrategy, NicheInput, ProfileAnalysis, SavedAudit } from "./types";

// Link checking lives in ./links (accepts links with or without https://)
export { isLinkedInProfileUrl, normalizeLinkedInProfileUrl } from "./links";

/**
 * These pages show the server's error message instead of signing the person out when a request is rejected
 * (an expired session is still caught by AuthGuard on the next page load).
 */
const api = <T,>(path: string, init: RequestInit = {}) => baseApi<T>(path, { keepSessionOn401: true, ...init });

type Res<T> = { message?: string; data: T };
const json = (body: unknown) => JSON.stringify(body);
const unwrap = async <T,>(p: Promise<Res<T>>) => (await p).data;

/* ======================= Profile Optimizer ======================= */

type AuditDto = {
  readAt: string;
  profileUrl: string;
  offer: string;
  audience: string;
  doneKeys: string[];
  suggestions: ProfileAnalysis["suggestions"];
};
const toAudit = (d: AuditDto): SavedAudit => ({
  profileUrl: d.profileUrl ?? "",
  offer: d.offer ?? "",
  audience: d.audience ?? "",
  analysis: { readAt: d.readAt, suggestions: d.suggestions, doneKeys: d.doneKeys ?? [] },
});

/**
 * GET /api/linkedin/profile
 * `profileUrl` is empty until the first profile read, so the page can tell "never read" from "read before".
 */
export async function fetchSavedAudit(): Promise<SavedAudit> {
  return toAudit(await unwrap(api<Res<AuditDto>>("/api/linkedin/profile")));
}

/** POST /api/linkedin/profile/analyze  { profileUrl, offer, audience } */
export async function analyzeProfile(profileUrl: string, niche: NicheInput): Promise<ProfileAnalysis> {
  const res = await unwrap(
    api<Res<AuditDto>>("/api/linkedin/profile/analyze", {
      method: "POST",
      body: json({ profileUrl, offer: niche.offer, audience: niche.audience }),
    }),
  );
  return toAudit(res).analysis;
}

/** PATCH /api/linkedin/profile/suggestions/:key  { done }  (remembers the tick between visits) */
export async function setSuggestionDone(key: string, done: boolean) {
  await api<Res<unknown>>(`/api/linkedin/profile/suggestions/${key}`, { method: "PATCH", body: json({ done }) });
}

export type PostStatus = "live" | "deleted" | "unknown";

/**
 * POST /api/linkedin/posts/check  { postUrl, scriptId }  ->  { status }
 * A browser cannot look inside LinkedIn (login wall + CORS), so the backend checks.
 * When the post is gone the backend also flags the script as deleted.
 */
export async function checkPostStatus(postUrl?: string, scriptId?: string): Promise<PostStatus> {
  if (!postUrl) return "unknown";
  const res = await api<{ status: PostStatus }>("/api/linkedin/posts/check", { method: "POST", body: json({ postUrl, scriptId }) });
  return res.status;
}

/* ======================= Content Engine ======================= */

/** GET /api/linkedin/content/scripts  ->  scripts + the posting settings (reminder time, avatar) */
export async function fetchContent(): Promise<{ scripts: ContentScript[]; settings: ContentSettings }> {
  const res = await api<{ scripts: ContentScript[]; settings: ContentSettings }>("/api/linkedin/content/scripts");
  return { scripts: res.scripts, settings: res.settings };
}

/** POST /api/linkedin/content/scripts  { topic }  ->  a new draft at the top of "Needs approval" */
export const createScript = (topic: string) =>
  unwrap(api<Res<ContentScript>>("/api/linkedin/content/scripts", { method: "POST", body: json({ topic }) }));

/** PATCH /api/linkedin/content/scripts/:id  (edited hook / points / call to action, or a saved post link) */
export const updateScript = (id: string, patch: Partial<Pick<ContentScript, "hook" | "points" | "cta" | "postUrl" | "postDeleted">>) =>
  unwrap(api<Res<ContentScript>>(`/api/linkedin/content/scripts/${id}`, { method: "PATCH", body: json(patch) }));

/** POST /api/linkedin/content/scripts/:id/approve  (the backend schedules the reminder at your saved time) */
export const approveScript = (id: string) =>
  unwrap(api<Res<ContentScript>>(`/api/linkedin/content/scripts/${id}/approve`, { method: "POST", body: json({}) }));

/** POST /api/linkedin/content/scripts/:id/regenerate  ->  next draft */
export const regenerateScript = (id: string) =>
  unwrap(api<Res<ContentScript>>(`/api/linkedin/content/scripts/${id}/regenerate`, { method: "POST", body: json({}) }));

/** POST .../dismiss (Needs approval), POST .../cancel (Scheduled) or DELETE (Posted list). All remove the script. */
export const removeScript = (id: string, how: "dismiss" | "cancel" | "delete") =>
  how === "delete"
    ? api<Res<unknown>>(`/api/linkedin/content/scripts/${id}`, { method: "DELETE" })
    : api<Res<unknown>>(`/api/linkedin/content/scripts/${id}/${how}`, { method: "POST", body: json({}) });

/** POST /api/linkedin/content/scripts/:id/mark-posted  { postUrl? } */
export const markScriptPosted = (id: string, postUrl?: string) =>
  unwrap(api<Res<ContentScript>>(`/api/linkedin/content/scripts/${id}/mark-posted`, { method: "POST", body: json(postUrl ? { postUrl } : {}) }));

/** PATCH /api/linkedin/content/settings  { remindAt, avatar } */
export const saveContentSettings = (v: { remindAt: string; avatar: string }) =>
  unwrap(api<Res<ContentSettings>>("/api/linkedin/content/settings", { method: "PATCH", body: json(v) }));

/* ======================= Connections ======================= */

/** GET /api/linkedin/strategy */
export const fetchStrategy = () => unwrap(api<Res<OutreachStrategy>>("/api/linkedin/strategy"));

/** PUT /api/linkedin/strategy */
export const saveStrategy = (s: Pick<OutreachStrategy, "who" | "message" | "perDay" | "followUpDays">) =>
  unwrap(api<Res<OutreachStrategy>>("/api/linkedin/strategy", { method: "PUT", body: json(s) }));

/** GET /api/linkedin/leads */
export const fetchLeads = async (): Promise<Lead[]> => (await api<{ leads: Lead[] }>("/api/linkedin/leads")).leads;

/** POST /api/linkedin/leads  (a person added by hand lands in Target buyers as "Suggested") */
export const createLead = (v: { name: string; role?: string; company?: string; url: string }) =>
  unwrap(api<Res<Lead>>("/api/linkedin/leads", { method: "POST", body: json({ ...v, source: "buyer", status: "suggested" }) }));

/** POST /api/linkedin/leads/:id/send  { note? }  ->  status becomes "pending" (429 when the daily limit is used up) */
export const sendLead = (id: string, note?: string) =>
  unwrap(api<Res<Lead>>(`/api/linkedin/leads/${id}/send`, { method: "POST", body: json(note ? { note } : {}) }));

/** POST /api/linkedin/leads/bulk-approve  { ids }  ->  how many went out + the refreshed list */
export type BulkResult = { sentCount: number; requestedCount: number; dailyLimit: number; limitReached: boolean; leads: Lead[] };
export const bulkApproveLeads = (ids: string[]) =>
  unwrap(api<Res<BulkResult>>("/api/linkedin/leads/bulk-approve", { method: "POST", body: json({ ids }) }));

/** POST /api/linkedin/leads/:id/skip  or  /withdraw  (both mark the person as skipped) */
export const skipLead = (id: string, how: "skip" | "withdraw") =>
  unwrap(api<Res<Lead>>(`/api/linkedin/leads/${id}/${how}`, { method: "POST", body: json({}) }));

/** PATCH /api/linkedin/leads/:id/note  { note }  (saves the note without sending anything) */
export const saveLeadNote = (id: string, note: string) =>
  unwrap(api<Res<Lead>>(`/api/linkedin/leads/${id}/note`, { method: "PATCH", body: json({ note }) }));
