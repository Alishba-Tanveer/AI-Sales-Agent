/**
 * LinkedIn feature data layer. Every function calls the real backend (JWT is attached by lib/api.ts).
 *
 *   Profile Optimizer   /api/linkedin/profile/*, /api/linkedin/posts/check
 *   Content Engine      /api/linkedin/content/*
 *   Connections         /api/linkedin/strategy, /api/linkedin/leads/*
 */
import { api as baseApi } from "@/lib/api";
import type { ContentScript, ContentSettings, Lead, OutreachStrategy, NicheInput, ProfileAnalysis, ProfileSections, SavedAudit } from "./types";

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
  hasAudit: boolean;
  readAt: string;
  profileUrl: string;
  offer: string;
  audience: string;
  currentSections?: Partial<ProfileSections>;
  doneKeys: string[];
  suggestions: ProfileAnalysis["suggestions"];
  generatedBy?: "ai" | "template";
  notice?: string;
};
const toAudit = (d: AuditDto): SavedAudit => ({
  hasAudit: d.hasAudit ?? d.suggestions?.length > 0,
  profileUrl: d.profileUrl ?? "",
  offer: d.offer ?? "",
  audience: d.audience ?? "",
  sections: {
    headline: d.currentSections?.headline ?? "",
    about: d.currentSections?.about ?? "",
    experience: d.currentSections?.experience ?? "",
    skills: d.currentSections?.skills ?? "",
  },
  analysis: { readAt: d.readAt, suggestions: d.suggestions ?? [], doneKeys: d.doneKeys ?? [], generatedBy: d.generatedBy, notice: d.notice },
});

/**
 * GET /api/linkedin/profile
 * `hasAudit` is false until the person has given us their profile once, so the page can tell "first time" from "again".
 */
export async function fetchSavedAudit(): Promise<SavedAudit> {
  return toAudit(await unwrap(api<Res<AuditDto>>("/api/linkedin/profile")));
}

/**
 * POST /api/linkedin/profile/analyze  { profileUrl?, offer, audience, headline, about, experience, skills }
 * LinkedIn does not let any app read a profile, so the text comes from the person (pasted, or from their PDF).
 * The profile link is optional: it is only used to build the "Open LinkedIn" shortcuts.
 */
export async function analyzeProfile(profileUrl: string, niche: NicheInput, sections: ProfileSections): Promise<ProfileAnalysis> {
  const res = await unwrap(
    api<Res<AuditDto>>("/api/linkedin/profile/analyze", {
      method: "POST",
      body: json({ ...(profileUrl ? { profileUrl } : {}), offer: niche.offer, audience: niche.audience, ...sections }),
    }),
  );
  return toAudit(res).analysis;
}

/** POST /api/linkedin/profile/import-pdf  { pdfBase64 }  ->  the text found in LinkedIn's "Save to PDF" file */
export async function importProfilePdf(file: File): Promise<ProfileSections> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const res = await unwrap(
    api<Res<{ sections: ProfileSections }>>("/api/linkedin/profile/import-pdf", { method: "POST", body: json({ pdfBase64: btoa(binary) }) }),
  );
  return res.sections;
}

/**
 * POST /api/linkedin/profile/recommendations/mark-applied  { keys }
 * The applied text becomes the person's current text on the server, so they never paste it back in.
 */
export async function markApplied(keys: string[]) {
  await api<Res<unknown>>("/api/linkedin/profile/recommendations/mark-applied", { method: "POST", body: json({ keys }) });
}

/** PATCH /api/linkedin/profile/suggestions/:key  { done: false }  (undo "Mark as applied") */
export async function setSuggestionDone(key: string, done: boolean) {
  if (done) return markApplied([key]);
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

/** GET /api/linkedin/content/scripts  ->  scripts + the posting settings (posting reminder) */
export async function fetchContent(): Promise<{ scripts: ContentScript[]; settings: ContentSettings }> {
  const res = await api<{ scripts: ContentScript[]; settings: ContentSettings }>("/api/linkedin/content/scripts");
  return { scripts: res.scripts, settings: res.settings };
}

export type NewsRefreshResult = { count:number; scripts:ContentScript[]; searched?:number; skippedIrrelevant?:number; sources?:{ title:string; url:string }[] };
export const refreshNicheNews = async () => (await api<NewsRefreshResult>("/api/linkedin/content/news/refresh", { method:"POST", body:json({}) }));

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

/** PATCH /api/linkedin/content/settings  { remindAt } */
export const saveContentSettings = (v: { remindAt: string }) =>
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

export type ImportRow = { name: string; role?: string; company?: string; url?: string; source: Lead["source"]; status?: "suggested" | "connected"; connectedAt?: string; reason?: string };

/** POST /api/linkedin/leads/import  { leads }  (people from a CSV the user exported; each lands in its chosen list as "Suggested") */
export const importLeads = (leads: ImportRow[]) =>
  unwrap(api<Res<{ importedCount: number; skippedDuplicates?: number; leads: Lead[] }>>("/api/linkedin/leads/import", { method: "POST", body: json({ leads }) }));

export type DiscoverResult = { discoveredCount: number; leads: Lead[]; researchSources: { title: string; url: string }[] };

/**
 * POST /api/linkedin/leads/discover  ->  buyer candidates found in public sources (Tavily search + Gemini, can take up to a minute).
 * Every candidate is checked against the source text on the server and lands in Target buyers as "Suggested".
 */
export const discoverBuyers = () =>
  unwrap(api<Res<DiscoverResult>>("/api/linkedin/leads/discover", { method: "POST", body: json({}) }));

/** Save a connection note for manual sending; does not send a LinkedIn invitation. */
export const sendLead = (id: string, note?: string) =>
  unwrap(api<Res<Lead>>(`/api/linkedin/leads/${id}/send`, { method: "POST", body: json(note ? { note } : {}) }));

export const markLeadSent = (id:string) => unwrap(api<Res<Lead>>(`/api/linkedin/leads/${id}/mark-sent`, { method:"POST", body:json({}) }));
/** Mark a pending connection as accepted after confirming it manually on LinkedIn. */
export const markLeadConnected = (id: string) => unwrap(api<Res<Lead>>(`/api/linkedin/leads/${id}/mark-connected`, { method: "POST", body: json({}) }));

/** POST /api/linkedin/leads/:id/skip  or  /withdraw  (both mark the person as skipped) */
export const skipLead = (id: string, how: "skip" | "withdraw") =>
  unwrap(api<Res<Lead>>(`/api/linkedin/leads/${id}/${how}`, { method: "POST", body: json({}) }));

/** PATCH /api/linkedin/leads/:id/note  { note }  (saves the note without sending anything) */
export const saveLeadNote = (id: string, note: string) =>
  unwrap(api<Res<Lead>>(`/api/linkedin/leads/${id}/note`, { method: "PATCH", body: json({ note }) }));

/** Copy a LinkedIn prospect into the shared CRM lead pipeline (idempotent). */
export const addLeadToCrm = (id: string) =>
  api<{ id: string; name: string }>(`/api/linkedin/leads/${id}/add-to-leads`, { method: "POST", body: json({}) });

/**
 * DELETE /api/linkedin/leads/:id  or  POST /api/linkedin/leads/bulk-delete { ids }
 * Permanently removes people from the lists. The server refuses anyone already added to Leads.
 */
export const deleteLeads = (ids: string[]) =>
  ids.length === 1
    ? unwrap(api<Res<{ deletedCount: number }>>(`/api/linkedin/leads/${ids[0]}`, { method: "DELETE" }))
    : unwrap(api<Res<{ deletedCount: number }>>("/api/linkedin/leads/bulk-delete", { method: "POST", body: json({ ids }) }));
