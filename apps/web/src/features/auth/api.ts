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
  return res.data.user;
}

/** POST /api/auth/login */
export async function loginUser(email: string, password: string, remember = true) {
  const res = await post<AuthResponse>("/api/auth/login", { email, password });
  // remember = true  -> localStorage: stays signed in after the browser is closed (until the token expires)
  // remember = false -> sessionStorage: signed out when the tab/browser is closed
  tokenStore.set(res.data.token, remember);
  userStore.set(res.data.user, remember);
  resetSetupReminder();
  return res.data.user;
}

/** Clears the session on this device. Call router.replace("/login") afterwards. */
export function logoutUser() {
  tokenStore.clear();
  userStore.clear();
  resetSetupReminder();
}

/** POST /api/auth/forgot-password  (backend also returns resetToken for dev testing) */
export function requestPasswordReset(email: string) {
  return post<{ message: string; resetToken?: string }>("/api/auth/forgot-password", { email });
}

/** POST /api/auth/reset-password */
export function resetPassword(token: string, newPassword: string) {
  return post<{ message: string }>("/api/auth/reset-password", { token, newPassword });
}
