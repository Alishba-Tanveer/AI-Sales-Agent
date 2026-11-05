import { Suspense } from "react";
import { ActivityPage } from "@/features/activity/components/activity-page";

export default function Page() {
  return <Suspense><ActivityPage /></Suspense>;
}
