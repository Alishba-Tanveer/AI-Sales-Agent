import { api, tokenStore } from "@/lib/api";
import type { SignupValues } from "./schemas";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  organization: { id: string; name: string };
  createdAt: string;
};
type AuthResponse = { message: string; data: { token: string; user: AuthUser } };

/** LIVE: POST /api/auth/register */
export async function registerUser(v: SignupValues) {
  const res = await api<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: v.name, email: v.email, password: v.password }),
  });
  tokenStore.set(res.data.token);
  return res.data.user;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** MOCK: backend has no login route yet. Replace with
 *  api<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }) */
export async function loginUser(_email: string, _password: string) {
  await wait(600);
  tokenStore.set("mock-token");
}

/** MOCK: backend has no forgot-password route yet. */
export async function requestPasswordReset(_email: string) {
  await wait(450);
}
