"use client";

import { useSearchParams } from "next/navigation";
import { Reveal } from "@/features/overview/components/reveal";
import { CONNECTION_LISTS, Connections } from "./connections";
import { CONTENT_STAGES, ContentEngine } from "./content-engine";
import { ProfileOptimizer } from "./profile-optimizer";

/** The sidebar links to /linkedin, /linkedin?tab=content and /linkedin?tab=connections. */
export function LinkedInPage() {
  const params = useSearchParams();
  const tab = params.get("tab");
  const list = CONNECTION_LISTS.find((l) => l === params.get("list")) ?? "engaged";
  const stage = CONTENT_STAGES.find((c) => c === params.get("contentTab")) ?? "approval";
  // The key includes the inner tab, so a search such as "target buyers" opens the right list even when the page is already open.
  const key = tab === "connections" ? `connections-${list}` : tab === "content" ? `content-${stage}` : (tab ?? "profile");
  return (
    <Reveal key={key}>
      {tab === "content" ? <ContentEngine initialTab={stage} /> : tab === "connections" ? <Connections initialTab={list} /> : <ProfileOptimizer />}
    </Reveal>
  );
}
