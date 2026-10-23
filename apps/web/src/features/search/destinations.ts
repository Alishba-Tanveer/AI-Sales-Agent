import {
  Activity, BarChart3, Bell, Building2, CircleUser, Clock, Compass, Inbox, LayoutGrid, ListChecks, Megaphone,
  Network, Newspaper, Puzzle, Search, Settings, ShieldCheck, SlidersHorizontal, User, Users,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/permissions";
import { resolveSearch } from "./resolve";

/**
 * Everything the top-bar search can open: each page, each Settings tab and each LinkedIn tab.
 * Matching is by label, group and keywords, so typing "invite" suggests Settings > Team.
 * Tabs that a role cannot see in the app are not suggested to that role (same rules as settings-page.tsx / nav-config.ts).
 */
type Group = "Page" | "Settings" | "LinkedIn";

type Destination = {
  label: string;
  group: Group;
  href: string;
  icon: LucideIcon;
  keywords: string[];
  allow?: (role: AppRole) => boolean;
};

export type Suggestion = { key: string; label: string; kind: string; href: string; icon: LucideIcon };

const ownerOrAdmin = (r: AppRole) => r === "OWNER" || r === "ADMIN";
const ownerOnly = (r: AppRole) => r === "OWNER";

const DESTINATIONS: Destination[] = [
  { label: "Overview", group: "Page", href: "/overview", icon: LayoutGrid, keywords: ["dashboard", "home", "metrics"] },
  { label: "Leads", group: "Page", href: "/leads", icon: Users, keywords: ["lead", "prospects", "contacts", "pipeline"] },
  { label: "Find Opportunities", group: "Page", href: "/find-opportunities", icon: Compass, keywords: ["opportunities", "opportunity", "find", "discover", "jobs"] },
  { label: "Approvals", group: "Page", href: "/approvals", icon: ListChecks, keywords: ["approval", "approve", "review", "drafts"] },
  { label: "Inbox", group: "Page", href: "/inbox", icon: Inbox, keywords: ["email", "emails", "messages", "replies", "reply"] },
  { label: "Follow-ups", group: "Page", href: "/follow-ups", icon: Clock, keywords: ["followup", "followups", "follow up", "reminders"] },
  { label: "Activity", group: "Page", href: "/activity", icon: Activity, keywords: ["log", "logs", "history", "events"] },
  { label: "Analytics", group: "Page", href: "/analytics", icon: BarChart3, keywords: ["reports", "report", "stats", "metrics", "charts"] },
  { label: "Integrations", group: "Page", href: "/integrations", icon: Puzzle, keywords: ["connect", "apps", "gmail", "email accounts"], allow: ownerOrAdmin },
  { label: "Settings", group: "Page", href: "/settings", icon: Settings, keywords: ["preferences", "config", "configuration"] },

  { label: "Profile", group: "Settings", href: "/settings", icon: User, keywords: ["account", "password", "security", "personal", "sessions", "sign out", "delete account", "timezone"] },
  { label: "Business", group: "Settings", href: "/settings?tab=business", icon: Building2, keywords: ["company", "workspace", "icp", "industry"], allow: ownerOrAdmin },
  { label: "Team", group: "Settings", href: "/settings?tab=team", icon: Users, keywords: ["members", "member", "invite", "invitations", "roles", "role", "admin", "owner", "remove", "restore"] },
  { label: "Outreach Strategy", group: "Settings", href: "/settings?tab=outreach", icon: Megaphone, keywords: ["outreach", "strategy", "cadence", "targeting", "tone", "daily cap"], allow: ownerOrAdmin },
  { label: "Approval Rules", group: "Settings", href: "/settings?tab=governance", icon: ShieldCheck, keywords: ["governance", "rules", "rule", "threshold", "approval"], allow: ownerOrAdmin },
  { label: "Notifications", group: "Settings", href: "/settings?tab=notifications", icon: Bell, keywords: ["notification", "notify", "alerts", "alert", "email alerts"] },
  { label: "Usage and Limits", group: "Settings", href: "/settings?tab=usage", icon: SlidersHorizontal, keywords: ["usage", "limits", "limit", "billing", "plan", "spend", "ai spend"], allow: ownerOnly },

  { label: "Profile", group: "LinkedIn", href: "/linkedin", icon: CircleUser, keywords: ["optimizer", "linkedin profile", "headline", "about"] },
  { label: "Content", group: "LinkedIn", href: "/linkedin?tab=content", icon: Newspaper, keywords: ["posts", "post", "engine", "ideas", "schedule"] },
  { label: "Connections", group: "LinkedIn", href: "/linkedin?tab=connections", icon: Network, keywords: ["connection", "network", "requests"] },
];

const FILLER = new Set(["go", "to", "open", "show", "the", "page", "tab", "my", "and", "in", "of", "on", "for"]);
const words = (s: string) => s.toLowerCase().split(/[\s-]+/).filter(Boolean);

/** How well one typed word matches a destination (0 = not at all). */
function tokenScore(d: Destination, token: string): number {
  const label = d.label.toLowerCase();
  if (label === token) return 100;
  if (words(d.label).some((w) => w === token)) return 90;
  if (words(d.label).some((w) => w.startsWith(token))) return 80;
  if (d.keywords.some((k) => k === token || words(k).includes(token))) return 70;
  if (token.length >= 2 && d.keywords.some((k) => words(k).some((w) => w.startsWith(token)))) return 50;
  if (token.length >= 3 && d.group.toLowerCase().startsWith(token) && d.group !== "Page") return 25;
  if (token.length >= 3 && label.includes(token)) return 20;
  return 0;
}

const kindOf = (d: Destination) => (d.group === "Page" ? "Page" : `${d.group} tab`);

/** Suggestions for what was typed: matching pages/tabs first (best match first), then "Search leads for ...". */
export function buildSuggestions(raw: string, role: AppRole, max = 8): Suggestion[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.replace(/[>/,]+/g, " ").split(/\s+/).filter((t) => t && !FILLER.has(t));

  const ranked = tokens.length
    ? DESTINATIONS.map((d, i) => ({ d, i, scores: tokens.map((t) => tokenScore(d, t)) }))
        .filter(({ d, scores }) => (!d.allow || d.allow(role)) && scores.every((s) => s > 0))
        .map((x) => ({ ...x, total: x.scores.reduce((a, b) => a + b, 0) + (x.d.group === "Page" ? 15 : 0) })) // a page beats a tab of equal match
        .sort((a, b) => b.total - a.total || a.i - b.i)
    : [];

  const out: Suggestion[] = ranked.slice(0, max).map(({ d }) => ({ key: `${d.group}:${d.label}`, label: d.group === "Page" ? d.label : `${d.group} › ${d.label}`, kind: kindOf(d), href: d.href, icon: d.icon }));

  // Last row: search the Leads list. "lead john" searches for "john", other text is searched as typed.
  const resolved = resolveSearch(raw);
  const term = resolved?.startsWith("/leads?search=") ? decodeURIComponent(resolved.slice("/leads?search=".length)) : raw.trim();
  out.push({ key: "search-leads", label: `Search leads for “${term}”`, kind: "Search", href: `/leads?search=${encodeURIComponent(term)}`, icon: Search });
  return out;
}
