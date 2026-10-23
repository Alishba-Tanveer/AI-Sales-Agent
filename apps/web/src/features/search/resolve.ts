/**
 * Turns what someone types in the top-bar search into a route.
 *   "lead"            -> /leads
 *   "settings team"   -> /settings?tab=team
 *   "team"            -> /settings?tab=team   (every Settings tab name works on its own)
 *   "linkedin content"-> /linkedin?tab=content  ("content", "connections" alone work too)
 *   "lead john"       -> /leads?search=john
 *   anything else     -> /leads?search=<text>  (previous behaviour)
 */
type Target = { path: string; keys: string[] };

const PAGES: Target[] = [
  { path: "/overview", keys: ["overview", "dashboard", "home"] },
  { path: "/leads", keys: ["lead", "leads", "prospect", "prospects", "contact", "contacts"] },
  { path: "/find-opportunities", keys: ["opportunity", "opportunities", "find", "discover"] },
  { path: "/approvals", keys: ["approval", "approvals", "approve", "review"] },
  { path: "/inbox", keys: ["inbox", "email", "emails", "message", "messages", "reply", "replies"] },
  { path: "/follow-ups", keys: ["followup", "followups", "follow-up", "follow-ups"] },
  { path: "/activity", keys: ["activity", "activities", "log", "logs"] },
  { path: "/linkedin", keys: ["linkedin"] },
  { path: "/analytics", keys: ["analytic", "analytics", "report", "reports", "stats", "metrics"] },
  { path: "/integrations", keys: ["integration", "integrations", "connect", "apps"] },
  { path: "/settings", keys: ["setting", "settings", "preferences", "config"] },
];

const SETTINGS_TABS: Target[] = [
  { path: "profile", keys: ["profile", "account", "password", "security", "personal"] },
  { path: "business", keys: ["business", "company", "workspace"] },
  { path: "team", keys: ["team", "members", "member", "invite", "invitations", "roles", "role"] },
  { path: "outreach", keys: ["outreach", "strategy", "cadence", "targeting", "tone"] },
  { path: "governance", keys: ["governance", "rules", "rule", "approval-rules", "approvalrules"] },
  { path: "notifications", keys: ["notification", "notifications", "notify", "alerts", "alert"] },
  { path: "usage", keys: ["usage", "limits", "limit", "billing", "plan", "spend"] },
];

const LINKEDIN_TABS: Target[] = [
  { path: "content", keys: ["content", "posts", "post", "engine"] },
  { path: "connections", keys: ["connections", "connection", "network"] },
  { path: "profile", keys: ["profile", "optimizer", "optimiser"] },
];

const FILLER = new Set(["go", "to", "open", "show", "the", "page", "tab", "my", "and", "in", "of", "on", "for"]);

const matches = (t: Target, token: string) =>
  t.keys.some((k) => k === token || (token.length >= 3 && k.startsWith(token)));
const find = (list: Target[], token: string) => list.find((t) => matches(t, token));
const findExact = (list: Target[], token: string) => list.find((t) => t.keys.includes(token));

const settingsHref = (tab?: Target) => (!tab || tab.path === "profile" ? "/settings" : `/settings?tab=${tab.path}`);
const linkedinHref = (tab?: Target) => (!tab || tab.path === "profile" ? "/linkedin" : `/linkedin?tab=${tab.path}`);

export function resolveSearch(raw: string): string | null {
  const q = raw.trim().toLowerCase();
  if (!q) return null;
  const tokens = q.replace(/[>/,]+/g, " ").split(/\s+/).filter((t) => t && !FILLER.has(t));
  if (!tokens.length) return null;

  // "follow up" / "follow-up" are two words
  const joined = tokens.join("");
  if (joined === "followup" || joined === "followups") return "/follow-ups";

  const pageOf = (t: string) => find(PAGES, t);
  const settingsToken = tokens.find((t) => pageOf(t)?.path === "/settings");
  const linkedinToken = tokens.find((t) => pageOf(t)?.path === "/linkedin");

  // 1. LinkedIn (+ optional tab). "linkedin profile" stays here; "profile" on its own is Settings > Profile.
  if (linkedinToken && !settingsToken) {
    const tab = tokens.filter((t) => t !== linkedinToken).map((t) => find(LINKEDIN_TABS, t)).find(Boolean);
    return linkedinHref(tab);
  }

  // 2. Settings (+ optional tab). A tab name typed alone ("team", "usage", "profile", "notifications"...) also opens its tab.
  const tabOnlyToken = tokens.find((t) => findExact(SETTINGS_TABS, t));
  if (settingsToken || tabOnlyToken) {
    const tab = tokens.filter((t) => t !== settingsToken).map((t) => find(SETTINGS_TABS, t)).find(Boolean);
    return settingsHref(tab);
  }

  // 3. LinkedIn-only tab names typed alone ("content", "connections", "posts")
  const liOnly = tokens.map((t) => findExact(LINKEDIN_TABS, t)).find(Boolean);
  if (liOnly) return linkedinHref(liOnly);

  // 4. Any other page
  const page = tokens.map(pageOf).find(Boolean);
  if (page) {
    const used = tokens.filter((t) => pageOf(t) === page);
    const rest = tokens.filter((t) => !used.includes(t));
    // "lead john smith" -> leads page filtered by the extra words
    if (rest.length && page.path === "/leads") return `/leads?search=${encodeURIComponent(rest.join(" "))}`;
    if (!rest.length) return page.path;
  }

  return `/leads?search=${encodeURIComponent(raw.trim())}`;
}
