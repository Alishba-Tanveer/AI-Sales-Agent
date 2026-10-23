const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: Record<string, unknown> = {}) {
    super(message);
  }
}

// remember=true -> localStorage (survives browser restart); false -> sessionStorage
export const tokenStore = {
  get: () =>
    typeof window === "undefined" ? null : localStorage.getItem("token") ?? sessionStorage.getItem("token"),
  set: (t: string, remember = true) => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    (remember ? localStorage : sessionStorage).setItem("token", t);
  },
  clear: () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
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
