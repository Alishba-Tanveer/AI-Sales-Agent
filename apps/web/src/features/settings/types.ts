export type SettingsTabId =
  | "profile"
  | "business"
  | "team"
  | "outreach"
  | "governance"
  | "notifications"
  | "usage";

export type TeamRole = "Owner" | "Admin" | "Member";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  status: "Active" | "Invited";
};

export type MessageTone = "professional" | "friendly" | "direct";

export type NotificationRule = {
  id: string;
  title: string;
  badge: { label: string; tone: "primary" | "success" | "warning" | "destructive" };
  description: string;
  email: boolean;
  inApp: boolean;
};

/** GET/PATCH /api/users/me */
export type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleTitle: string;
  timezone: string;
  avatar: string | null;
  passwordChangedAt: string | null;
};

/** GET/PUT /api/settings/outreach */
export type OutreachSettings = {
  tone: MessageTone;
  followUps: number;
  gapDays: number;
  dailyCap: number;
  approved: boolean;
  approvedAt: string | null;
};

/** GET/PUT /api/settings/approval-rules */
export type ApprovalRules = {
  threshold: number;
  replies: boolean;
  followups: boolean;
  linkedin: boolean;
};

/** GET /api/settings/usage */
export type UsageInfo = {
  sentToday: number;
  dailyCap: number;
  aiSpendThisMonth: number;
  aiLimit: number;
  requestsToday: number;
  requestsDailyLimit: number;
  testMode: boolean;
};
