import { Suspense } from "react";
import { SettingsPage } from "@/features/settings/components/settings-page";

export default function Page() {
  // SettingsPage reads ?tab= (useSearchParams), which needs a Suspense boundary
  return (
    <Suspense fallback={null}>
      <SettingsPage />
    </Suspense>
  );
}
