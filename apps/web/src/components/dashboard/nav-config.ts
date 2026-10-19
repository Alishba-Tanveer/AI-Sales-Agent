import {
  Activity,
  BarChart3,
  CircleUser,
  Clock,
  Compass,
  Inbox,
  LayoutGrid,
  ListChecks,
  Network,
  Newspaper,
  Puzzle,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavBadgeKey = "approvals" | "activity";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Shows a live count pill (value comes from useNavCounts) */
  badge?: { key: NavBadgeKey; tone: "warning" | "destructive" };
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Overview", href: "/overview", icon: LayoutGrid },
      { label: "Leads", href: "/leads", icon: Users },
      { label: "Find Opportunities", href: "/find-opportunities", icon: Compass },
      { label: "Approvals", href: "/approvals", icon: ListChecks, badge: { key: "approvals", tone: "warning" } },
      { label: "Inbox", href: "/inbox", icon: Inbox },
      { label: "Follow-ups", href: "/follow-ups", icon: Clock },
      { label: "Activity", href: "/activity", icon: Activity, badge: { key: "activity", tone: "destructive" } },
    ],
  },
  {
    title: "LinkedIn",
    items: [
      { label: "Profile", href: "/linkedin", icon: CircleUser },
      { label: "Content", href: "/linkedin?tab=content", icon: Newspaper },
      { label: "Connections", href: "/linkedin?tab=connections", icon: Network },
    ],
  },
  {
    title: "Workspace",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Integrations", href: "/integrations", icon: Puzzle },
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
