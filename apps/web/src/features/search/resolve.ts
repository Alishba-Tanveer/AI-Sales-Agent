/**
 * Turns what someone types in the top-bar search into a route.
 *   "lead"            -> /leads
 *   "settings team"   -> /settings?tab=team
 *   "team"            -> /settings?tab=team   (tab names that exist only in Settings)
 *   "linkedin content"-> /linkedin?tab=content
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
  { path: "profile", keys: ["profile", "account", "password", "security"] },
  { path: "business", keys: ["business", "company"] },
  { path: "team", keys: ["team", "members", "member", "invite", "roles"] },
  { path: "outreach", keys: ["outreach", "strategy", "cadence", "targeting"] },
  { path: "governance", keys: ["governance", "rules", "rule", "approval-rules"] },
  { path: "notifications", keys: ["notification", "notifications", "alerts", "alert"] },
  { path: "usage", keys: ["usage", "limits", "limit", "billing", "plan"] },
];
// Words only found in Settings, so typing just "team" still opens Settings > Team
const SETTINGS_ONLY = new Set(["team", "members", "member", "invite", "roles", "outreach", "governance", "notifications", "notification", "usage", "limits", "billing", "business", "alerts", "rules", "rule"]);

const LINKEDIN_TABS: Target[] = [
  { path: "content", keys: ["content", "posts", "post"] },
  { path: "connections", keys: ["connections", "connection", "network"] },
  { path: "profile", keys: ["profile"] },
];

const FILLER = new Set(["go", "to", "open", "show", "the", "page", "tab", "my", "and", "in", "of"]);

const matches = (t: Target, token: string) =>
  t.keys.some((k) => k === token || (token.length >= 3 && k.startsWith(token)));
const find = (list: Target[], token: string) => list.find((t) => matches(t, token));

export function resolveSearch(raw: string): string | null {
  const q = raw.trim().toLowerCase();
  if (!q) return null;
  const tokens = q.replace(/[>/,]+/g, " ").split(/\s+/).filter((t) => t && !FILLER.has(t));
  if (!tokens.length) return null;

  // "follow up" / "follow-up" are two words
  const joined = tokens.join("");
  if (joined === "followup" || joined === "followups") return "/follow-ups";

  const page = tokens.map((t) => find(PAGES, t)).find(Boolean);
  const leftover = (used: string[]) => tokens.filter((t) => !used.includes(t));

  // Settings (+ optional tab), also reachable by a settings-only tab name
  const settingsToken = tokens.find((t) => find(PAGES, t)?.path === "/settings");
  const settingsOnly = tokens.find((t) => SETTINGS_ONLY.has(t));
  if (settingsToken || settingsOnly) {
    const rest = tokens.filter((t) => t !== settingsToken);
    const tab = rest.map((t) => find(SETTINGS_TABS, t)).find(Boolean);
    return !tab || tab.path === "profile" ? "/settings" : `/settings?tab=${tab.path}`;
  }

  if (page?.path === "/linkedin") {
    const rest = tokens.filter((t) => find(PAGES, t)?.path !== "/linkedin");
    const tab = rest.map((t) => find(LINKEDIN_TABS, t)).find(Boolean);
    return !tab || tab.path === "profile" ? "/linkedin" : `/linkedin?tab=${tab.path}`;
  }

  if (page) {
    const used = tokens.filter((t) => find(PAGES, t) === page);
    const rest = leftover(used);
    // "lead john smith" -> leads page filtered by the extra words
    if (rest.length && page.path === "/leads") return `/leads?search=${encodeURIComponent(rest.join(" "))}`;
    if (!rest.length) return page.path;
  }

  return `/leads?search=${encodeURIComponent(raw.trim())}`;
}
