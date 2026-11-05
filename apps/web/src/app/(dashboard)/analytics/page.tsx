import { Suspense } from "react";
import { AnalyticsPage } from "@/features/analytics/components/analytics-page";

export default function Page() {
  return <Suspense fallback={null}><AnalyticsPage /></Suspense>;
}
