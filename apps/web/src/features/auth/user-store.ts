import type { AuthUser } from "./api";

const KEY = "user";

/**
 * Keeps the signed-in user (name, role, organization) next to the token so the
 * dashboard can show "Ahmed Khan / Owner" without an extra request.
 * Follows the same remember-me rule as tokenStore (localStorage vs sessionStorage).
 */
export const userStore = {
  get(): AuthUser | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  },
  set(user: AuthUser, remember = true) {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  },
};
