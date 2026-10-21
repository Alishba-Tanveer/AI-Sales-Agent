import { Suspense } from "react";
import { LinkedInPage } from "@/features/linkedin/components/linkedin-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LinkedInPage />
    </Suspense>
  );
}
