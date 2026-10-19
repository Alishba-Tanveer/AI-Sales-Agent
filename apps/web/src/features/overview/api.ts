import { api, ApiError } from "@/lib/api";
import { buildMockOverview, emptyMockOverview, mockNavCounts } from "./mock-data";
import type { NavCounts, OverviewData } from "./types";

/**
 * The backend has no /api/analytics routes yet, so the dashboard runs on mock data.
 * When your teammate ships the analytics routes, set in apps/web/.env.local:
 *
 *   NEXT_PUBLIC_USE_MOCK_DASHBOARD=false
 *
 * and the calls below hit the real API (JWT is attached by lib/api.ts).
 */
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DASHBOARD !== "false";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Dev helper: open /overview?mock=empty or /overview?mock=error to preview those states. */
function mockMode() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("mock");
}

/** GET /api/analytics/overview */
export async function getOverview(): Promise<OverviewData> {
  if (USE_MOCK) {
    await wait(600);
    const mode = mockMode();
    if (mode === "error") throw new ApiError("An operational network timeout occurred while retrieving your pipeline stats.", 0);
    if (mode === "empty") return emptyMockOverview;
    return buildMockOverview();
  }
  const res = await api<{ data: OverviewData }>("/api/analytics/overview");
  return res.data;
}

/** GET /api/analytics/nav-counts */
export async function getNavCounts(): Promise<NavCounts> {
  if (USE_MOCK) {
    await wait(300);
    return mockMode() === "empty" ? { approvals: 0, activity: 0 } : mockNavCounts;
  }
  const res = await api<{ data: NavCounts }>("/api/analytics/nav-counts");
  return res.data;
}
