/**
 * Settings data layer. Every function calls the real backend (JWT is attached by lib/api.ts).
 *
 *   /api/users/me           profile, avatar, delete account
 *   /api/auth/*             change password, sign out other sessions
 *   /api/team/*             members + invitations
 *   /api/settings/*         outreach, notifications, usage
 *
 * The company/ideal-customer fields live on /api/onboarding (see features/onboarding/api.ts).
 */
import { api as baseApi, tokenStore } from "@/lib/api";
import { userStore } from "@/features/auth/user-store";
import type {
  MessageTone,
  NotificationRule,
  OutreachSettings,
  RemovedMember,
  TeamMember,
  TeamRole,
  UsageInfo,
  UserProfile,
} from "./types";
import { isPendingInvite } from "./types";

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
function patchStoredUser(p: { name?: string; email?: string; avatar?: string | null }) {
  const { avatar, ...rest } = p;
  const patch = avatar === undefined ? rest : { ...rest, avatar, avatarUrl: avatar };
  const u = userStore.get();
  if (u) userStore.set({ ...u, ...patch }, isRemembered());
}

/* ---------------- Profile & security ---------------- */

/** GET /api/users/me */
export const getProfile = () => unwrap(api<Res<UserProfile>>("/api/users/me"));

/** PATCH /api/users/me */
export async function saveProfile(v: { name: string; email: string; roleTitle: string; timezone: string }) {
  const profile = await unwrap(api<Res<UserProfile>>("/api/users/me", { method: "PATCH", body: json(v) }));
  patchStoredUser({ name: profile.name, email: profile.email, avatar: profile.avatar });
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
  const profile = await unwrap(api<Res<UserProfile>>("/api/users/me/avatar", { method: "POST", body: json({ avatar: dataUrl }) }));
  patchStoredUser({ avatar: profile.avatar });
  return profile;
}

/** DELETE /api/users/me/avatar */
export async function removeAvatar() {
  const profile = await unwrap(api<Res<UserProfile>>("/api/users/me/avatar", { method: "DELETE" }));
  patchStoredUser({ avatar: null });
  return profile;
}

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

/**
 * DELETE /api/users/me. Deactivates the account (30 day restore window). The caller signs out afterwards.
 * No password is needed. Admins and Members send nothing. An Owner who has a team must choose:
 *   { transferToId }       hand the workspace to that member, delete only the Owner's own login
 *   { deleteWorkspace }    delete the whole business for everyone
 */
export function deleteAccount(choice: { transferToId?: string; deleteWorkspace?: boolean } = {}) {
  return api<{ message: string; scope: "account" | "workspace" | "transfer"; restoreDeadline: string }>("/api/users/me", {
    method: "DELETE",
    body: json(choice),
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
  api<{ message: string }>(isPendingInvite(m) ? `/api/team/invitations/${m.id}` : `/api/team/members/${m.id}`, { method: "DELETE" });

/**
 * POST /api/team/members/:id/transfer-ownership (Owner only, no password).
 * The chosen active member becomes Owner and the caller becomes Admin. The server revokes the caller's sessions,
 * so the app must sign the caller out afterwards; they sign in again as an Admin.
 */
export const transferOwnership = (id: string) =>
  api<{ message?: string; signedOut?: boolean }>(`/api/team/members/${id}/transfer-ownership`, { method: "POST", body: json({}) });

/** Re-reads this person's role from the server. True when it changed (e.g. they were just made the Owner), so the app can reload. */
export async function syncRole(): Promise<boolean> {
  const p = await getProfile();
  const u = userStore.get();
  if (!u) return false;
  const role = (p.role ?? "").toUpperCase();
  const roleChanged = !!role && role !== (u.role ?? "").toUpperCase();
  // name and photo too: the sidebar reads them from the stored user, so a photo changed on another device shows up here
  const avatar = p.avatar ?? null;
  const profileChanged = (p.name && p.name !== u.name) || avatar !== (u.avatar ?? null);
  if (roleChanged || profileChanged) {
    userStore.set({ ...u, ...(roleChanged ? { role } : {}), name: p.name || u.name, avatar, avatarUrl: avatar }, isRemembered());
  }
  return roleChanged;
}

/** GET /api/team/members/removed (Owner/Admin): removed by an admin + deleted their own account, last 30 days */
export const listRemoved = () => unwrap(api<Res<RemovedMember[]>>("/api/team/members/removed"));

/** POST /api/team/members/:id/restore (only for people an admin removed) */
export const restoreMember = (id: string) =>
  api<Res<TeamMember>>(`/api/team/members/${id}/restore`, { method: "POST", body: json({}) });

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
