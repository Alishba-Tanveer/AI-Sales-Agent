import { userStore } from "@/features/auth/user-store";
import { onboardingSchema, type OnboardingValues } from "./schema";

/**
 * Onboarding + Settings share one saved company profile. It is still mocked on the frontend
 * (backend has no route yet) and kept per user in localStorage. When the backend route exists,
 * swap loadOnboarding/storeOnboarding for API calls; everything else keeps working.
 */
const profileKey = () => `onboarding-profile:${userStore.get()?.id ?? "anon"}`;
const POPUP_FLAG = "setup-reminder-seen";

export type SettingsTabTarget = "business" | "outreach";

export function loadOnboarding(): Partial<OnboardingValues> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(profileKey());
    return raw ? (JSON.parse(raw) as Partial<OnboardingValues>) : null;
  } catch {
    return null;
  }
}

export function storeOnboarding(values: Partial<OnboardingValues>) {
  localStorage.setItem(profileKey(), JSON.stringify(values));
}

/** Merge a patch into the saved profile and return the result. */
export function updateProfile(patch: Partial<OnboardingValues>) {
  const next = { ...(loadOnboarding() ?? {}), ...patch };
  storeOnboarding(next);
  return next;
}

/** First validation message for the given fields (same rules as onboarding), or null if they're fine. */
export function validateFields(values: Partial<OnboardingValues>, keys: (keyof OnboardingValues)[]) {
  const shape = Object.fromEntries(keys.map((k) => [k, true])) as Record<string, true>;
  const res = onboardingSchema.pick(shape as never).safeParse(values);
  return res.success ? null : res.error.issues[0]?.message ?? "Please check the highlighted fields.";
}

/** Which Settings tab holds which onboarding answers. */
const SECTIONS: { tab: SettingsTabTarget; label: string; fields: [keyof OnboardingValues, string][] }[] = [
  {
    tab: "business",
    label: "Business",
    fields: [
      ["companyName", "Company name"],
      ["websiteUrl", "Website"],
      ["industry", "Industry"],
      ["description", "Company description"],
      ["services", "Services"],
      ["differentiation", "What makes you different"],
    ],
  },
  {
    tab: "outreach",
    label: "Outreach Strategy",
    fields: [
      ["targetIndustries", "Target industries"],
      ["targetTitles", "Target job titles"],
      ["locations", "Locations"],
      ["companySize", "Company size"],
      ["customerDescription", "Ideal customer description"],
    ],
  },
];

const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : !!String(v ?? "").trim());

/** Every onboarding answer (required and optional) that is still empty, grouped by Settings tab. */
export function getSetupStatus() {
  const saved = loadOnboarding() ?? {};
  const sections = SECTIONS.map((s) => ({
    tab: s.tab,
    label: s.label,
    missing: s.fields.filter(([key]) => !filled(saved[key])).map(([, label]) => label),
  })).filter((s) => s.missing.length > 0);
  return { complete: sections.length === 0, sections };
}

/** The "finish your setup" popup shows once per login, not on every page change. */
export const setupReminderSeen = () => typeof window !== "undefined" && sessionStorage.getItem(POPUP_FLAG) === "1";
export const markSetupReminderSeen = () => sessionStorage.setItem(POPUP_FLAG, "1");
export const resetSetupReminder = () => {
  if (typeof window !== "undefined") sessionStorage.removeItem(POPUP_FLAG);
};
