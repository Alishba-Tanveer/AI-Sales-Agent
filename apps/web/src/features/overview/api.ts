import { api } from "@/lib/api";
import type { NavCounts, OverviewData } from "./types";

/** GET /api/analytics/overview */
export async function getOverview(): Promise<OverviewData> {
  const res = await api<{ data: OverviewData }>("/api/analytics/overview");
  return res.data;
}

/** GET /api/analytics/nav-counts */
export async function getNavCounts(): Promise<NavCounts> {
  const res = await api<{ data: NavCounts }>("/api/analytics/nav-counts");
  return res.data;
}
