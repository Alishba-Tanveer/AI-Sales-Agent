const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: Record<string, unknown> = {}) {
    super(message);
  }
}

export const TOKEN_STORE_EVENT = "token-store-change";

/**
 * Fired when a write request (POST / PUT / PATCH / DELETE) starts and when it ends. Server-side, many of these create an
 * Activity entry that stays "running" until the request finishes, so the Activity counter listens and refreshes at once
 * instead of waiting for its next poll.
 */
export const API_MUTATION_EVENT = "api-mutation";
const announce = (phase: "start" | "end") => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(API_MUTATION_EVENT, { detail: { phase } }));
};

const notifyTokenChange = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TOKEN_STORE_EVENT));
  }
};

// remember=true -> localStorage (survives browser restart); false -> sessionStorage
export const tokenStore = {
  get: () =>
    typeof window === "undefined" ? null : localStorage.getItem("token") ?? sessionStorage.getItem("token"),
  set: (t: string, remember = true) => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    (remember ? localStorage : sessionStorage).setItem("token", t);
    notifyTokenChange();
  },
  clear: () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    notifyTokenChange();
  },
};

/** True when a token exists and has not expired. */
export function hasValidSession() {
  const t = tokenStore.get();
  if (!t) return false;
  try {
    const payload = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return !(typeof payload.exp === "number" && payload.exp * 1000 < Date.now());
  } catch {
    return false;
  }
}

export async function api<T>(path: string, init: RequestInit & { keepSessionOn401?: boolean } = {}): Promise<T> {
  const { keepSessionOn401, ...fetchInit } = init;
  const token = tokenStore.get();
  const method = (fetchInit.method ?? "GET").toUpperCase();
  const announces = method !== "GET" && !path.startsWith("/api/auth/") && !path.startsWith("/api/activity");
  if (announces) announce("start");
  try {
    return await request<T>(path, fetchInit, token, keepSessionOn401);
  } finally {
    if (announces) announce("end");
  }
}

async function request<T>(path: string, fetchInit: RequestInit, token: string | null, keepSessionOn401?: boolean): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...fetchInit,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...fetchInit.headers,
      },
    });
  } catch {
    throw new ApiError("Cannot reach the server. Please try again.", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A protected request was rejected (expired or revoked token, e.g. after logout): drop the session and sign in again.
    // /api/auth/* is excluded so wrong-password / bad-OTP errors still show on their own forms.
    if (res.status === 401 && token && !keepSessionOn401 && !path.startsWith("/api/auth/") && typeof window !== "undefined") {
      tokenStore.clear();
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      window.location.replace("/login");
    }
    throw new ApiError(body.message ?? "Something went wrong", res.status, body);
  }
  return body as T;
}
