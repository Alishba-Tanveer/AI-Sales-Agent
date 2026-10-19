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
