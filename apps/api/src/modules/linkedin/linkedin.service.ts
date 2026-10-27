import { Prisma, Role, prisma } from "@ai-sales-agent/database";
import { AppError } from "../../utils/app-error";
import {
  AuditHistoryEntry,
  buildSuggestionsForNiche,
  ContentSourceItem,
  linkedinRepository,
  ProfileContext,
  ProfileSuggestionItem,
  SuggestionKey,
} from "./linkedin.repository";
import { notify } from "../../utils/notify";
import { extractPdfText, parseLinkedInPdfText } from "./linkedin.pdf";
import {
  normalizeLinkedInProfileUrl,
  normalizeWebUrl,
} from "./linkedin.schema";
import { generateGeminiJson } from "../../integrations/ai";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env";
import { linkedinAuthorizationUrl, exchangeLinkedinCode, linkedinUserInfo } from "../../integrations/linkedin";
import { sealSecret } from "../../utils/secret-box";
import { tavilySearch } from "../../integrations/tavily";

/** Helper to extract a human name from a LinkedIn profile URL slug, e.g. "alishba-tanveer" -> "Alishba Tanveer" */
function extractNameFromLinkedInUrl(url: string): string | null {
  const match = url.match(/linkedin\.com\/(?:in|pub)\/([^/?#\s]+)/i);
  if (!match) return null;
  const slug = match[1];
  const cleaned = slug.replace(/[0-9a-f]{8,}$/i, "").replace(/[-_.]+/g, " ").trim();
  if (cleaned.length < 2) return null;
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

export class LinkedinService {
  /* ========================================================================
   * 1. PROFILE OPTIMIZER
   * ======================================================================== */

  private parseSuggestions(raw: Prisma.JsonValue | null): ProfileSuggestionItem[] {
    return Array.isArray(raw) ? (raw as unknown as ProfileSuggestionItem[]) : [];
  }

  private parseHistory(raw: Prisma.JsonValue | null): AuditHistoryEntry[] {
    if (Array.isArray(raw)) {
      return raw as unknown as AuditHistoryEntry[];
    }
    return [];
  }

  private factsOf(config: { groundingFacts: Prisma.JsonValue | null }): Record<string, unknown> {
    const g = config.groundingFacts;
    return g && typeof g === "object" && !Array.isArray(g) ? (g as Record<string, unknown>) : {};
  }

  /** The profile text the person gave us (pasted or taken from their LinkedIn PDF). Never fetched from LinkedIn. */
  private sectionsOf(config: { groundingFacts: Prisma.JsonValue | null }): Partial<Record<SuggestionKey, string>> {
    const raw = this.factsOf(config).currentSections;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Partial<Record<SuggestionKey, string>> = {};
    for (const k of ["headline", "about", "experience", "skills", "featured"] as SuggestionKey[]) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return out;
  }

  /** Share of the changes the person marked as applied. 0 until they have read their profile. */
  private scoreOf(suggestions: ProfileSuggestionItem[]): number {
    if (!suggestions.length) return 0;
    return Math.round((suggestions.filter((s) => s.done).length / suggestions.length) * 100);
  }

  private formatProfileAnalysis(config: {
    id: string;
    profileUrl: string | null;
    offer: string;
    audience: string;
    latestScore: number;
    latestReadAt: string | null;
    suggestions: Prisma.JsonValue | null;
    groundingFacts: Prisma.JsonValue | null;
  }) {
    const suggestions = this.parseSuggestions(config.suggestions);
    const doneKeys = suggestions.filter((s) => s.done).map((s) => s.key);

    return {
      id: config.id,
      /** false until the person has given us their profile text once */
      hasAudit: suggestions.length > 0,
      readAt: config.latestReadAt ?? "",
      profileUrl: config.profileUrl ?? "",
      offer: config.offer,
      audience: config.audience,
      niche: { offer: config.offer, audience: config.audience },
      currentSections: this.sectionsOf(config),
      score: this.scoreOf(suggestions),
      doneKeys,
      suggestions,
      recommendations: suggestions,
    };
  }

  async getProfileAudit(organizationId: string) {
    const config = await linkedinRepository.getOrCreateConfig(organizationId);
    return this.formatProfileAnalysis(config);
  }

  /**
   * Turns the pages of a LinkedIn "Save to PDF" file into the same text boxes the person would otherwise paste into.
   * Nothing is analysed or saved here; the person checks the text first.
   */
  async importProfilePdf(base64: string) {
    const clean = base64.replace(/^data:application\/pdf;base64,/, "").trim();
    const buffer = Buffer.from(clean, "base64");
    if (buffer.byteLength > 3 * 1024 * 1024) {
      throw new AppError("That PDF is larger than 3MB. A LinkedIn profile PDF is normally far smaller.", 400);
    }
    const text = await extractPdfText(buffer);
    const sections = parseLinkedInPdfText(text);
    if (!sections.headline && !sections.about && !sections.experience && !sections.skills) {
      throw new AppError(
        "We couldn't find profile sections in that PDF. Make sure it is the PDF from LinkedIn’s “Save to PDF”, or paste the text instead.",
        400,
      );
    }
    return { sections };
  }

  async analyzeProfile(
    organizationId: string,
    input: {
      profileUrl?: string;
      offer?: string;
      audience?: string;
      niche?: { offer?: string; audience?: string };
      headline?: string;
      about?: string;
      experience?: string;
      skills?: string;
      featured?: string;
    },
  ) {
    const [config, org, user] = await Promise.all([
      linkedinRepository.getOrCreateConfig(organizationId),
      prisma.organization.findUnique({ where: { id: organizationId } }),
      prisma.user.findFirst({ where: { organizationId, deletedAt: null, role: Role.OWNER } }),
    ]);

    // Text from this request wins; a section left empty keeps what the person gave us last time.
    const saved = this.sectionsOf(config);
    const given: Partial<Record<SuggestionKey, string>> = {
      headline: input.headline?.trim() || saved.headline,
      about: input.about?.trim() || saved.about,
      experience: input.experience?.trim() || saved.experience,
      skills: input.skills?.trim() || saved.skills,
      featured: input.featured?.trim() || saved.featured,
    };
    if (!given.headline && !given.about && !given.experience && !given.skills) {
      throw new AppError(
        "Paste at least one part of your current LinkedIn profile (headline, About, experience or skills), or upload your LinkedIn PDF.",
        400,
      );
    }

    const fallbackOffer = org?.services?.length ? org.services.join(", ") : config.offer;
    const fallbackAudience = org?.targetTitles?.length
      ? `${org.targetTitles.join(", ")}${org.targetIndustries?.length ? ` at ${org.targetIndustries.join(", ")}` : ""}`
      : config.audience;
    const offer = (input.offer ?? input.niche?.offer ?? fallbackOffer).trim();
    const audience = (input.audience ?? input.niche?.audience ?? fallbackAudience).trim();

    // The link is optional now (it only builds the "Open LinkedIn" shortcuts); nothing is read from it.
    let cleanUrl = config.profileUrl ?? "";
    if (input.profileUrl !== undefined && input.profileUrl.trim() !== "") {
      const normalized = normalizeLinkedInProfileUrl(input.profileUrl);
      if (!normalized) {
        throw new AppError(
          "That doesn’t look like a LinkedIn profile link. Try linkedin.com/in/your-name",
          400,
        );
      }
      cleanUrl = normalized;
    }

    const ctx: ProfileContext = {
      personName: user?.name,
      roleTitle: user?.roleTitle && user.roleTitle !== "Chief Growth Officer & Co-Founder" ? user.roleTitle : undefined,
      orgName: org?.name,
      services: org?.services,
      targetTitles: org?.targetTitles,
      targetIndustries: org?.targetIndustries,
      currentSections: given,
    };

    const suggestions = buildSuggestionsForNiche(offer, audience, ctx);
    const readAt = new Date().toISOString().slice(0, 10);

    const history = this.parseHistory(config.auditHistory);
    const newEntry: AuditHistoryEntry = {
      id: `audit_${Date.now()}`,
      profileUrl: cleanUrl,
      offer,
      audience,
      score: 0,
      readAt,
      doneCount: 0,
      totalCount: suggestions.length,
      createdAt: new Date().toISOString(),
    };

    const updated = await linkedinRepository.updateConfig(organizationId, {
      profileUrl: cleanUrl || null,
      offer,
      audience,
      latestScore: 0,
      latestReadAt: readAt,
      suggestions: suggestions as unknown as Prisma.InputJsonValue,
      auditHistory: [newEntry, ...history.slice(0, 19)] as unknown as Prisma.InputJsonValue,
      groundingFacts: {
        ...this.factsOf(config),
        offer,
        audience,
        currentSections: given,
      } as unknown as Prisma.InputJsonValue,
    });

    return this.formatProfileAnalysis(updated);
  }

  async updateRecommendation(
    organizationId: string,
    keyOrId: string,
    patch: {
      done?: boolean;
      status?: "pending" | "accepted" | "dismissed" | "applied";
      suggested?: string;
      current?: string;
      why?: string;
    },
  ) {
    const config = await linkedinRepository.getOrCreateConfig(organizationId);
    const suggestions = this.parseSuggestions(config.suggestions);

    const idx = suggestions.findIndex((s) => s.key === keyOrId || s.id === keyOrId || s.section === keyOrId);
    if (idx === -1) {
      throw new AppError("Profile suggestion not found", 404);
    }

    const current = suggestions[idx];
    const nextDone =
      patch.done !== undefined
        ? patch.done
        : patch.status === "applied" || patch.status === "accepted"
          ? true
          : patch.status === "pending" || patch.status === "dismissed"
            ? false
            : current.done;
    const nextStatus = patch.status !== undefined ? patch.status : nextDone ? "applied" : "pending";

    suggestions[idx] = {
      ...current,
      ...(patch.suggested !== undefined ? { suggested: patch.suggested } : {}),
      ...(patch.current !== undefined ? { current: patch.current } : {}),
      ...(patch.why !== undefined ? { why: patch.why } : {}),
      done: nextDone,
      status: nextStatus,
      appliedAt: nextDone ? (current.appliedAt ?? new Date().toISOString()) : undefined,
    };

    // When a change is applied, the new text IS the person's current profile text from now on, so they never
    // have to paste it back in. Un-ticking puts back what they originally gave us.
    const facts = this.factsOf(config);
    const sections = { ...this.sectionsOf(config) };
    if (nextDone && !current.done) {
      sections[suggestions[idx].key] = suggestions[idx].suggested;
    }

    const updated = await linkedinRepository.updateConfig(organizationId, {
      suggestions: suggestions as unknown as Prisma.InputJsonValue,
      latestScore: this.scoreOf(suggestions),
      groundingFacts: { ...facts, currentSections: sections } as unknown as Prisma.InputJsonValue,
    });

    return {
      ...this.formatProfileAnalysis(updated),
      suggestion: suggestions[idx],
    };
  }

  /** Marks the listed changes as applied. `keys` is required: an empty request must never mark everything done. */
  async markRecommendationsApplied(organizationId: string, input: { keys?: string[]; key?: string }) {
    const wanted = input.keys?.length ? input.keys : input.key ? [input.key] : [];
    if (!wanted.length) {
      throw new AppError("Say which change you applied.", 400);
    }
    const config = await linkedinRepository.getOrCreateConfig(organizationId);
    const targetKeys = new Set(wanted);
    const now = new Date().toISOString();
    const sections = { ...this.sectionsOf(config) };

    const updatedSuggestions = this.parseSuggestions(config.suggestions).map((s) => {
      if (!(targetKeys.has(s.key) || targetKeys.has(s.id))) return s;
      if (!s.done) sections[s.key] = s.suggested;
      return { ...s, done: true, status: "applied" as const, appliedAt: s.appliedAt ?? now };
    });

    const updated = await linkedinRepository.updateConfig(organizationId, {
      suggestions: updatedSuggestions as unknown as Prisma.InputJsonValue,
      latestScore: this.scoreOf(updatedSuggestions),
      groundingFacts: { ...this.factsOf(config), currentSections: sections } as unknown as Prisma.InputJsonValue,
    });

    return this.formatProfileAnalysis(updated);
  }

  async getGroundingFacts(organizationId: string) {
    const config = await linkedinRepository.getOrCreateConfig(organizationId);
    const facts =
      config.groundingFacts && typeof config.groundingFacts === "object" && !Array.isArray(config.groundingFacts)
        ? (config.groundingFacts as Record<string, string>)
        : {};

    return {
      offer: config.offer,
      audience: config.audience,
      ...facts,
      facts: [
        { key: "offer", question: "What do you do?", answer: config.offer },
        {
          key: "audience",
          question: "Who do you want to sell to?",
          answer: config.audience || facts.audience || "",
        },
      ],
    };
  }

  async updateGroundingFact(
    organizationId: string,
    key: string,
    input: { value?: string; answer?: string; offer?: string; audience?: string },
  ) {
    const config = await linkedinRepository.getOrCreateConfig(organizationId);
    const facts =
      config.groundingFacts && typeof config.groundingFacts === "object" && !Array.isArray(config.groundingFacts)
        ? { ...(config.groundingFacts as Record<string, string>) }
        : {};

    const newVal = (input.value ?? input.answer ?? input.offer ?? input.audience ?? "").trim();
    facts[key] = newVal;

    const nextOffer = key === "offer" ? newVal : (input.offer?.trim() ?? config.offer);
    const nextAudience = key === "audience" ? newVal : (input.audience?.trim() ?? config.audience);

    await linkedinRepository.updateConfig(organizationId, {
      offer: nextOffer,
      audience: nextAudience,
      groundingFacts: facts as unknown as Prisma.InputJsonValue,
    });

    return this.getGroundingFacts(organizationId);
  }

  async getProfileHistory(organizationId: string) {
    const config = await linkedinRepository.getOrCreateConfig(organizationId);
    return this.parseHistory(config.auditHistory);
  }

  /* ========================================================================
   * 2. CONTENT ENGINE & VIDEO SCRIPTS
   * ======================================================================== */

  private formatScript(row: {
    id: string;
    status: string;
    draftNo: number;
    source: string;
    sourceUrl: string;
    date: string;
    title: string;
    hook: string;
    points: string[];
    cta: string;
    seconds: number;
    words: number;
    scheduledFor: string | null;
    postedAt: string | null;
    postUrl: string | null;
    postDeleted: boolean;
  }) {
    return {
      id: row.id,
      status: row.status as "needs_approval" | "creating_video" | "ready" | "posted",
      draftNo: row.draftNo,
      source: row.source,
      sourceUrl: row.sourceUrl,
      date: row.date,
      title: row.title,
      hook: row.hook,
      points: row.points,
      cta: row.cta,
      seconds: row.seconds,
      words: row.words,
      ...(row.scheduledFor ? { scheduledFor: row.scheduledFor } : {}),
      ...(row.postedAt ? { postedAt: row.postedAt } : {}),
      ...(row.postUrl ? { postUrl: row.postUrl } : {}),
      ...(row.postDeleted ? { postDeleted: row.postDeleted } : {}),
    };
  }

  async listScripts(
    organizationId: string,
    filters?: { status?: string; source?: string; search?: string },
  ) {
    let rows = await linkedinRepository.findScripts(organizationId);
    const config = await linkedinRepository.getOrCreateConfig(organizationId);

    // News and scripts are created explicitly by refreshNews/createScript, never seeded on page load.

    // Sort custom added topics ("Your topic") newest-first at the top
    const sorted = [...rows].sort((a, b) => {
      const aCustom = a.source === "Your topic" ? 0 : 1;
      const bCustom = b.source === "Your topic" ? 0 : 1;
      if (aCustom !== bCustom) return aCustom - bCustom;
      if (aCustom === 0) return b.createdAt.getTime() - a.createdAt.getTime();
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const allScripts = sorted.map((r) => this.formatScript(r));

    let filtered = allScripts;
    if (filters?.status) {
      if (filters.status === "scheduled") {
        filtered = filtered.filter((s) => s.status === "creating_video" || s.status === "ready");
      } else {
        filtered = filtered.filter((s) => s.status === filters.status);
      }
    }
    if (filters?.source) {
      filtered = filtered.filter((s) => s.source.toLowerCase() === filters.source!.toLowerCase());
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.hook.toLowerCase().includes(q) ||
          s.source.toLowerCase().includes(q),
      );
    }

    const counts = {
      needs_approval: allScripts.filter((s) => s.status === "needs_approval").length,
      creating_video: allScripts.filter((s) => s.status === "creating_video").length,
      ready: allScripts.filter((s) => s.status === "ready").length,
      scheduled: allScripts.filter((s) => s.status === "creating_video" || s.status === "ready").length,
      posted: allScripts.filter((s) => s.status === "posted").length,
      total: allScripts.length,
    };

    return {
      scripts: filtered,
      counts,
      settings: { remindAt: config.remindAt },
    };
  }

  async refreshNews(organizationId: string) {
    const config = await linkedinRepository.getOrCreateConfig(organizationId);
    if (!config.offer.trim() || !config.audience.trim()) throw new AppError("Add both your niche and target audience in Profile Optimizer before searching for news.", 400);
    const query = `latest news for ${config.audience} about ${config.offer}`;
    const results = await tavilySearch({ query, topic: "news", maxResults: 5, timeRange: "week" });
    const rows = await linkedinRepository.findScripts(organizationId);
    const created = [];
    for (const item of results) {
      if (rows.some((row) => row.sourceUrl === item.url)) continue;
      const draft = await this.createScript(organizationId, { topic: item.title, source: new URL(item.url).hostname.replace(/^www\./, ""), sourceUrl: item.url, sourceContent: item.content });
      created.push(draft);
    }
    return { count: created.length, scripts: created, sources: results.map(({title,url,publishedDate}) => ({title,url,publishedDate})) };
  }

  async getScriptById(organizationId: string, id: string) {
    const row = await linkedinRepository.findScriptById(organizationId, id);
    if (!row) {
      throw new AppError("Content script not found", 404);
    }
    return this.formatScript(row);
  }

  async createScript(
    organizationId: string,
    input: {
      topic?: string;
      title?: string;
      hook?: string;
      points?: string[];
      cta?: string;
      source?: string;
      sourceUrl?: string;
      sourceContent?: string;
    },
  ) {
    let title = (input.topic ?? input.title ?? "").trim();
    const config = await linkedinRepository.getOrCreateConfig(organizationId);
    if (!config.offer.trim() || !config.audience.trim()) throw new AppError("Set both your niche and target audience in Profile Optimizer before writing account-specific content.", 400);
    let source = input.source?.trim() || "Your topic";
    let sourceUrl = input.sourceUrl?.trim() ?? "";
    let grounding = "";
    if (sourceUrl) {
      grounding = `Use only these verified source notes: ${title} (${sourceUrl}). ${input.sourceContent ?? ""}`;
    } else if (source !== "Your topic") {
      throw new AppError("A source URL is required for a news-based script.", 400);
    }
    const result = await generateGeminiJson<{title:string;hook:string;points:string[];cta:string}>( {
      system: "Write a concise LinkedIn vertical-video script. Return JSON with title, hook, points (2-4 strings), cta. Do not invent statistics, quotations, events, or user credentials. For news, use only the provided source notes and make claims traceable to them. For a user topic, frame advice as general guidance, not a reported fact.",
      prompt: JSON.stringify({ niche: { offer: config.offer, audience: config.audience }, topic: title, sourceNotes: grounding || undefined, instruction: "Keep it in the user's account voice, useful to their stated audience, under 120 words." }),
    });
    title = result.title?.trim() || title;
    const hook = result.hook?.trim();
    const points = Array.isArray(result.points) ? result.points.map((p) => String(p).trim()).filter(Boolean).slice(0,4) : [];
    const cta = result.cta?.trim();
    if (!title || !hook || points.length < 2 || !cta) throw new AppError("The script provider returned an incomplete draft. Please try again.", 502);
    const words = [hook, ...points, cta].join(" ").split(/\s+/).filter(Boolean).length;
    const seconds = Math.max(10, Math.round(words / 2.5));

    const created = await linkedinRepository.createScript(organizationId, {
      status: "needs_approval",
      draftNo: 1,
      source,
      sourceUrl,
      date: new Date().toISOString().slice(0, 10),
      title,
      hook,
      points,
      cta,
      seconds,
      words,
    });

    return this.formatScript(created);
  }

  async updateScript(
    organizationId: string,
    id: string,
    patch: {
      title?: string;
      hook?: string;
      points?: string[];
      cta?: string;
      status?: "needs_approval" | "creating_video" | "ready" | "posted";
      draftNo?: number;
      source?: string;
      sourceUrl?: string;
      date?: string;
      seconds?: number;
      words?: number;
      scheduledFor?: string | null;
      postedAt?: string | null;
      postUrl?: string | null;
      postDeleted?: boolean;
    },
  ) {
    const existing = await linkedinRepository.findScriptById(organizationId, id);
    if (!existing) {
      throw new AppError("Content script not found", 404);
    }

    const nextHook = patch.hook ?? existing.hook;
    const nextPoints = patch.points ?? existing.points;
    const nextCta = patch.cta ?? existing.cta;

    const textChanged =
      patch.hook !== undefined || patch.points !== undefined || patch.cta !== undefined;
    const computedWords = [nextHook, ...nextPoints, nextCta]
      .join(" ")
      .split(/\s+/)
      .filter(Boolean).length;
    const computedSeconds = Math.max(10, Math.round(computedWords / 2.5));

    let cleanPostUrl = patch.postUrl;
    if (typeof cleanPostUrl === "string" && cleanPostUrl.trim() !== "") {
      const normalized = normalizeWebUrl(cleanPostUrl);
      if (!normalized) {
        throw new AppError("That doesn’t look like a link. Try linkedin.com/posts/…", 400);
      }
      cleanPostUrl = normalized;
    }

    const updated = await linkedinRepository.updateScript(organizationId, id, {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.hook !== undefined ? { hook: patch.hook } : {}),
      ...(patch.points !== undefined ? { points: patch.points } : {}),
      ...(patch.cta !== undefined ? { cta: patch.cta } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.draftNo !== undefined ? { draftNo: patch.draftNo } : {}),
      ...(patch.source !== undefined ? { source: patch.source } : {}),
      ...(patch.sourceUrl !== undefined ? { sourceUrl: patch.sourceUrl } : {}),
      ...(patch.date !== undefined ? { date: patch.date } : {}),
      words: patch.words ?? (textChanged ? computedWords : existing.words),
      seconds: patch.seconds ?? (textChanged ? computedSeconds : existing.seconds),
      ...(patch.scheduledFor !== undefined ? { scheduledFor: patch.scheduledFor } : {}),
      ...(patch.postedAt !== undefined ? { postedAt: patch.postedAt } : {}),
      ...(cleanPostUrl !== undefined ? { postUrl: cleanPostUrl } : {}),
      ...(patch.postDeleted !== undefined ? { postDeleted: patch.postDeleted } : {}),
    });

    return this.formatScript(updated);
  }

  async approveScript(
    organizationId: string,
    id: string,
    input?: {
      scheduledFor?: string;
      scheduledAt?: string;
      remindAt?: string;
      readyImmediately?: boolean;
    },
  ) {
    const [existing, config] = await Promise.all([
      linkedinRepository.findScriptById(organizationId, id),
      linkedinRepository.getOrCreateConfig(organizationId),
    ]);
    if (!existing) {
      throw new AppError("Content script not found", 404);
    }

    const remindAt = input?.remindAt || config.remindAt || "08:30";
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const scheduledFor =
      input?.scheduledFor || input?.scheduledAt || `${tomorrow}T${remindAt}:00`;

    const updated = await linkedinRepository.updateScript(organizationId, id, {
      status: "ready",
      scheduledFor,
    });

    return this.formatScript(updated);
  }

  async bulkApproveScripts(
    organizationId: string,
    input: { ids: string[]; scheduledFor?: string },
  ) {
    const results = [];
    for (const id of input.ids) {
      const existing = await linkedinRepository.findScriptById(organizationId, id);
      if (existing) {
        const s = await this.approveScript(organizationId, id, {
          scheduledFor: input.scheduledFor,
        });
        results.push(s);
      }
    }
    return { approvedCount: results.length, scripts: results };
  }

  async regenerateScript(organizationId: string, id: string) {
    const existing = await linkedinRepository.findScriptById(organizationId, id);
    if (!existing) {
      throw new AppError("Content script not found", 404);
    }

    const revised = await generateGeminiJson<{hook:string;points:string[];cta:string}>({
      system: "Rewrite a LinkedIn video script with a fresh angle. Return JSON hook, points (2-4 strings), cta. Keep news claims strictly within source text; do not invent facts, stats, or quotes.",
      prompt: JSON.stringify({ title: existing.title, source: existing.source, sourceUrl: existing.sourceUrl, current: { hook: existing.hook, points: existing.points, cta: existing.cta }, niche: ((cfg) => ({ offer: cfg.offer, audience: cfg.audience }))(await linkedinRepository.getOrCreateConfig(organizationId)), direction: "Keep it concise and relevant to this account's audience." }),
    });
    if (!revised.hook || !revised.cta || !Array.isArray(revised.points) || revised.points.length < 2) throw new AppError("The script provider returned an incomplete rewrite.", 502);
    const words = [revised.hook, ...revised.points, revised.cta].join(" ").split(/\s+/).filter(Boolean).length;
    const updated = await linkedinRepository.updateScript(organizationId, id, {
      draftNo: existing.draftNo + 1, hook: revised.hook, points: revised.points.slice(0,4), cta: revised.cta,
      words, seconds: Math.max(10, Math.round(words / 2.5)),
    });
    return this.formatScript(updated);
  }

  async deleteScript(organizationId: string, id: string) {
    const existing = await linkedinRepository.findScriptById(organizationId, id);
    if (!existing) {
      throw new AppError("Content script not found", 404);
    }
    await linkedinRepository.deleteScript(organizationId, id);
    return { id, deleted: true };
  }

  async markScriptPosted(organizationId: string, id: string, input?: { postUrl?: string }) {
    const existing = await linkedinRepository.findScriptById(organizationId, id);
    if (!existing) {
      throw new AppError("Content script not found", 404);
    }

    let cleanUrl: string | null = existing.postUrl;
    if (input?.postUrl && input.postUrl.trim() !== "") {
      const normalized = normalizeWebUrl(input.postUrl);
      if (!normalized) {
        throw new AppError("That doesn’t look like a link. Try linkedin.com/posts/…", 400);
      }
      cleanUrl = normalized;
    }

    const updated = await linkedinRepository.updateScript(organizationId, id, {
      status: "posted",
      postedAt: new Date().toISOString().slice(0, 19),
      postUrl: cleanUrl,
      postDeleted: false,
    });

    return this.formatScript(updated);
  }

  async checkPostStatus(
    organizationId: string,
    input: { postUrl?: string; scriptId?: string },
  ): Promise<{ status: "live" | "deleted" | "unknown" }> {
    let targetUrl = input.postUrl?.trim();

    if (!targetUrl && input.scriptId) {
      const script = await linkedinRepository.findScriptById(organizationId, input.scriptId);
      targetUrl = script?.postUrl ?? undefined;
    }

    if (!targetUrl) {
      return { status: "unknown" };
    }

    const markDeletedInDb = async (urlToMatch: string) => {
      const scripts = await linkedinRepository.findScripts(organizationId);
      for (const s of scripts) {
        if (s.postUrl === urlToMatch || (input.scriptId && s.id === input.scriptId)) {
          const firstTime = !s.postDeleted;
          await linkedinRepository.updateScript(organizationId, s.id, { postDeleted: true });
          if (firstTime) {
            // Content is worked on by everyone, so everyone hears that a published post is gone (once per post).
            await notify({
              organizationId,
              type: "failure",
              title: "A LinkedIn post was removed",
              body: `The post "${s.title}" is no longer on LinkedIn. Check it in the Content Engine.`,
              href: "/linkedin?tab=content",
              audience: "ALL",
            });
          }
        }
      }
    };

    if (/deleted/i.test(targetUrl)) {
      await markDeletedInDb(targetUrl);
      return { status: "deleted" };
    }

    const cleanUrl = normalizeWebUrl(targetUrl);
    if (!cleanUrl) {
      return { status: "unknown" };
    }

    try {
      const res = await fetch(cleanUrl, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(2500),
      });
      if (res.status === 404 || res.status === 410) {
        await markDeletedInDb(targetUrl);
        return { status: "deleted" };
      }
    } catch {
      return { status: "unknown" };
    }

    return { status: "unknown" };
  }

  async getContentSettings(organizationId: string) {
    const config = await linkedinRepository.getOrCreateConfig(organizationId);
    return {
      remindAt: config.remindAt,
    };
  }

  async updateContentSettings(
    organizationId: string,
    input: { remindAt?: string },
  ) {
    const updated = await linkedinRepository.updateConfig(organizationId, {
      ...(input.remindAt !== undefined ? { remindAt: input.remindAt } : {}),

    });
    return {
      remindAt: updated.remindAt,
    };
  }

  async getContentSources(organizationId: string): Promise<ContentSourceItem[]> {
    const config = await linkedinRepository.getOrCreateConfig(organizationId);
    return Array.isArray(config.contentSources) ? config.contentSources as unknown as ContentSourceItem[] : [];
  }

  async updateContentSources(organizationId: string, sources: ContentSourceItem[]) {
    const normalized = sources.map((s) => ({
      name: s.name.trim(),
      url: normalizeWebUrl(s.url) || s.url.trim(),
      enabled: s.enabled ?? true,
    }));
    await linkedinRepository.updateConfig(organizationId, {
      contentSources: normalized as unknown as Prisma.InputJsonValue,
    });
    return normalized;
  }


  /* ========================================================================
   * 3. ENGAGEMENT & CONNECTIONS + OUTREACH STRATEGY
   * ======================================================================== */

  async getStrategy(organizationId: string) {
    const [config, org, workspaceSettings] = await Promise.all([
      linkedinRepository.getOrCreateConfig(organizationId),
      prisma.organization.findUnique({ where: { id: organizationId } }),
      prisma.workspaceSettings.findUnique({ where: { organizationId } }),
    ]);

    const dynamicWho = config.strategyAgreedOn ? config.strategyWho : org?.targetTitles?.length
      ? `${org.targetTitles.join(", ")}${org.targetIndustries?.length ? ` at ${org.targetIndustries.join(", ")}` : ""}`
      : config.strategyWho || "Decision-makers in your target market";

    const dynamicMsg = config.strategyMessage || "Hi {first_name}, I noticed your work at {company}. I help {audience} with {offer} and would value connecting to exchange ideas.";

    const perDay = config.strategyPerDay || workspaceSettings?.dailyCap || 5;
    const followUpDays = config.strategyFollowUpDays || workspaceSettings?.intervalDays || 3;

    return {
      agreedOn: config.strategyAgreedOn,
      who: dynamicWho,
      perDay,
      message: dynamicMsg,
      followUpDays,
    };
  }

  async updateStrategy(
    organizationId: string,
    input: {
      who: string;
      message: string;
      perDay: number;
      followUpDays: number;
      agreedOn?: string;
    },
  ) {
    const agreedOn = input.agreedOn || new Date().toISOString().slice(0, 10);
    const updated = await linkedinRepository.updateConfig(organizationId, {
      strategyAgreedOn: agreedOn,
      strategyWho: input.who.trim(),
      strategyMessage: input.message.trim(),
      strategyPerDay: input.perDay,
      strategyFollowUpDays: input.followUpDays,
    });

    // Also keep workspaceSettings in sync
    await prisma.workspaceSettings.updateMany({
      where: { organizationId },
      data: {
        dailyCap: input.perDay,
        intervalDays: input.followUpDays,
      },
    });

    return {
      agreedOn: updated.strategyAgreedOn,
      who: updated.strategyWho,
      perDay: updated.strategyPerDay,
      message: updated.strategyMessage,
      followUpDays: updated.strategyFollowUpDays,
    };
  }

  private formatLead(row: {
    id: string;
    name: string;
    role: string;
    company: string;
    source: string;
    status: string;
    reason: string;
    reasonKind: string;
    note: string;
    url: string | null;
    sentAt: string | null;
    connectedAt: string | null;
  }) {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      company: row.company,
      source: row.source as "engaged" | "buyer",
      status: row.status as "suggested" | "approved" | "pending" | "connected" | "skipped",
      reason: row.reason,
      reasonKind: row.reasonKind as "like" | "comment" | "view" | "fit",
      note: row.note,
      ...(row.url ? { url: row.url } : {}),
      ...(row.sentAt ? { sentAt: row.sentAt } : {}),
      ...(row.connectedAt ? { connectedAt: row.connectedAt } : {}),
    };
  }

  async listLeads(
    organizationId: string,
    filters?: { tab?: string; status?: string; source?: string; search?: string },
  ) {
    const rows = await linkedinRepository.findLeads(organizationId);

    // Put manually added people ("Added by you") newest-first at the top
    const sorted = [...rows].sort((a, b) => {
      const aAdded = a.reason === "Added by you" ? 0 : 1;
      const bAdded = b.reason === "Added by you" ? 0 : 1;
      if (aAdded !== bAdded) return aAdded - bAdded;
      if (aAdded === 0) return b.createdAt.getTime() - a.createdAt.getTime();
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const allLeads = sorted.map((r) => this.formatLead(r));
    const isOpen = (l: { status: string }) => l.status === "suggested" || l.status === "approved";

    const counts = {
      engaged: allLeads.filter((l) => l.source === "engaged" && isOpen(l)).length,
      buyers: allLeads.filter((l) => l.source === "buyer" && isOpen(l)).length,
      pending: allLeads.filter((l) => l.status === "pending").length,
      connected: allLeads.filter((l) => l.status === "connected").length,
      skipped: allLeads.filter((l) => l.status === "skipped").length,
      total: allLeads.length,
    };

    let filtered = allLeads;
    if (filters?.tab) {
      if (filters.tab === "engaged") {
        filtered = filtered.filter((l) => l.source === "engaged" && isOpen(l));
      } else if (filters.tab === "buyers") {
        filtered = filtered.filter((l) => l.source === "buyer" && isOpen(l));
      } else if (filters.tab === "pending") {
        filtered = filtered.filter((l) => l.status === "pending");
      } else if (filters.tab === "connected") {
        filtered = filtered.filter((l) => l.status === "connected");
      }
    }
    if (filters?.status) {
      filtered = filtered.filter((l) => l.status === filters.status);
    }
    if (filters?.source) {
      filtered = filtered.filter((l) => l.source === filters.source);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.company.toLowerCase().includes(q) ||
          l.role.toLowerCase().includes(q),
      );
    }

    return {
      leads: filtered,
      counts,
    };
  }

  async getLeadById(organizationId: string, id: string) {
    const row = await linkedinRepository.findLeadById(organizationId, id);
    if (!row) {
      throw new AppError("Connection lead not found", 404);
    }
    return this.formatLead(row);
  }

  async createLead(
    organizationId: string,
    input: {
      name: string;
      role?: string;
      company?: string;
      url?: string;
      source?: "engaged" | "buyer";
      status?: "suggested" | "approved" | "pending" | "connected" | "skipped";
      reason?: string;
      reasonKind?: "like" | "comment" | "view" | "fit";
      note?: string;
    },
  ) {
    const config = await linkedinRepository.getOrCreateConfig(organizationId);
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    let cleanUrl: string | undefined;
    if (input.url && input.url.trim() !== "") {
      const normalized = normalizeLinkedInProfileUrl(input.url);
      if (!normalized) {
        throw new AppError("That doesn’t look like a LinkedIn profile link.", 400);
      }
      cleanUrl = normalized;
    }

    const firstName = input.name.trim().split(/\s+/)[0] || input.name.trim();
    const audience = config.audience.trim() || org?.targetTitles?.join(", ") || "people in your industry";
    const offer = config.offer.trim() || org?.services?.join(", ") || "my work";
    const personalizedNote = (config.strategyMessage || "Hi {first_name}, I noticed your work at {company}. I help {audience} with {offer} and would value connecting to exchange ideas.")
      .replace(/\{first_name\}/gi, firstName)
      .replace(/\{name\}/gi, input.name.trim())
      .replace(/\{company\}/gi, input.company?.trim() || "your company")
      .replace(/\{role\}/gi, input.role?.trim() || "your work")
      .replace(/\{audience\}/gi, audience)
      .replace(/\{offer\}/gi, offer)
      .replace(/\{industry\}/gi, org?.targetIndustries?.join(", ") || "your industry");
    const created = await linkedinRepository.createLead(organizationId, {
      name: input.name.trim(),
      role: input.role?.trim() || "—",
      company: input.company?.trim() || "—",
      source: input.source || "buyer",
      status: input.status || "suggested",
      reasonKind: input.reasonKind || "fit",
      reason: input.reason?.trim() || "Added by you",
      note: input.note?.trim() || personalizedNote,
      url: cleanUrl ?? null,
    });

    return this.formatLead(created);
  }

  async updateLead(
    organizationId: string,
    id: string,
    patch: {
      name?: string;
      role?: string;
      company?: string;
      url?: string | null;
      source?: "engaged" | "buyer";
      status?: "suggested" | "approved" | "pending" | "connected" | "skipped";
      reason?: string;
      reasonKind?: "like" | "comment" | "view" | "fit";
      note?: string;
      sentAt?: string | null;
      connectedAt?: string | null;
    },
  ) {
    const existing = await linkedinRepository.findLeadById(organizationId, id);
    if (!existing) {
      throw new AppError("Connection lead not found", 404);
    }

    let cleanUrl = patch.url;
    if (typeof cleanUrl === "string" && cleanUrl.trim() !== "") {
      const normalized = normalizeLinkedInProfileUrl(cleanUrl);
      if (!normalized) {
        throw new AppError("That doesn’t look like a LinkedIn profile link.", 400);
      }
      cleanUrl = normalized;
    }

    const updated = await linkedinRepository.updateLead(id, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.role !== undefined ? { role: patch.role } : {}),
      ...(patch.company !== undefined ? { company: patch.company } : {}),
      ...(cleanUrl !== undefined ? { url: cleanUrl } : {}),
      ...(patch.source !== undefined ? { source: patch.source } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.reason !== undefined ? { reason: patch.reason } : {}),
      ...(patch.reasonKind !== undefined ? { reasonKind: patch.reasonKind } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.sentAt !== undefined ? { sentAt: patch.sentAt } : {}),
      ...(patch.connectedAt !== undefined ? { connectedAt: patch.connectedAt } : {}),
    });

    return this.formatLead(updated);
  }

  async sendConnectionRequest(organizationId: string, id: string, note?: string) {
    const [existing, config, allRows] = await Promise.all([
      linkedinRepository.findLeadById(organizationId, id),
      linkedinRepository.getOrCreateConfig(organizationId),
      linkedinRepository.findLeads(organizationId),
    ]);
    if (!existing) {
      throw new AppError("Connection lead not found", 404);
    }

    const updated = await linkedinRepository.updateLead(id, {
      status: "approved",
      sentAt: null,
      ...(note !== undefined ? { note: note.trim() } : {}),
    });

    return this.formatLead(updated);
  }

  async markLeadSent(organizationId: string, id: string) {
    const existing=await linkedinRepository.findLeadById(organizationId,id);
    if(!existing) throw new AppError("Connection lead not found",404);
    if(existing.status!=="approved") throw new AppError("Prepare and review the note before marking an invitation sent.",409);
    return this.updateLead(organizationId,id,{status:"pending",sentAt:new Date().toISOString().slice(0,10)});
  }

  async bulkApproveLeads(organizationId: string, ids: string[]) {
    const [config, allRows] = await Promise.all([
      linkedinRepository.getOrCreateConfig(organizationId),
      linkedinRepository.findLeads(organizationId),
    ]);

    const validIds = allRows.filter((l) => ids.includes(l.id)).map((l) => l.id);
    const goIds = validIds;

    await linkedinRepository.updateManyLeads(organizationId, goIds, {
      status: "approved",
      sentAt: null,
    });

    const { leads } = await this.listLeads(organizationId);
    return {
      approvedIds: goIds,
      sentCount: goIds.length,
      requestedCount: ids.length,
      dailyLimit: config.strategyPerDay,
      limitReached: false,
      leads,
    };
  }

  async skipOrWithdrawLead(organizationId: string, id: string) {
    return this.updateLead(organizationId, id, { status: "skipped" });
  }

  async restoreLead(organizationId: string, id: string) {
    return this.updateLead(organizationId, id, { status: "suggested" });
  }

  async markLeadConnected(organizationId: string, id: string) {
    const today = new Date().toISOString().slice(0, 10);
    return this.updateLead(organizationId, id, {
      status: "connected",
      connectedAt: today,
    });
  }

  async discoverConnections(organizationId: string) {
    const [config, org] = await Promise.all([
      linkedinRepository.getOrCreateConfig(organizationId),
      prisma.organization.findUnique({ where: { id: organizationId } }),
    ]);

    const targetTitle = org?.targetTitles?.join(" OR ") || config.audience;
    const industry = org?.targetIndustries?.join(" OR ") || config.offer;
    if (!targetTitle && !industry) throw new AppError("Set your buyer titles or niche before researching prospects.", 400);
    const hits = await tavilySearch({ query: `publicly identified ${targetTitle} ${industry} buyer leaders company`, topic: "general", maxResults: 8 });
    const sourceNotes = hits.map((h, i) => ({ id: i, title: h.title, url: h.url, excerpt: h.content }));
    const candidates = await generateGeminiJson<Array<{name:string;role:string;company:string;profileUrl:string;sourceIndex:number;reason:string}>>({
      system: "Extract only real named people and companies explicitly present in the provided search excerpts. Never guess or fill missing names, titles, employers, LinkedIn URLs or fit. Return [] when evidence is insufficient. Each result must cite a sourceIndex and a profileUrl that appears verbatim in that source excerpt.",
      prompt: JSON.stringify({ target: { titles: targetTitle, industries: industry }, sources: sourceNotes }),
    });
    const created = [];
    for (const candidate of Array.isArray(candidates) ? candidates : []) {
      const hit = hits[candidate.sourceIndex];
      if (!hit || !candidate.name || !candidate.role || !candidate.company || !candidate.profileUrl || !hit.content.includes(candidate.profileUrl)) continue;
      const profileUrl = normalizeLinkedInProfileUrl(candidate.profileUrl);
      if (!profileUrl) continue;
      const lead = await this.createLead(organizationId, { name: candidate.name, role: candidate.role, company: candidate.company, url: profileUrl, source: "buyer", status: "suggested", reason: `${candidate.reason} Source: ${hit.url}` });
      created.push(lead);
    }
    return { discoveredCount: created.length, leads: created, researchSources: hits.map(({title,url}) => ({title,url})) };
  }

  async importLeads(
    organizationId: string,
    input: {
      leads?: Array<{
        name: string;
        role?: string;
        company?: string;
        url?: string;
        source?: "engaged" | "buyer";
        reason?: string;
        note?: string;
      }>;
      csv?: string;
    },
  ) {
    const items = [...(input.leads ?? [])];
    if (input.csv) {
      const lines = input.csv
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim());
        if (i === 0 && /^name$/i.test(parts[0])) continue;
        if (parts[0] && parts[0].length > 1) {
          items.push({
            name: parts[0],
            role: parts[1] || "—",
            company: parts[2] || "—",
            url: parts[3] || undefined,
          });
        }
      }
    }

    const created = [];
    for (const item of items) {
      const lead = await this.createLead(organizationId, item);
      created.push(lead);
    }
    return { importedCount: created.length, leads: created };
  }

  async addLeadToCrm(organizationId: string, id: string) {
    const liLead = await linkedinRepository.findLeadById(organizationId, id);
    if (!liLead) {
      throw new AppError("Connection lead not found", 404);
    }

    const crmLead = await prisma.lead.create({
      data: {
        organizationId,
        name: liLead.name,
        company: liLead.company !== "—" ? liLead.company : null,
        jobTitle: liLead.role !== "—" ? liLead.role : null,
        source: `LinkedIn (${liLead.source})`,
        notes: `${liLead.reason}\n\nNote: ${liLead.note}`,
        stage: liLead.status === "connected" ? "CONTACTED" : "NEW",
      },
    });

    return crmLead;
  }

  /* ========================================================================
   * 4. LINKEDIN ACCOUNT
   * ======================================================================== */

  async getAccount(organizationId: string) {
    const config = await linkedinRepository.getOrCreateConfig(organizationId);
    return { connected: config.accountConnected, profileUrl: config.profileUrl ?? "", accountName: config.accountName ?? "", canPublish: config.linkedinScopes.includes("w_member_social") };
  }

  async beginLinkedinOAuth(organizationId: string, actorId: string) {
    if (!env.ENCRYPTION_KEY || !/^[0-9a-f]{64}$/i.test(env.ENCRYPTION_KEY)) throw new AppError("Configure a 32-byte hexadecimal ENCRYPTION_KEY before connecting LinkedIn.", 503);
    const state = randomBytes(32).toString("base64url");
    await linkedinRepository.updateConfig(organizationId, { oauthStateHash: createHash("sha256").update(state).digest("hex"), oauthStateExpiresAt: new Date(Date.now()+10*60*1000), oauthStateUserId: actorId });
    try { return { authorizationUrl: linkedinAuthorizationUrl(state) }; }
    catch (error) { await linkedinRepository.updateConfig(organizationId, { oauthStateHash: null, oauthStateExpiresAt: null, oauthStateUserId: null }); throw new AppError((error as Error).message,503); }
  }

  async completeLinkedinOAuth(state: string, code: string) {
    if (!state || !code) throw new AppError("LinkedIn authorization was cancelled or incomplete.",400);
    const digest=createHash("sha256").update(state).digest("hex");
    const config=await prisma.linkedinConfig.findFirst({ where:{ oauthStateHash:digest } });
    if (!config || !config.oauthStateExpiresAt || config.oauthStateExpiresAt < new Date()) throw new AppError("LinkedIn authorization expired. Start the connection again.",400);
    await linkedinRepository.updateConfig(config.organizationId,{ oauthStateHash:null,oauthStateExpiresAt:null,oauthStateUserId:null });
    try {
      const token=await exchangeLinkedinCode(code);
      const member=await linkedinUserInfo(token.access_token);
      const updated=await linkedinRepository.updateConfig(config.organizationId,{
        accountConnected:true, accountName:member.name ?? member.given_name ?? "LinkedIn member",
        linkedinMemberUrn:`urn:li:person:${member.sub}`, linkedinAccessToken:sealSecret(token.access_token),
        linkedinRefreshToken:token.refresh_token?sealSecret(token.refresh_token):null,
        linkedinTokenExpiresAt:new Date(Date.now()+token.expires_in*1000), linkedinScopes:["openid","profile","email","w_member_social"],
        ...(member.picture ? {} : {}),
      });
      return { connected:updated.accountConnected, accountName:updated.accountName };
    } catch(error) { throw new AppError((error as Error).message,502); }
  }

  async disconnectAccount(organizationId: string, actorId?: string) {
    const updated = await linkedinRepository.updateConfig(organizationId, { accountConnected:false, linkedinMemberUrn:null, linkedinAccessToken:null, linkedinRefreshToken:null, linkedinTokenExpiresAt:null, linkedinScopes:[], oauthStateHash:null, oauthStateExpiresAt:null, oauthStateUserId:null });
    await notify({ organizationId,type:"failure",title:"LinkedIn account disconnected",body:"LinkedIn is disconnected. Posting and account-linked actions are unavailable until you reconnect.",href:"/linkedin",audience:"OWNER_ADMIN",exceptUserId:actorId });
    return { connected:updated.accountConnected, profileUrl:updated.profileUrl ?? "" };
  }

}

export const linkedinService = new LinkedinService();
