import {
  Activity,
  BarChart3,
  CircleUser,
  Compass,
  Inbox,
  LayoutGrid,
  Network,
  Newspaper,
  Puzzle,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavBadgeKey = "activity" | "opportunities" | "leads" | "inbox" | "content" | "connections";

/**
 * One theme colour per counter, so each page's pill is recognisable at a glance. Top to bottom the pills go
 * indigo, amber, violet, sky, pink, teal: no two neighbours share a colour (and none are near-identical hues).
 */
export type NavBadgeTone = "destructive" | "warning" | "primary" | "violet" | "pink" | "teal" | "info" | "success";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hidden from Members (Owner and Admin only) */
  adminOnly?: boolean;
  /** Shows a live count pill (value comes from useNavCounts) */
  badge?: { key: NavBadgeKey; tone: NavBadgeTone };
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Overview", href: "/overview", icon: LayoutGrid },
      { label: "Leads", href: "/leads", icon: Users, badge: { key: "leads", tone: "info" } },
      { label: "Find Opportunities", href: "/find-opportunities", icon: Compass, badge: { key: "opportunities", tone: "warning" } },
      { label: "Inbox", href: "/inbox", icon: Inbox, badge: { key: "inbox", tone: "pink" } },
      { label: "Activity", href: "/activity", icon: Activity, badge: { key: "activity", tone: "violet" } },
    ],
  },
  {
    title: "LinkedIn",
    items: [
      { label: "Profile", href: "/linkedin", icon: CircleUser },
      { label: "Content", href: "/linkedin?tab=content", icon: Newspaper, badge: { key: "content", tone: "success" } },
      { label: "Connections", href: "/linkedin?tab=connections", icon: Network, badge: { key: "connections", tone: "warning" } },
    ],
  },
  {
    title: "Workspace",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Integrations", href: "/integrations", icon: Puzzle, adminOnly: true },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

/** Active when the path matches; the 3 LinkedIn items are told apart by ?tab= */
export function isNavActive(item: NavItem, pathname: string, tab: string | null) {
  const [path, query] = item.href.split("?");
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
  if (path === "/linkedin") {
    const itemTab = new URLSearchParams(query).get("tab") ?? "profile";
    return (tab ?? "profile") === itemTab;
  }
  return true;
}
