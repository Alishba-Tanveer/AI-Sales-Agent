import { toast } from "sonner";
import { api, tokenStore } from "@/lib/api";
import type { SignupValues } from "./schemas";
import { userStore } from "./user-store";
import { resetSetupReminder } from "@/features/onboarding/status";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  organization: { id: string; name: string };
  createdAt: string;
};
type AuthResponse = { message: string; data: { token: string; user: AuthUser } };

const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });

/** POST /api/auth/register */
export async function registerUser(v: SignupValues) {
  const res = await post<AuthResponse>("/api/auth/register", { name: v.name, email: v.email, password: v.password });
  tokenStore.set(res.data.token, true);
  userStore.set(res.data.user, true);
  resetSetupReminder();
  toast.dismiss();
  return res.data.user;
}

/** POST /api/auth/login */
export async function loginUser(email: string, password: string, remember = true, restore = false) {
  const res = await post<AuthResponse>("/api/auth/login", { email, password, remember, restore });
  // remember = true  -> localStorage: stays signed in after the browser is closed (until the token expires)
  // remember = false -> sessionStorage: signed out when the tab/browser is closed
  tokenStore.set(res.data.token, remember);
  userStore.set(res.data.user, remember);
  resetSetupReminder();
  toast.dismiss();
  return res.data.user;
}

/* ---- Team invitations (/accept-invite?token=...) ---- */

export type InviteInfo = {
  state: "valid" | "expired" | "cancelled" | "accepted" | "not_found";
  message?: string | null;
  email?: string;
  name?: string;
  role?: string;
  organizationName?: string | null;
  inviterName?: string | null;
  accountExists?: boolean;
  canJoin?: boolean;
  blockedReason?: string | null;
  expiresAt?: string | null;
};

/** GET /api/team/invitations/:token (public). Note the payload is wrapped as { data: { ... } }. */
export async function lookupInvite(token: string) {
  const res = await api<{ data: InviteInfo }>(`/api/team/invitations/${encodeURIComponent(token)}`);
  return res.data;
}

/** POST /api/team/invitations/accept. New person: name + password. Existing account: its password. Signs them in. */
export async function acceptInvite(token: string, password: string, name?: string) {
  const res = await post<AuthResponse>("/api/team/invitations/accept", { token, password, ...(name ? { name } : {}) });
  tokenStore.set(res.data.token, true);
  userStore.set(res.data.user, true);
  resetSetupReminder();
  toast.dismiss();
  return res.data.user;
}

/**
 * POST /api/auth/logout revokes the token on the server (blacklist), then the session is cleared locally.
 * The local clear always happens, even if the request fails (offline, token already expired/revoked).
 * Call router.replace("/login") afterwards.
 */
export async function logoutUser() {
  try {
    if (tokenStore.get()) await post<{ message: string }>("/api/auth/logout", {});
  } catch {
    // ignore: we still sign the person out on this device
  } finally {
    tokenStore.clear();
    userStore.clear();
    resetSetupReminder();
  toast.dismiss();
  }
}

/* ---- Forgot password: 6-digit OTP flow (forgot-password -> verify-otp -> reset-password) ---- */

/** POST /api/auth/forgot-password. Always answers generically, so the UI never reveals whether an email exists. */
export function requestPasswordReset(email: string) {
  return post<{ message: string; emailSent?: boolean }>("/api/auth/forgot-password", { email });
}

/** POST /api/auth/verify-otp. Throws ApiError(400) for a wrong/expired code. */
export function verifyOtp(email: string, otp: string) {
  return post<{ message: string; valid: boolean }>("/api/auth/verify-otp", { email, otp });
}

/** POST /api/auth/reset-password. Consumes the OTP. */
export function resetPassword(email: string, otp: string, newPassword: string) {
  return post<{ message: string }>("/api/auth/reset-password", { email, otp, newPassword });
}

/** The verified email + code travel from the OTP page to the reset page in sessionStorage (not in the URL). */
const RESET_KEY = "password-reset";
export const resetFlow = {
  set: (v: { email: string; otp: string }) => sessionStorage.setItem(RESET_KEY, JSON.stringify(v)),
  get: (): { email: string; otp: string } | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(RESET_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  clear: () => sessionStorage.removeItem(RESET_KEY),
};
