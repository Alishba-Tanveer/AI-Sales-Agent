import { fetchLeads } from "@/features/leads/api";
import { fetchInbox } from "@/features/inbox/api";
import { listActivity } from "@/features/activity/api";
import { fetchContent, fetchLeads as fetchLinkedInLeads } from "@/features/linkedin/api";
import type { RawAnalytics, SourceKey } from "./types";

/**
 * Analytics are worked out in the browser from the same endpoints the other pages already use
 * (/api/leads, /api/inbox, /api/activity, /api/linkedin/*), so every number matches what you see on those pages.
 * Nothing here can reject: a source that fails is listed in `failed` and the page shows that section as unavailable.
 */
export async function loadAnalytics(): Promise<RawAnalytics> {
  const [leads, inbox, jobs, content, linkedinLeads] = await Promise.allSettled([
    fetchLeads(),
    fetchInbox(),
    listActivity(),
    fetchContent(),
    fetchLinkedInLeads(),
  ]);

  const failed: SourceKey[] = [];
  let firstError = "";
  const note = (key: SourceKey, r: PromiseSettledResult<unknown>) => {
    if (r.status === "fulfilled") return;
    failed.push(key);
    if (!firstError) firstError = r.reason instanceof Error ? r.reason.message : "Something went wrong.";
  };
  note("leads", leads);
  note("inbox", inbox);
  note("activity", jobs);
  note("linkedinContent", content);
  note("linkedinLeads", linkedinLeads);

  return {
    leads: leads.status === "fulfilled" ? leads.value.leads : null,
    leadsTotal: leads.status === "fulfilled" ? leads.value.total : 0,
    inbox: inbox.status === "fulfilled" ? inbox.value : null,
    jobs: jobs.status === "fulfilled" ? jobs.value : null,
    scripts: content.status === "fulfilled" ? content.value.scripts : null,
    linkedinLeads: linkedinLeads.status === "fulfilled" ? linkedinLeads.value : null,
    failed,
    firstError,
  };
}
