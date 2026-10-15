import type { OnboardingValues } from "./schema";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** MOCK: backend has no onboarding/workspace-profile route yet.
 *  Replace with api("/api/onboarding", { method: "POST", body: JSON.stringify(values) }) */
export async function saveOnboarding(values: OnboardingValues, _complete: boolean) {
  await wait(500);
  localStorage.setItem("onboarding-draft", JSON.stringify(values));
}
