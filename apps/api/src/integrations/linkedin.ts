import { env } from "../config/env";

const LINKEDIN_API = "https://api.linkedin.com";

export function linkedinAuthorizationUrl(state: string) {
  const clientId = env.LINKEDIN_CLIENT_ID;
  const redirectUri = env.LINKEDIN_REDIRECT_URI;
  if (!clientId || !redirectUri) throw new Error("LinkedIn OAuth is not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_REDIRECT_URI.");
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "openid profile email w_member_social");
  return url.toString();
}

export async function exchangeLinkedinCode(code: string) {
  if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET || !env.LINKEDIN_REDIRECT_URI) {
    throw new Error("LinkedIn OAuth credentials are not configured.");
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.LINKEDIN_REDIRECT_URI,
    client_id: env.LINKEDIN_CLIENT_ID,
    client_secret: env.LINKEDIN_CLIENT_SECRET,
  });
  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`LinkedIn token exchange failed (${response.status}). Reconnect and check the configured callback URL.`);
  return (await response.json()) as { access_token: string; expires_in: number; refresh_token?: string; refresh_token_expires_in?: number };
}

export async function refreshLinkedinToken(refreshToken: string) {
  if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET) throw new Error("LinkedIn OAuth credentials are not configured.");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.LINKEDIN_CLIENT_ID,
    client_secret: env.LINKEDIN_CLIENT_SECRET,
  });
  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("LinkedIn session expired. Reconnect your account.");
  return (await response.json()) as { access_token: string; expires_in: number; refresh_token?: string; refresh_token_expires_in?: number };
}

export async function linkedinUserInfo(accessToken: string) {
  const response = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Could not read the authorized LinkedIn member profile (${response.status}).`);
  return (await response.json()) as { sub: string; name?: string; given_name?: string; family_name?: string; picture?: string };
}

export async function linkedinApi<T>(accessToken: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${LINKEDIN_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "linkedin-version": env.LINKEDIN_API_VERSION,
      "x-restli-protocol-version": "2.0.0",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`LinkedIn API request failed (${response.status}). Check app permissions and account access.`);
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { body: body as T, response };
}
