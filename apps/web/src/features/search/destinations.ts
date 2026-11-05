import {
  Activity, BarChart3, Bell, Building2, CalendarClock, CalendarDays, CheckCircle2, CircleUser, Clock, Compass, Handshake,
  Heart, Hourglass, Inbox, LayoutGrid, Megaphone, Network, Newspaper, PlayCircle, Puzzle, Search, Send, Settings,
  SlidersHorizontal, Sparkles, ThumbsDown, Trophy, User, UserCheck, UserPlus, Users, XCircle, ShieldOff, FileCheck2,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/permissions";
import { parseLookup, type Lookup } from "./resolve";

/**
 * Everything the top-bar search can open: each page, each Settings tab and each LinkedIn tab.
 * Matching is by label, group and keywords, so typing "invite" suggests Settings > Team.
 * Tabs that a role cannot see in the app are not suggested to that role (same rules as settings-page.tsx / nav-config.ts).
 */
type Group = "Page" | "Settings" | "LinkedIn" | "Leads" | "Activity" | "Analytics" | "Connections" | "Content";

type Destination = {
  label: string;
  group: Group;
  href: string;
  icon: LucideIcon;
  keywords: string[];
  allow?: (role: AppRole) => boolean;
};

/** A suggestion either opens a route (href) or looks a person up first (lookup), because that needs the server. */
export type Suggestion = { key: string; label: string; kind: string; icon: LucideIcon } & ({ href: string; lookup?: undefined } | { lookup: Lookup; href?: undefined });

const ownerOrAdmin = (r: AppRole) => r === "OWNER" || r === "ADMIN";
const ownerOnly = (r: AppRole) => r === "OWNER";

const DESTINATIONS: Destination[] = [
  { label: "Overview", group: "Page", href: "/overview", icon: LayoutGrid, keywords: ["dashboard", "home", "metrics"] },
  { label: "Leads", group: "Page", href: "/leads", icon: Users, keywords: ["lead", "prospects", "contacts", "pipeline"] },
  { label: "Find Opportunities", group: "Page", href: "/find-opportunities", icon: Compass, keywords: ["opportunities", "opportunity", "find", "discover", "jobs"] },
  { label: "Inbox", group: "Page", href: "/inbox", icon: Inbox, keywords: ["email", "emails", "messages", "replies", "reply"] },
  { label: "Activity", group: "Page", href: "/activity", icon: Activity, keywords: ["log", "logs", "history", "events"] },
  { label: "Analytics", group: "Page", href: "/analytics", icon: BarChart3, keywords: ["reports", "report", "stats", "metrics", "charts"] },
  { label: "Integrations", group: "Page", href: "/integrations", icon: Puzzle, keywords: ["connect", "apps", "gmail", "email accounts"], allow: ownerOrAdmin },
  { label: "Settings", group: "Page", href: "/settings", icon: Settings, keywords: ["preferences", "config", "configuration"] },

  { label: "New", group: "Leads", href: "/leads?stage=NEW", icon: UserPlus, keywords: ["new leads", "fresh", "uncontacted"] },
  { label: "Contacted", group: "Leads", href: "/leads?stage=CONTACTED", icon: Send, keywords: ["contacted leads", "reached out", "sent"] },
  { label: "Interested", group: "Leads", href: "/leads?stage=INTERESTED", icon: Heart, keywords: ["interested leads", "warm", "replied"] },
  { label: "Won", group: "Leads", href: "/leads?stage=WON", icon: Trophy, keywords: ["won leads", "customers", "closed", "deals"] },
  { label: "Lost", group: "Leads", href: "/leads?stage=LOST", icon: ThumbsDown, keywords: ["lost leads", "declined"] },
  { label: "Do not contact", group: "Leads", href: "/leads?stage=DO_NOT_CONTACT", icon: ShieldOff, keywords: ["dnc", "blocked", "unsubscribed", "opted out"] },

  { label: "Running", group: "Activity", href: "/activity?tab=running", icon: PlayCircle, keywords: ["in progress", "jobs running", "active"] },
  { label: "Failed", group: "Activity", href: "/activity?tab=failed", icon: XCircle, keywords: ["errors", "error", "failures", "broken"] },
  { label: "Completed", group: "Activity", href: "/activity?tab=completed", icon: CheckCircle2, keywords: ["done", "finished", "success", "succeeded"] },

  { label: "Today", group: "Analytics", href: "/analytics?period=today", icon: Clock, keywords: ["24 hours", "daily"] },
  { label: "Last 7 days", group: "Analytics", href: "/analytics?period=7d", icon: CalendarDays, keywords: ["7d", "week", "weekly", "seven days"] },
  { label: "Last 30 days", group: "Analytics", href: "/analytics?period=30d", icon: CalendarDays, keywords: ["30d", "month", "monthly", "thirty days"] },
  { label: "All time", group: "Analytics", href: "/analytics?period=all", icon: CalendarClock, keywords: ["everything", "lifetime", "overall", "total"] },

  { label: "Profile", group: "Settings", href: "/settings", icon: User, keywords: ["account", "password", "security", "personal", "sessions", "sign out", "delete account", "timezone"] },
  { label: "Business", group: "Settings", href: "/settings?tab=business", icon: Building2, keywords: ["company", "workspace", "icp", "industry"], allow: ownerOrAdmin },
  { label: "Team", group: "Settings", href: "/settings?tab=team", icon: Users, keywords: ["members", "member", "invite", "invitations", "roles", "role", "admin", "owner", "remove", "restore"] },
  { label: "Outreach Strategy", group: "Settings", href: "/settings?tab=outreach", icon: Megaphone, keywords: ["outreach", "strategy", "cadence", "targeting", "tone", "daily cap"], allow: ownerOrAdmin },
  { label: "Notifications", group: "Settings", href: "/settings?tab=notifications", icon: Bell, keywords: ["notification", "notify", "alerts", "alert", "email alerts"] },
  { label: "Usage and Limits", group: "Settings", href: "/settings?tab=usage", icon: SlidersHorizontal, keywords: ["usage", "limits", "limit", "billing", "plan", "spend", "ai spend"], allow: ownerOnly },

  { label: "Profile", group: "LinkedIn", href: "/linkedin", icon: CircleUser, keywords: ["optimizer", "linkedin profile", "headline", "about"] },
  { label: "Content", group: "LinkedIn", href: "/linkedin?tab=content", icon: Newspaper, keywords: ["posts", "post", "engine", "ideas", "schedule"] },
  { label: "Connections", group: "LinkedIn", href: "/linkedin?tab=connections", icon: Network, keywords: ["connection", "network", "requests"] },

  { label: "People who engaged", group: "Connections", href: "/linkedin?tab=connections&list=engaged", icon: Heart, keywords: ["engaged", "engagement", "likes", "comments", "viewers", "views"] },
  { label: "Target buyers", group: "Connections", href: "/linkedin?tab=connections&list=buyers", icon: Handshake, keywords: ["buyer", "buyers", "target", "targets", "icp", "ideal customers"] },
  { label: "Pending", group: "Connections", href: "/linkedin?tab=connections&list=pending", icon: Hourglass, keywords: ["pending requests", "waiting", "sent requests"] },
  { label: "Connected", group: "Connections", href: "/linkedin?tab=connections&list=connected", icon: UserCheck, keywords: ["accepted", "my connections", "network"] },

  { label: "Needs approval", group: "Content", href: "/linkedin?tab=content&contentTab=approval", icon: FileCheck2, keywords: ["approval", "approve", "drafts", "draft", "review", "pending posts"] },
  { label: "Scheduled", group: "Content", href: "/linkedin?tab=content&contentTab=scheduled", icon: CalendarClock, keywords: ["schedule", "upcoming", "ready to record", "queued"] },
  { label: "Posted", group: "Content", href: "/linkedin?tab=content&contentTab=posted", icon: Sparkles, keywords: ["published", "live", "done posts"] },
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

  // Last row: look a person up. "inbox alishba" opens Alishba's conversation in the Inbox, "lead john" or "john" searches Leads.
  // Nothing is shown here for a typed word that is neither a page, a tab nor a possible name ("analytics foo").
  const lookup = parseLookup(raw);
  if (lookup) {
    out.push(lookup.scope === "inbox"
      ? { key: "lookup-inbox", label: `Open Inbox conversation with “${lookup.term}”`, kind: "Inbox", lookup, icon: Inbox }
      : { key: "lookup-leads", label: `Search leads for “${lookup.term}”`, kind: "Search", lookup, icon: Search });
  }
  return out;
}
