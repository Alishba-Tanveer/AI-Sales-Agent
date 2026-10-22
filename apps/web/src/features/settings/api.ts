/**
 * Settings data layer. Every function calls the real backend (JWT is attached by lib/api.ts).
 *
 *   /api/users/me           profile, avatar, delete account
 *   /api/auth/*             change password, sign out other sessions
 *   /api/team/*             members + invitations
 *   /api/settings/*         outreach, approval rules, notifications, usage, test mode
 *
 * The company/ideal-customer fields live on /api/onboarding (see features/onboarding/api.ts).
 */
import { api as baseApi, tokenStore } from "@/lib/api";
import { userStore } from "@/features/auth/user-store";
import type {
  ApprovalRules,
  MessageTone,
  NotificationRule,
  OutreachSettings,
  TeamMember,
  TeamRole,
  UsageInfo,
  UserProfile,
} from "./types";

/**
 * These pages show the server's error message instead of signing the person out when a request is rejected
 * (an expired session is still caught by AuthGuard on the next page load).
 */
const api = <T,>(path: string, init: RequestInit = {}) => baseApi<T>(path, { keepSessionOn401: true, ...init });

type Res<T> = { message?: string; data: T };

const json = (body: unknown) => JSON.stringify(body);
const unwrap = async <T,>(p: Promise<Res<T>>) => (await p).data;

/** Same "remember me" rule the login uses: token in localStorage = remembered. */
const isRemembered = () => typeof window !== "undefined" && localStorage.getItem("token") !== null;

/** Keep the name/email shown in the sidebar in sync after the profile is saved. */
function patchStoredUser(p: { name?: string; email?: string }) {
  const u = userStore.get();
  if (u) userStore.set({ ...u, ...p }, isRemembered());
}

/* ---------------- Profile & security ---------------- */

/** GET /api/users/me */
export const getProfile = () => unwrap(api<Res<UserProfile>>("/api/users/me"));

/** PATCH /api/users/me */
export async function saveProfile(v: { name: string; email: string; roleTitle: string; timezone: string }) {
  const profile = await unwrap(api<Res<UserProfile>>("/api/users/me", { method: "PATCH", body: json(v) }));
  patchStoredUser({ name: profile.name, email: profile.email });
  return profile;
}

/** POST /api/users/me/avatar  (JSON with a base64 data URL; the backend accepts JPG/PNG/WEBP up to 2MB) */
export async function uploadAvatar(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read that image."));
    r.readAsDataURL(file);
  });
  return unwrap(api<Res<UserProfile>>("/api/users/me/avatar", { method: "POST", body: json({ avatar: dataUrl }) }));
}

/** DELETE /api/users/me/avatar */
export const removeAvatar = () => unwrap(api<Res<UserProfile>>("/api/users/me/avatar", { method: "DELETE" }));

/** POST /api/auth/change-password. Throws ApiError(400) when the current password is wrong. */
export function changePassword(currentPassword: string, newPassword: string) {
  return unwrap(
    api<Res<{ passwordChangedAt: string }>>("/api/auth/change-password", {
      method: "POST",
      body: json({ currentPassword, newPassword }),
    }),
  );
}

/** POST /api/auth/logout-others. The backend hands back a fresh token for THIS device; every other token stops working. */
export async function signOutOtherSessions() {
  const res = await api<Res<{ token: string }>>("/api/auth/logout-others", { method: "POST", body: json({}) });
  tokenStore.set(res.data.token, isRemembered());
}

/** DELETE /api/users/me. Deactivates the account (30 day restore window). The caller signs out afterwards. */
export function deleteAccount(password: string) {
  return api<{ message: string; restoreDeadline: string }>("/api/users/me", {
    method: "DELETE",
    body: json({ password, confirm: "DELETE" }),
  });
}

/* ---------------- Team ---------------- */

/** GET /api/team/members  ->  active members followed by pending invitations */
export const listTeam = () => unwrap(api<Res<TeamMember[]>>("/api/team/members"));

/** POST /api/team/invitations */
export const inviteMember = (email: string, role: TeamRole) =>
  api<Res<TeamMember>>("/api/team/invitations", { method: "POST", body: json({ email, role }) });

/** POST /api/team/invitations/:id/resend */
export const resendInvite = (id: string) => api<Res<TeamMember>>(`/api/team/invitations/${id}/resend`, { method: "POST", body: json({}) });

/** PATCH /api/team/members/:id  (also works with a pending invitation id) */
export const changeMemberRole = (id: string, role: TeamRole) =>
  api<Res<TeamMember>>(`/api/team/members/${id}`, { method: "PATCH", body: json({ role }) });

/** DELETE /api/team/members/:id for members, DELETE /api/team/invitations/:id for pending invites */
export const removeTeamEntry = (m: Pick<TeamMember, "id" | "status">) =>
  api<{ message: string }>(m.status === "Invited" ? `/api/team/invitations/${m.id}` : `/api/team/members/${m.id}`, { method: "DELETE" });

/* ---------------- Outreach strategy ---------------- */

type OutreachDto = {
  tone: MessageTone;
  maxFollowUps: number;
  intervalDays: number;
  dailyCap: number;
  approved: boolean;
  approvedAt: string | null;
};
const fromOutreach = (o: OutreachDto): OutreachSettings => ({
  tone: o.tone,
  followUps: o.maxFollowUps,
  gapDays: o.intervalDays,
  dailyCap: o.dailyCap,
  approved: !!o.approved,
  approvedAt: o.approvedAt ?? null,
});
type OutreachInput = Pick<OutreachSettings, "tone" | "followUps" | "gapDays" | "dailyCap">;
const outreachBody = (v: OutreachInput) => json({ tone: v.tone, maxFollowUps: v.followUps, intervalDays: v.gapDays, dailyCap: v.dailyCap });

/** GET /api/settings/outreach */
export const getOutreach = async () => fromOutreach(await unwrap(api<Res<OutreachDto>>("/api/settings/outreach")));

/** POST /api/settings/outreach/approve  (saves the numbers AND marks the strategy approved) */
export async function approveOutreach(v: OutreachInput) {
  const res = await api<Res<OutreachDto>>("/api/settings/outreach/approve", { method: "POST", body: outreachBody(v) });
  return { settings: fromOutreach(res.data), message: res.message };
}

/* ---------------- Approval rules ---------------- */

/** GET /api/settings/approval-rules */
export const getApprovalRules = () => unwrap(api<Res<ApprovalRules>>("/api/settings/approval-rules"));

/** PUT /api/settings/approval-rules */
export const saveApprovalRules = (v: ApprovalRules) =>
  unwrap(api<Res<ApprovalRules>>("/api/settings/approval-rules", { method: "PUT", body: json(v) }));

/* ---------------- Notifications ---------------- */

/** GET /api/settings/notifications */
export const getNotifications = () => unwrap(api<Res<NotificationRule[]>>("/api/settings/notifications"));

/** PUT /api/settings/notifications */
export const saveNotifications = (rules: NotificationRule[]) =>
  unwrap(
    api<Res<NotificationRule[]>>("/api/settings/notifications", {
      method: "PUT",
      body: json(rules.map((r) => ({ id: r.id, email: r.email, inApp: r.inApp }))),
    }),
  );

/* ---------------- Usage & limits ---------------- */

/** GET /api/settings/usage */
export const getUsage = () => unwrap(api<Res<UsageInfo>>("/api/settings/usage"));

/** PUT /api/settings/usage/ai-limit */
export const saveAiLimit = (aiLimit: number) => unwrap(api<Res<UsageInfo>>("/api/settings/usage/ai-limit", { method: "PUT", body: json({ aiLimit }) }));
