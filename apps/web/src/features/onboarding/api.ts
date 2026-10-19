import type { OnboardingValues } from "./schema";
import { storeOnboarding } from "./status";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** MOCK: backend has no onboarding/workspace-profile route yet.
 *  Replace with api("/api/onboarding", { method: "POST", body: JSON.stringify(values) }) */
export async function saveOnboarding(values: Partial<OnboardingValues>) {
  await wait(300);
  storeOnboarding(values);
}
