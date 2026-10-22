import { Prisma, prisma } from "@ai-sales-agent/database";
import { AppError } from "../../utils/app-error";
import {
  AuditHistoryEntry,
  buildSuggestionsForNiche,
  ContentSourceItem,
  DEFAULT_SOURCES,
  linkedinRepository,
  ProfileContext,
  ProfileSuggestionItem,
} from "./linkedin.repository";
import {
  normalizeLinkedInProfileUrl,
  normalizeWebUrl,
} from "./linkedin.schema";

/** Helper to extract a human name from a LinkedIn profile URL slug, e.g. "alishba-tanveer" -> "Alishba Tanveer" */
function extractNameFromLinkedInUrl(url: string): string | null {
  const match = url.match(/linkedin\.com\/(?:in|pub)\/([^/?#\s]+)/i);
  if (!match) return null;
  const slug = match[1];
  const cleaned = slug.replace(/[0-9a-f]{8,}$/i, "").replace(/[-_.]+/g, " ").trim();
  if (cleaned.length < 2) return null;
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Fetches real-time live tech/business stories from TechCrunch RSS */
async function fetchLiveTechNews(): Promise<
  Array<{ title: string; link: string; date: string }>
> {
  try {
    const res = await fetch("https://techcrunch.com/feed/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5);
    const results = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const m of itemMatches) {
      const item = m[1];
      const titleMatch =
        item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
      const linkMatch = item.match(/<link>(.*?)<\/link>/);
      const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);

      if (titleMatch && linkMatch) {
        const cleanTitle = titleMatch[1]
          .replace(/&#\d+;/g, "")
          .replace(/&amp;/g, "&")
          .trim();
        results.push({
          title: cleanTitle,
          link: linkMatch[1].trim(),
          date: pubDateMatch
            ? new Date(pubDateMatch[1]).toISOString().slice(0, 10)
            : today,
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

export class LinkedinService {
  /* ========================================================================
   * 1. PROFILE OPTIMIZER
   * ======================================================================== */

  private parseSuggestions(
    raw: Prisma.JsonValue | null,
    offer: string,
    audience: string,
    ctx?: ProfileContext,
  ): ProfileSuggestionItem[] {
    if (Array.isArray(raw) && raw.length > 0) {
      return raw as unknown as ProfileSuggestionItem[];
    }
    return buildSuggestionsForNiche(offer, audience, ctx);
  }

  private parseHistory(raw: Prisma.JsonValue | null): AuditHistoryEntry[] {
    if (Array.isArray(raw)) {
      return raw as unknown as AuditHistoryEntry[];
    }
    return [];
  }

  private formatProfileAnalysis(
    config: {
      id: string;
      profileUrl: string | null;
      offer: string;
      audience: string;
      latestScore: number;
      latestReadAt: string | null;
      suggestions: Prisma.JsonValue | null;
    },
    ctx?: ProfileContext,
  ) {
    const suggestions = this.parseSuggestions(config.suggestions, config.offer, config.audience, ctx);
    const doneKeys = suggestions.filter((s) => s.done).map((s) => s.key);
    const readAt = config.latestReadAt || new Date().toISOString().slice(0, 10);

    return {
      id: config.id,
      readAt,
      profileUrl: config.profileUrl ?? "",
      offer: config.offer,
      audience: config.audience,
      niche: {
        offer: config.offer,
        audience: config.audience,
      },
      score: config.latestScore,
      doneKeys,
      suggestions,
      recommendations: suggestions,
    };
  }

  async getProfileAudit(organizationId: string) {
    const [config, org, user] = await Promise.all([
      linkedinRepository.getOrCreateConfig(organizationId),
      prisma.organization.findUnique({ where: { id: organizationId } }),
      prisma.user.findFirst({ where: { organizationId, deletedAt: null } }),
    ]);

    const ctx: ProfileContext = {
      personName: user?.name,
      roleTitle: user?.roleTitle || undefined,
      orgName: org?.name,
      services: org?.services,
      targetTitles: org?.targetTitles,
      targetIndustries: org?.targetIndustries,
    };

    return this.formatProfileAnalysis(config, ctx);
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
      prisma.user.findFirst({ where: { organizationId, deletedAt: null } }),
    ]);

    const fallbackOffer = org?.services?.length
      ? org.services.join(", ")
      : config.offer;
    const fallbackAudience = org?.targetTitles?.length
      ? `${org.targetTitles.join(", ")} at ${org?.targetIndustries?.join(", ") || "SaaS"} companies`
      : config.audience;

    const offer = (input.offer ?? input.niche?.offer ?? fallbackOffer).trim();
    const audience = (input.audience ?? input.niche?.audience ?? fallbackAudience).trim();

    let cleanUrl = config.profileUrl ?? "https://www.linkedin.com/in/me";
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

    const extractedName = extractNameFromLinkedInUrl(cleanUrl);
    const personName = extractedName || user?.name || "Growth Leader";
    const roleTitle = user?.roleTitle || "Full Stack Engineer & Tech Lead";
    const orgName = org?.name || "AI Sales Agent";

    const ctx: ProfileContext = {
      personName,
      roleTitle,
      orgName,
      services: org?.services,
      targetTitles: org?.targetTitles,
      targetIndustries: org?.targetIndustries,
      currentSections: {
        headline: input.headline,
        about: input.about,
        experience: input.experience,
        skills: input.skills,
        featured: input.featured,
      },
    };

    const suggestions = buildSuggestionsForNiche(offer, audience, ctx);
    const readAt = new Date().toISOString().slice(0, 10);
    const score = 78;

    const history = this.parseHistory(config.auditHistory);
    const newEntry: AuditHistoryEntry = {
      id: `audit_${Date.now()}`,
      profileUrl: cleanUrl,
      offer,
      audience,
      score,
      readAt,
      doneCount: 0,
      totalCount: suggestions.length,
      createdAt: new Date().toISOString(),
    };

    const existingFacts =
      config.groundingFacts && typeof config.groundingFacts === "object" && !Array.isArray(config.groundingFacts)
        ? (config.groundingFacts as Record<string, unknown>)
        : {};

    const updated = await linkedinRepository.updateConfig(organizationId, {
      profileUrl: cleanUrl,
      offer,
      audience,
      latestScore: score,
      latestReadAt: readAt,
      suggestions: suggestions as unknown as Prisma.InputJsonValue,
      auditHistory: [newEntry, ...history.slice(0, 19)] as unknown as Prisma.InputJsonValue,
      groundingFacts: {
        ...existingFacts,
        offer,
        audience,
      } as unknown as Prisma.InputJsonValue,
    });

    return this.formatProfileAnalysis(updated, ctx);
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
    const suggestions = this.parseSuggestions(config.suggestions, config.offer, config.audience);

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

    const nextStatus =
      patch.status !== undefined
        ? patch.status
        : nextDone
          ? "applied"
          : "pending";

    suggestions[idx] = {
      ...current,
      ...(patch.suggested !== undefined ? { suggested: patch.suggested } : {}),
      ...(patch.current !== undefined ? { current: patch.current } : {}),
      ...(patch.why !== undefined ? { why: patch.why } : {}),
      done: nextDone,
      status: nextStatus,
    };

    const doneCount = suggestions.filter((s) => s.done).length;
    const latestScore = Math.min(100, 78 + doneCount * 4);

    const updated = await linkedinRepository.updateConfig(organizationId, {
      suggestions: suggestions as unknown as Prisma.InputJsonValue,
      latestScore,
    });

    return {
      ...this.formatProfileAnalysis(updated),
      suggestion: suggestions[idx],
    };
  }

  async markRecommendationsApplied(organizationId: string, input: { keys?: string[]; key?: string }) {
    const config = await linkedinRepository.getOrCreateConfig(organizationId);
    const suggestions = this.parseSuggestions(config.suggestions, config.offer, config.audience);

    const targetKeys = input.keys?.length
      ? new Set(input.keys)
      : input.key
        ? new Set([input.key])
        : null;

    const updatedSuggestions = suggestions.map((s) => {
      const shouldMark = targetKeys
        ? targetKeys.has(s.key) || targetKeys.has(s.id)
        : s.status === "accepted" || s.done || targetKeys === null;
      if (!shouldMark) return s;
      return {
        ...s,
        done: true,
        status: "applied" as const,
      };
    });

    const doneCount = updatedSuggestions.filter((s) => s.done).length;
    const latestScore = Math.min(100, 78 + doneCount * 4);

    const updated = await linkedinRepository.updateConfig(organizationId, {
      suggestions: updatedSuggestions as unknown as Prisma.InputJsonValue,
      latestScore,
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

    // If there are fewer than 2 needs_approval scripts, try fetching live RSS stories from TechCrunch
    const pendingCount = rows.filter((r) => r.status === "needs_approval").length;
    if (pendingCount <= 1) {
      try {
        const liveArticles = await fetchLiveTechNews();
        for (const item of liveArticles.slice(0, 3)) {
          const alreadyExists = rows.some(
            (r) => r.title.toLowerCase() === item.title.toLowerCase() || r.sourceUrl === item.link,
          );
          if (!alreadyExists) {
            const hook = `Here is what founders need to know about ${item.title.toLowerCase().slice(0, 70)}.`;
            const points = [
              "Enterprise automation and AI compute continue to accelerate across industries.",
              "Teams adopting automated outbound workflows are closing deals faster with smaller teams.",
              "Focusing on personalized messages beats high-volume spray-and-pray every time.",
            ];
            const cta = "Follow me for daily breakdowns on AI, automation, and outbound growth.";
            const created = await linkedinRepository.createScript(organizationId, {
              status: "needs_approval",
              draftNo: 1,
              source: "TechCrunch",
              sourceUrl: item.link,
              date: item.date,
              title: item.title,
              hook,
              points,
              cta,
              seconds: 40,
              words: 100,
            });
            rows.unshift(created);
          }
        }
      } catch {
        // Fallback: continue with existing scripts
      }
    }

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
      settings: {
        remindAt: config.remindAt,
        avatar: config.avatar,
        heygenConnected: config.heygenConnected,
      },
    };
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
    },
  ) {
    const title = (input.topic ?? input.title ?? "").trim();
    const hook =
      input.hook?.trim() || `Here is what most people get wrong about ${title.toLowerCase()}.`;
    const points =
      input.points && input.points.length > 0
        ? input.points
        : [
            "The key fact your audience should know.",
            "One example from your own work.",
            "What to do about it this week.",
          ];
    const cta = input.cta?.trim() || "Follow me for a new tip every day.";
    const words = [hook, ...points, cta].join(" ").split(/\s+/).filter(Boolean).length;
    const seconds = Math.max(10, Math.round(words / 2.5));

    const created = await linkedinRepository.createScript(organizationId, {
      status: "needs_approval",
      draftNo: 1,
      source: input.source?.trim() || "Your topic",
      sourceUrl: input.sourceUrl?.trim() ?? "",
      date: new Date().toISOString().slice(0, 10),
      title,
      hook,
      points,
      cta,
      seconds: input.points ? seconds : 40,
      words: input.points ? words : 100,
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
      status: input?.readyImmediately ? "ready" : "creating_video",
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

    const cleanHook = existing.hook.replace(/^(Here is a fresh angle:\s*)+/i, "");
    const nextHook = `Here is a fresh angle: ${cleanHook}`;
    const words = [nextHook, ...existing.points, existing.cta]
      .join(" ")
      .split(/\s+/)
      .filter(Boolean).length;

    const updated = await linkedinRepository.updateScript(organizationId, id, {
      draftNo: existing.draftNo + 1,
      hook: nextHook,
      words,
      seconds: Math.max(10, Math.round(words / 2.5)),
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
          await linkedinRepository.updateScript(organizationId, s.id, { postDeleted: true });
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
      // Network/CORS/login wall fallback: treat non-deleted URLs as live
    }

    return { status: "live" };
  }

  async getContentSettings(organizationId: string) {
    const config = await linkedinRepository.getOrCreateConfig(organizationId);
    return {
      remindAt: config.remindAt,
      avatar: config.avatar,
      heygenConnected: config.heygenConnected,
    };
  }

  async updateContentSettings(
    organizationId: string,
    input: { remindAt?: string; avatar?: string; heygenConnected?: boolean },
  ) {
    const updated = await linkedinRepository.updateConfig(organizationId, {
      ...(input.remindAt !== undefined ? { remindAt: input.remindAt } : {}),
      ...(input.avatar !== undefined ? { avatar: input.avatar } : {}),
      ...(input.heygenConnected !== undefined ? { heygenConnected: input.heygenConnected } : {}),
    });
    return {
      remindAt: updated.remindAt,
      avatar: updated.avatar,
      heygenConnected: updated.heygenConnected,
    };
  }

  async getContentSources(organizationId: string): Promise<ContentSourceItem[]> {
    const config = await linkedinRepository.getOrCreateConfig(organizationId);
    if (Array.isArray(config.contentSources) && config.contentSources.length > 0) {
      return config.contentSources as unknown as ContentSourceItem[];
    }
    return DEFAULT_SOURCES;
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

  async handleHeygenWebhook(payload: { scriptId?: string; videoId?: string; status?: string; videoUrl?: string }) {
    if (!payload.scriptId) {
      return { processed: false };
    }
    const script = await prisma.linkedinScript.findUnique({
      where: { id: payload.scriptId },
    });
    if (!script) {
      return { processed: false };
    }
    const updated = await prisma.linkedinScript.update({
      where: { id: script.id },
      data: {
        status: payload.status === "failed" ? "needs_approval" : "ready",
      },
    });
    return { processed: true, script: this.formatScript(updated) };
  }

  /* ========================================================================
   * 3. ENGAGEMENT & CONNECTIONS + OUTREACH STRATEGY
   * ======================================================================== */

  async getStrategy(organizationId: string) {
    const [config, org, settings] = await Promise.all([
      linkedinRepository.getOrCreateConfig(organizationId),
      prisma.organization.findUnique({ where: { id: organizationId } }),
      prisma.workspaceSettings.findUnique({ where: { organizationId } }),
    ]);

    const dynamicWho = org?.targetTitles?.length
      ? `${org.targetTitles.join(", ")} at ${org?.targetIndustries?.join(", ") || "B2B SaaS"} companies, 50-500 employees`
      : config.strategyWho;

    const dynamicMsg = org?.services?.length
      ? `Hi {first_name}, I saw your post on {topic}. At ${org.name || "our company"}, we help ${org.targetIndustries?.[0] || "B2B"} teams with ${org.services[0]}. Would love to connect!`
      : config.strategyMessage;

    const perDay = settings?.dailyCap || config.strategyPerDay || 15;
    const followUpDays = settings?.intervalDays || config.strategyFollowUpDays || 3;

    return {
      agreedOn: config.strategyAgreedOn || new Date().toISOString().slice(0, 10),
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
    let cleanUrl: string | undefined;
    if (input.url && input.url.trim() !== "") {
      const normalized = normalizeLinkedInProfileUrl(input.url);
      if (!normalized) {
        throw new AppError("That doesn’t look like a LinkedIn profile link.", 400);
      }
      cleanUrl = normalized;
    }

    const firstName = input.name.trim().split(/\s+/)[0] || input.name.trim();
    const created = await linkedinRepository.createLead(organizationId, {
      name: input.name.trim(),
      role: input.role?.trim() || "—",
      company: input.company?.trim() || "—",
      source: input.source || "buyer",
      status: input.status || "suggested",
      reasonKind: input.reasonKind || "fit",
      reason: input.reason?.trim() || "Added by you",
      note: input.note?.trim() || `Hi ${firstName}, I'd love to connect.`,
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

    const today = new Date().toISOString().slice(0, 10);
    const sentToday = allRows.filter(
      (l) => l.status === "pending" && l.sentAt === today && l.id !== id,
    ).length;

    if (sentToday >= config.strategyPerDay) {
      throw new AppError(`Daily limit of ${config.strategyPerDay} requests reached.`, 429);
    }

    const updated = await linkedinRepository.updateLead(id, {
      status: "pending",
      sentAt: today,
      ...(note !== undefined ? { note: note.trim() } : {}),
    });

    return this.formatLead(updated);
  }

  async bulkApproveLeads(organizationId: string, ids: string[]) {
    const [config, allRows] = await Promise.all([
      linkedinRepository.getOrCreateConfig(organizationId),
      linkedinRepository.findLeads(organizationId),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const todaysCount = allRows.filter((l) => l.status === "pending" && l.sentAt === today).length;
    const limit = config.strategyPerDay;
    const room = Math.max(0, limit - todaysCount);

    const validIds = allRows.filter((l) => ids.includes(l.id)).map((l) => l.id);
    const goIds = validIds.slice(0, room);

    if (goIds.length === 0) {
      throw new AppError(`Daily limit of ${limit} requests reached.`, 429);
    }

    await linkedinRepository.updateManyLeads(organizationId, goIds, {
      status: "pending",
      sentAt: today,
    });

    const { leads } = await this.listLeads(organizationId);
    return {
      approvedIds: goIds,
      sentCount: goIds.length,
      requestedCount: ids.length,
      dailyLimit: limit,
      limitReached: goIds.length < ids.length,
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

    const targetTitle = org?.targetTitles?.[0] || "VP of Sales";
    const targetIndustry = org?.targetIndustries?.[0] || "B2B SaaS";

    const discovered = [
      {
        name: "Liam O'Connor",
        role: targetTitle,
        company: "ScaleOps AI",
        source: "buyer" as const,
        status: "suggested" as const,
        reasonKind: "fit" as const,
        reason: `Matches your target: ${targetTitle}, ${targetIndustry}, 120 employees`,
        note: `Hi Liam, I saw your work at ScaleOps AI. At ${org?.name || "our company"}, we help ${targetIndustry} teams with ${org?.services?.[0] || "outbound automation"}. Would love to connect.`,
      },
      {
        name: "Sophia Martinez",
        role: org?.targetTitles?.[1] || "Head of Revenue",
        company: "DataPulse",
        source: "buyer" as const,
        status: "suggested" as const,
        reasonKind: "fit" as const,
        reason: `Matches your target: ${org?.targetTitles?.[1] || "Head of Revenue"}, ${targetIndustry}, 85 employees`,
        note: `Hi Sophia, saw your team's expansion at DataPulse. Would love to share insights on ${org?.services?.[0] || "sales growth"}.`,
      },
    ];

    const created = [];
    for (const d of discovered) {
      const lead = await this.createLead(organizationId, d);
      created.push(lead);
    }
    return { discoveredCount: created.length, leads: created };
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
    return {
      connected: config.accountConnected,
      profileUrl: config.profileUrl ?? "https://www.linkedin.com/in/me",
      accountName: config.accountName ?? "Connected LinkedIn Profile",
      heygenConnected: config.heygenConnected,
      avatar: config.avatar,
      remindAt: config.remindAt,
    };
  }

  async connectAccount(
    organizationId: string,
    input: {
      profileUrl?: string;
      accountName?: string;
      avatar?: string;
      remindAt?: string;
    },
  ) {
    let cleanUrl: string | undefined;
    if (input.profileUrl && input.profileUrl.trim() !== "") {
      const normalized = normalizeLinkedInProfileUrl(input.profileUrl);
      if (!normalized) {
        throw new AppError("That doesn’t look like a LinkedIn profile link.", 400);
      }
      cleanUrl = normalized;
    }

    const updated = await linkedinRepository.updateConfig(organizationId, {
      accountConnected: true,
      ...(cleanUrl ? { profileUrl: cleanUrl } : {}),
      ...(input.accountName ? { accountName: input.accountName.trim() } : {}),
      ...(input.avatar ? { avatar: input.avatar.trim(), heygenConnected: true } : {}),
      ...(input.remindAt ? { remindAt: input.remindAt.trim() } : {}),
    });

    return {
      connected: updated.accountConnected,
      profileUrl: updated.profileUrl ?? "https://www.linkedin.com/in/me",
      accountName: updated.accountName ?? "Connected LinkedIn Profile",
      heygenConnected: updated.heygenConnected,
      avatar: updated.avatar,
      remindAt: updated.remindAt,
    };
  }

  async disconnectAccount(organizationId: string) {
    const updated = await linkedinRepository.updateConfig(organizationId, {
      accountConnected: false,
    });
    return {
      connected: updated.accountConnected,
      profileUrl: updated.profileUrl,
    };
  }
}

export const linkedinService = new LinkedinService();
