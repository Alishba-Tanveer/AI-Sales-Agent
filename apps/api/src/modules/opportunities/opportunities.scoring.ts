/**
 * Text cleaning and match scoring for Find Opportunities.
 * Kept free of database / network imports so it can be tested on its own.
 */

// ───────────────────────── text cleaning ─────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  bull: "•",
  middot: "·",
  euro: "€",
  pound: "£",
  copy: "©",
  reg: "®",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return " ";
      try {
        return String.fromCodePoint(code);
      } catch {
        return " ";
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

function removeTags(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|table|section|article)>|<br\s*\/?>/gi, " ")
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    // a tag cut off by a length limit (`<div cla`) at the very end
    .replace(/<\/?[a-z][^>]*$/i, " ");
}

/**
 * Turns HTML (including HTML that a source sent entity-escaped, like `&lt;div class="x"&gt;`) into plain text.
 * Entities are decoded BEFORE tags are removed, and the pair is repeated, so escaped or double-escaped markup
 * never leaks through as visible `<div ...>` text.
 */
export function stripHtml(input: string): string {
  let text = String(input ?? "");
  for (let i = 0; i < 3; i++) {
    const decoded = decodeEntities(text);
    const stripped = removeTags(decoded);
    if (stripped === text) break;
    text = stripped;
  }
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Short "intent signals" excerpt. When a keyword appears deep in the description the excerpt starts just before it,
 * so what the person sees is the part that actually matched.
 */
export function buildExcerpt(fullText: string, keywords: string[], maxLen = 260): string {
  const text = fullText.trim();
  if (text.length <= maxLen) return text;

  let start = 0;
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    const needle = kw.toLowerCase().trim();
    if (!needle) continue;
    const idx = lower.indexOf(needle);
    if (idx > maxLen - 80) {
      start = Math.max(0, idx - 80);
      break;
    }
  }
  if (start > 0) {
    const space = text.indexOf(" ", start);
    if (space !== -1 && space - start < 20) start = space + 1;
  }

  let end = Math.min(text.length, start + maxLen);
  if (end < text.length) {
    const lastSpace = text.lastIndexOf(" ", end);
    if (lastSpace > start + maxLen * 0.6) end = lastSpace;
  }
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

// ───────────────────────── scoring ─────────────────────────

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Light stemming so "agents" matches "agent" and "automations" matches "automation". */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

const tokenize = (term: string) =>
  term
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((t) => t.replace(/^[.]+|[.]+$/g, ""))
    .filter((t) => t.length >= 2);

/** Whole-word (prefix) match, so "ai" does not match inside "maintain" or "email". */
function wordRegex(word: string, mode: "prefix" | "exact" = "prefix") {
  const w = escapeRegExp(stem(word));
  return new RegExp(`(?:^|[^a-z0-9])${w}${mode === "prefix" ? "[a-z0-9]{0,3}" : ""}(?![a-z0-9])`, "i");
}

function countMatches(text: string, phraseTokens: string[]): number {
  if (phraseTokens.length === 0) return 0;
  const pattern = phraseTokens.map((t) => `${escapeRegExp(stem(t))}[a-z0-9]{0,3}`).join("[^a-z0-9]+");
  const re = new RegExp(`(?:^|[^a-z0-9])${pattern}(?![a-z0-9])`, "gi");
  return text.match(re)?.length ?? 0;
}

/**
 * How well one term (a keyword or a service) fits a posting, from 0 to 1.
 *   whole phrase in the title       1.00
 *   every word in the title         0.90
 *   phrase in the description       0.55 – 0.75 (more mentions = stronger)
 *   words spread over title / body  up to 0.50
 *   some of the words               proportional, up to 0.35
 */
export function termMatch(term: string, title: string, body: string): number {
  const tokens = tokenize(term);
  if (tokens.length === 0) return 0;

  if (countMatches(title, tokens) > 0) return 1;

  const titleHits = tokens.filter((t) => wordRegex(t).test(title)).length;
  if (titleHits === tokens.length) return 0.9;

  const phraseInBody = countMatches(body, tokens);
  if (phraseInBody > 0) return Math.min(0.75, 0.55 + 0.1 * (phraseInBody - 1));

  const bodyHits = tokens.filter((t) => wordRegex(t).test(body)).length;
  const weighted = titleHits + 0.6 * Math.max(0, bodyHits - titleHits);
  const covered = Math.min(1, weighted / tokens.length);
  return covered >= 1 ? 0.5 : covered * 0.35;
}

/**
 * Strength of the best-matching keyword mixed with the average: one strong hit (say "automation" in the title)
 * already makes a good match, and matching several keywords pushes the score higher still.
 */
function aggregateKeywords(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return 0.25 * avg + 0.75 * Math.max(...values);
}

function aggregateServices(values: number[]): number {
  if (values.length === 0) return 0;
  const top = [...values].sort((a, b) => b - a).slice(0, 3);
  const mean = top.reduce((a, b) => a + b, 0) / top.length;
  return 0.65 * top[0] + 0.35 * mean;
}

export type ScoreInput = {
  title: string;
  /** full cleaned description (not the short excerpt), so scoring sees the whole posting */
  body: string;
  keywords: string[];
  services: string[];
  postedAt: Date;
  hasBudget: boolean;
  now: number;
  /** extra points for sources that are already pre-filtered by intent (e.g. a search for "request for proposal") */
  sourceBonus?: number;
};

export type ScoreBreakdown = { score: number; keywords: number; services: number; recency: number };

const WEIGHT = { keywords: 60, recency: 10, detail: 5 } as const;
/** fitting the workspace's own services adds up to this many points on top of the base score */
const SERVICE_BONUS_MAX = 12;
const MAX_AGE_MS = 30 * 24 * 3_600_000;

/**
 * 0–100 match score that genuinely differs per posting. It is built from
 *   – keyword fit (title counts most, then the description),
 *   – how fresh the posting is,
 *   – how much detail it gives (budget, a real description),
 *   – a bonus when it fits the services configured for the workspace.
 * Without keywords only freshness and detail are left, and the score is rescaled to 0–100.
 */
export function scoreOpportunity(input: ScoreInput): ScoreBreakdown {
  const title = input.title.toLowerCase();
  const body = input.body.toLowerCase();
  const keywords = input.keywords.map((k) => k.trim()).filter(Boolean);
  const services = input.services.map((s) => s.trim()).filter(Boolean);

  const kw = aggregateKeywords(keywords.map((k) => termMatch(k, title, body)));
  const svc = aggregateServices(services.map((s) => termMatch(s, title, body)));

  const age = Math.max(0, input.now - input.postedAt.getTime());
  const recency = Math.max(0, 1 - age / MAX_AGE_MS);

  const detail = Math.min(1, (input.hasBudget ? 0.5 : 0) + Math.min(0.5, input.body.length / 1600));

  let earned = WEIGHT.recency * recency + WEIGHT.detail * detail;
  let possible: number = WEIGHT.recency + WEIGHT.detail;
  if (keywords.length > 0) {
    earned += WEIGHT.keywords * kw;
    possible += WEIGHT.keywords;
  }

  const raw = (earned / possible) * 100 + (services.length > 0 ? SERVICE_BONUS_MAX * svc : 0) + (input.sourceBonus ?? 0);
  return {
    score: Math.round(Math.min(99, Math.max(1, raw))),
    keywords: kw,
    services: svc,
    recency,
  };
}

/** Does the posting really mention what the person searched for? (No keywords typed = everything passes.) */
export function matchesAnyKeyword(keywords: string[], title: string, body: string): boolean {
  const list = keywords.map((k) => k.trim()).filter(Boolean);
  if (list.length === 0) return true;
  const t = title.toLowerCase();
  const b = body.toLowerCase();
  // 0.3+ means every word of at least one keyword shows up in the title or description
  return list.some((k) => termMatch(k, t, b) >= 0.3);
}
