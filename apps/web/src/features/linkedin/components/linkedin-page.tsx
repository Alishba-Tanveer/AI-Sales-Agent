"use client";

import { useSearchParams } from "next/navigation";
import { Reveal } from "@/features/overview/components/reveal";
import { Connections } from "./connections";
import { ContentEngine } from "./content-engine";
import { ProfileOptimizer } from "./profile-optimizer";

/** The sidebar links to /linkedin, /linkedin?tab=content and /linkedin?tab=connections. */
export function LinkedInPage() {
  const tab = useSearchParams().get("tab");
  return (
    <Reveal key={tab ?? "profile"}>
      {tab === "content" ? <ContentEngine /> : tab === "connections" ? <Connections /> : <ProfileOptimizer />}
    </Reveal>
  );
}
