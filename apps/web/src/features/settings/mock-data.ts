import type { NotificationRule, TeamMember } from "./types";

/**
 * The backend only exposes /api/auth/* today, so Settings runs on local mock data.
 * Swap these for real calls in ./api.ts once the organizations/settings routes exist.
 */

export const TIMEZONES = [
  "(UTC-08:00) Pacific Time (US & Canada)",
  "(UTC-05:00) Eastern Time (US & Canada)",
  "(UTC+00:00) London, Dublin, Edinburgh",
  "(UTC+01:00) Amsterdam, Berlin, Paris",
  "(UTC+05:00) Islamabad, Karachi, Lahore",
];

export const DEFAULT_BUSINESS = {
  website: "https://example.com",
  industry: "B2B Software & Services",
  overview:
    "Performance outbound agency helping high-growth B2B software companies build autonomous outbound acquisition systems with verified inbox infrastructure.",
  services: "Outbound lead generation, Inbox warm-up & deliverability, AI SDR automation",
  icp: "Series A-C software companies with $2M-$20M ARR, 20-150 employees. Primary targets are VP Sales, Head of RevOps, and Chief Revenue Officers in North America and Western Europe looking to scale pipeline without hiring BDRs.",
};

export const DEFAULT_TEAM: Omit<TeamMember, "id">[] = [
  { name: "Sara Ali", email: "sara.ali@example.com", role: "Admin", status: "Active" },
  { name: "Usman Raza", email: "usman.raza@example.com", role: "Member", status: "Invited" },
];

export const DEFAULT_TARGETS = {
  industries: ["B2B SaaS", "FinTech", "Enterprise Software", "Logistics Tech"],
  titles: ["VP of Sales", "Head of Business Development", "Chief Revenue Officer (CRO)", "Director of Demand Gen"],
  locations: ["United States", "United Kingdom", "Canada"],
};

export const DEFAULT_NOTIFICATIONS: NotificationRule[] = [
  {
    id: "approvals",
    title: "Pending Approvals Queue",
    badge: { label: "Immediate", tone: "warning" },
    description: "Notify when drafts enter the Approvals queue waiting for sign-off.",
    email: true,
    inApp: true,
  },
  {
    id: "interested",
    title: "Interested Leads (Positive Reply Intent)",
    badge: { label: "P0 Highest Priority", tone: "success" },
    description: "Trigger instant webhook and notification when an AI sentiment analyzer flags positive buying sentiment.",
    email: true,
    inApp: true,
  },
  {
    id: "failures",
    title: "Failed Jobs & Sync Errors",
    badge: { label: "System Warning", tone: "destructive" },
    description: "Notify when mailbox SMTP warmup disconnects, LinkedIn session cookie invalidates, or scraping jobs abort.",
    email: true,
    inApp: false,
  },
  {
    id: "digest",
    title: "Daily Pipeline Summary Digest",
    badge: { label: "08:30 AM Daily", tone: "primary" },
    description: "Send an executive morning briefing with conversion analytics, email reply rates, and queued opportunities.",
    email: true,
    inApp: true,
  },
];

export const SENT_TODAY = 14;
