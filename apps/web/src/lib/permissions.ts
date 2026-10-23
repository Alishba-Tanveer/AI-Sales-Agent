import { userStore } from "@/features/auth/user-store";

export type AppRole = "OWNER" | "ADMIN" | "MEMBER";

/**
 * Who can do what. This only decides what the UI shows; the backend is the real gate
 * (settings.routes.ts, onboarding.routes.ts, team.service.ts) and answers 403 regardless.
 *
 *   Action                                         Owner  Admin  Member
 *   View leads, inbox, activity, analytics          yes    yes    yes
 *   Review and approve drafts and replies           yes    yes    yes
 *   Edit outreach, approval rules, business / ICP   yes    yes    -
 *   Connect integrations                            yes    yes    -
 *   Invite / remove people, change roles            yes    yes (not Owners)  -
 *   Restore removed accounts                        yes    yes    -
 *   Usage limits, AI spend, billing                 yes    -      -
 *   Transfer ownership, delete workspace            yes    -      -
 */
export function currentRole(): AppRole {
  const r = (userStore.get()?.role ?? "").toUpperCase();
  return r === "OWNER" || r === "ADMIN" ? r : "MEMBER";
}

const isOwner = (r: AppRole) => r === "OWNER";
const isOwnerOrAdmin = (r: AppRole) => r === "OWNER" || r === "ADMIN";

export const can = {
  editWorkspaceSettings: isOwnerOrAdmin, // business, outreach strategy, approval rules
  connectIntegrations: isOwnerOrAdmin,
  manageTeam: isOwnerOrAdmin, // invite, remove, change roles, restore
  manageUsageAndBilling: isOwner,
  transferOrDeleteWorkspace: isOwner,
};
