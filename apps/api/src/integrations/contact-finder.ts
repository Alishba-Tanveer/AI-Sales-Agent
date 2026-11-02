import { env } from "../config/env";
import { tavilySearch } from "./tavily";

/**
 * Finds a real way to contact a company: an email address and/or a LinkedIn profile or company page.
 * It only reports what it actually finds on the company's own pages (or in a search result that clearly belongs to
 * the company). It never invents an address and never returns a LinkedIn *search* link.
 */
export type FoundContact = {
  email: string | null;
  linkedinUrl: string | null;
  /** The company's own website when we could work it out (otherwise null). */
  websiteUrl: string | null;
};

/** Job boards, aggregators, social sites and registries. Their emails, links and pages never describe the hiring company. */
const NOT_A_COMPANY_SITE = [
  "jobicy.com", "arbeitnow.com", "remotive.com", "remotive.io", "remoteok.com", "remoteok.io", "weworkremotely.com",
  "sam.gov", "linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com", "monster.com", "angel.co", "wellfound.com",
  "facebook.com", "twitter.com", "x.com", "instagram.com", "youtube.com", "tiktok.com", "pinterest.com", "reddit.com",
  "wikipedia.org", "crunchbase.com", "bloomberg.com", "zoominfo.com", "apollo.io", "rocketreach.co", "dnb.com", "g2.com",
  "trustpilot.com", "clutch.co", "github.com", "medium.com", "google.com", "bing.com", "yelp.com", "yellowpages.com",
];

const LINKEDIN_SLUG_BLOCKLIST = new Set([
  "linkedin", "company", "jobs", "remoteok", "remotive", "jobicy", "arbeitnow", "weworkremotely", "samgov", "share", "sharing",
]);

const JUNK_EMAIL_PARTS = [
  "sentry", "wixpress", "example.", "domain.com", "yourdomain", "your@", "email@", "user@", "name@", "test@", "john@", "jane@",
  "noreply", "no-reply", "donotreply", "do-not-reply", "mailer-daemon", "postmaster", "@2x", "u003e",
];
const FILE_ENDINGS = /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|json|woff2?|ttf|eot|map|pdf|zip)$/i;

const PREFERRED_PREFIXES = ["sales", "hello", "contact", "info", "hi", "team", "partnerships", "business", "hr", "jobs", "careers", "recruit", "talent", "support", "office", "admin"];

const COMPANY_WORDS = /\b(inc|llc|ltd|limited|gmbh|ag|corp|corporation|co|company|group|holdings|plc|sa|bv|srl|pty|pvt|private|the)\b\.?/gi;

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const rootHost = (host: string) => host.toLowerCase().replace(/^www\./, "");
const hostOf = (url: string) => { try { return rootHost(new URL(url).hostname); } catch { return ""; } };
const hostMatches = (host: string, list: string[]) => list.some((d) => host === d || host.endsWith(`.${d}`));
export const isNotACompanySite = (host: string) => !host || hostMatches(host, NOT_A_COMPANY_SITE);

/** http(s) only, and never a local or private address (these URLs come from third-party feeds). */
function isPublicHttpUrl(value: string) {
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false;
    if (h.startsWith("[")) return false;
    return true;
  } catch { return false; }
}

/** Does this name (a LinkedIn slug or a web host) plausibly belong to this company? */
function nameMatchesCompany(company: string, candidate: string) {
  const c = norm(company.replace(COMPANY_WORDS, " "));
  const s = norm(candidate.replace(/\.[a-z]{2,}$/i, ""));
  if (c.length < 3 || s.length < 3) return false;
  if (s.includes(c) || c.includes(s)) return true;
  const first = norm(company.replace(COMPANY_WORDS, " ").trim().split(/\s+/)[0] ?? "");
  return first.length >= 4 && s.includes(first);
}

async function fetchHtml(url: string): Promise<string> {
  if (!isPublicHttpUrl(url)) return "";
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6_000),
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return "";
    const type = res.headers.get("content-type") ?? "";
    if (type && !/text\/html|application\/xhtml|text\/plain/i.test(type)) return "";
    return (await res.text()).slice(0, 1_500_000);
  } catch { return ""; }
}

/** Undo the common ways sites hide an address from scrapers. */
function deobfuscate(text: string) {
  return text
    .replace(/&#0*64;|&#x0*40;|&commat;|%40/gi, "@")
    .replace(/&#0*46;|&#x0*2e;|&period;/gi, ".")
    .replace(/\s*[\[(]\s*at\s*[\])]\s*/gi, "@")
    .replace(/\s*[\[(]\s*dot\s*[\])]\s*/gi, ".");
}

export function extractEmails(raw: string): string[] {
  const text = deobfuscate(raw);
  const found = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}/g) ?? [];
  const seen = new Set<string>();
  for (const item of found) {
    const email = item.toLowerCase().replace(/^[._%+-]+/, "");
    const domain = email.split("@")[1] ?? "";
    if (!domain || FILE_ENDINGS.test(email) || JUNK_EMAIL_PARTS.some((p) => email.includes(p))) continue;
    if (email.length > 120 || isNotACompanySite(domain)) continue;
    seen.add(email);
  }
  return [...seen];
}

export function extractLinkedIn(raw: string): string[] {
  const out = new Set<string>();
  for (const m of raw.matchAll(/https?:\\?\/\\?\/(?:[a-z]{2,3}\.)?linkedin\.com\\?\/(company|in)\\?\/([a-zA-Z0-9_%.-]+)/gi)) {
    const slug = m[2].replace(/[.]+$/, "");
    if (!slug || LINKEDIN_SLUG_BLOCKLIST.has(slug.toLowerCase())) continue;
    out.add(`https://www.linkedin.com/${m[1].toLowerCase()}/${slug}`);
  }
  return [...out];
}

function pickEmail(emails: string[], companyHost: string, company: string, requireCompanyMatch: boolean): string | null {
  const usable = requireCompanyMatch
    ? emails.filter((e) => { const d = e.split("@")[1]; return (companyHost && rootHost(d) === companyHost) || nameMatchesCompany(company, d); })
    : emails;
  if (!usable.length) return null;
  const score = (e: string) => {
    const [local, domain] = e.split("@");
    const sameDomain = companyHost && rootHost(domain) === companyHost ? 100 : nameMatchesCompany(company, domain) ? 50 : 0;
    const prefix = PREFERRED_PREFIXES.findIndex((p) => local === p || local.startsWith(`${p}.`) || local.startsWith(`${p}-`));
    return sameDomain + (prefix === -1 ? 0 : 20 - prefix);
  };
  return [...usable].sort((a, b) => score(b) - score(a))[0];
}

/** The company's own site, found with a web search. Only accepted when the address clearly carries the company's name. */
async function searchWebsite(company: string): Promise<string | null> {
  if (!env.TAVILY_API_KEY) return null;
  try {
    const results = await tavilySearch({ query: `${company} official website`, maxResults: 6 });
    for (const r of results) {
      const host = hostOf(r.url);
      if (isNotACompanySite(host)) continue;
      if (nameMatchesCompany(company, host)) return new URL(r.url).origin;
    }
  } catch { /* the search being down must not break saving */ }
  return null;
}

/**
 * @param company  name of the company ("Acme Inc")
 * @param urls     pages to read first. For a job posting this is the posting itself, for a lead it is the saved website.
 */
export async function findCompanyContact(input: { company: string; urls: Array<string | null | undefined>; known?: { email?: string | null; linkedinUrl?: string | null } }): Promise<FoundContact> {
  const company = input.company.trim();
  let email = input.known?.email ?? null;
  let linkedinUrl = input.known?.linkedinUrl ?? null;
  const urls = input.urls.filter((u): u is string => !!u && isPublicHttpUrl(u));

  // A page that is not a job board or social site is the company's own site.
  let website: string | null = null;
  for (const u of urls) {
    if (!isNotACompanySite(hostOf(u))) { website = new URL(u).origin; break; }
  }
  if (!website) website = await searchWebsite(company);
  const companyHost = website ? hostOf(website) : "";

  const pages = new Set<string>(urls);
  if (website) for (const path of ["", "/contact", "/contact-us", "/about", "/about-us", "/impressum", "/careers"]) pages.add(`${website}${path}`);

  // Read every page at the same time; keep the page address with its text so we know where each find came from.
  const bodies = await Promise.all([...pages].map(async (url) => ({ url, html: await fetchHtml(url) })));
  const ownSiteFirst = bodies.sort((a, b) => Number(hostOf(b.url) === companyHost) - Number(hostOf(a.url) === companyHost));

  if (!email) {
    const own = ownSiteFirst.filter((b) => companyHost && hostOf(b.url) === companyHost).flatMap((b) => extractEmails(b.html));
    email = pickEmail(own, companyHost, company, false);
    if (!email) {
      // an "apply by email" address on the posting itself
      const posting = ownSiteFirst.filter((b) => !companyHost || hostOf(b.url) !== companyHost).flatMap((b) => extractEmails(b.html));
      email = pickEmail(posting, companyHost, company, true);
    }
  }

  if (!linkedinUrl) {
    const own = ownSiteFirst.filter((b) => companyHost && hostOf(b.url) === companyHost).flatMap((b) => extractLinkedIn(b.html));
    linkedinUrl = own.find((l) => l.includes("/company/")) ?? own[0] ?? null;
    if (!linkedinUrl) {
      // links on a job board page are usually the board's own, so they must match the company's name
      const other = ownSiteFirst.filter((b) => !companyHost || hostOf(b.url) !== companyHost).flatMap((b) => extractLinkedIn(b.html));
      linkedinUrl = other.find((l) => nameMatchesCompany(company, l.split("/").pop() ?? "")) ?? null;
    }
  }

  // Last resort: a web search for the company's LinkedIn page and contact details.
  if ((!email || !linkedinUrl) && env.TAVILY_API_KEY) {
    try {
      const results = await tavilySearch({ query: `${company} linkedin company page contact email`, maxResults: 6 });
      for (const r of results) {
        if (!linkedinUrl) {
          const candidates = [r.url, ...extractLinkedIn(r.content)].flatMap((u) => extractLinkedIn(u));
          linkedinUrl = candidates.find((l) => l.includes("/company/") && nameMatchesCompany(company, l.split("/").pop() ?? "")) ?? null;
        }
        if (!email && !isNotACompanySite(hostOf(r.url))) {
          email = pickEmail(extractEmails(`${r.content} `), companyHost || hostOf(r.url), company, true);
        }
      }
    } catch { /* ignore */ }
  }

  return { email, linkedinUrl, websiteUrl: website };
}
