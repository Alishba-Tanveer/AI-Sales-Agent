// Run from apps/api:  npx tsx src/scripts/check-did.ts
// Prints which D-ID key this machine loads and what D-ID says about its credits.
import { env } from "../config/env"; // loads the root .env
import { didKeyFingerprint, getDIdCredits } from "../integrations/did";

void env;

(async () => {
  console.log("Key loaded:", didKeyFingerprint());
  const { status, body } = await getDIdCredits();
  console.log("D-ID /credits ->", status, body);
})();
