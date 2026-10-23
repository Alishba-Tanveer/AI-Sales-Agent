import { userStore } from "./user-store";

/**
 * Who can do what. This only decides what the UI shows: the backend must enforce the same rules on every request,
 * because the role stored in the browser can be edited by the person using it.
 *
 *   Owner   one per workspace. Everything, including usage limits, ownership transfer and deleting the workspace.
 *   Admin   runs the workspace day to day: business details, outreach, approval rules, integrations, team.
 *   Member  works the pipeline: leads, drafts, replies, approvals. No workspace configuration.
 */
export type Role = "OWNER" | "ADMIN" | "MEMBER";

export type Permission =
  | "workspace.edit" // business details, outreach strategy, approval rules
  | "integrations.manage"
  | "team.manage" // invite, remove, change roles, restore removed accounts
  | "usage.manage" // usage limits, AI spend, billing
  | "workspace.delete"; // delete workspace, transfer ownership

const MATRIX: Record<Permission, Role[]> = {
  "workspace.edit": ["OWNER", "ADMIN"],
  "integrations.manage": ["OWNER", "ADMIN"],
  "team.manage": ["OWNER", "ADMIN"],
  "usage.manage": ["OWNER"],
  "workspace.delete": ["OWNER"],
};

/** Anything unknown is treated as Member: the least access. */
export function normalizeRole(role?: string | null): Role {
  const r = (role ?? "").toUpperCase();
  return r === "OWNER" || r === "ADMIN" ? r : "MEMBER";
}

export const can = (role: Role, permission: Permission) => MATRIX[permission].includes(role);

/** The signed-in person's role (kept fresh from the server by ProfileSync when the dashboard opens). */
export const currentRole = (): Role => normalizeRole(userStore.get()?.role);

export const roleLabel = (role: Role) => role.charAt(0) + role.slice(1).toLowerCase();
