import { api } from "@/lib/api";
import type { OnboardingValues } from "./schema";
import { cacheProfile, isOnboardingComplete, loadOnboarding } from "./status";

/** Shape returned by GET/POST /api/onboarding (the organization row). `name` is the company name. */
type OrgDto = {
  name?: string | null;
  websiteUrl?: string | null;
  industry?: string | null;
  description?: string | null;
  services?: string[] | null;
  differentiation?: string | null;
  targetIndustries?: string[] | null;
  targetTitles?: string[] | null;
  locations?: string[] | null;
  companySize?: string | null;
  customerDescription?: string | null;
  onboardingCompleted?: boolean | null;
};

function fromOrg(o: OrgDto): Partial<OnboardingValues> {
  return {
    companyName: o.name ?? "",
    websiteUrl: o.websiteUrl ?? "",
    industry: o.industry ?? "",
    description: o.description ?? "",
    services: o.services ?? [],
    differentiation: o.differentiation ?? "",
    targetIndustries: o.targetIndustries ?? [],
    targetTitles: o.targetTitles ?? [],
    locations: o.locations ?? [],
    companySize: o.companySize ?? "",
    customerDescription: o.customerDescription ?? "",
  };
}

/** GET /api/onboarding. Refreshes the local cache and returns the saved profile. */
export async function fetchOnboarding() {
  const res = await api<{ data: OrgDto }>("/api/onboarding");
  const profile = fromOrg(res.data);
  const completed = !!res.data.onboardingCompleted;
  cacheProfile(profile, completed);
  return { profile, completed };
}

/**
 * POST /api/onboarding. `complete` is sent on every save because the backend writes
 * onboardingCompleted from it each time (omitting it would reset the flag to false).
 */
export async function saveOnboarding(values: Partial<OnboardingValues>, complete: boolean) {
  const res = await api<{ data: OrgDto }>("/api/onboarding", {
    method: "POST",
    body: JSON.stringify({ ...values, complete }),
  });
  const profile = fromOrg(res.data);
  cacheProfile(profile, !!res.data.onboardingCompleted);
  return profile;
}

/** Merge a patch into the saved profile and save it to the backend. Throws on failure (the cache is left untouched). */
export async function updateProfile(patch: Partial<OnboardingValues>) {
  const next = { ...(loadOnboarding() ?? {}), ...patch };
  return saveOnboarding(next, isOnboardingComplete());
}
