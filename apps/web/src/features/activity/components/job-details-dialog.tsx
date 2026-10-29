"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fullDateTime, formatDuration, retriesLabel } from "../format";
import type { ActivityJob } from "../types";
import { JobIcon, StatusPill } from "./job-ui";

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{label}</dt>
      <dd className="[overflow-wrap:anywhere] text-sm text-foreground">{children}</dd>
    </div>
  );
}

/** "View details": what the job did, or why it failed. `job` is kept by the page while the dialog fades out. */
export function JobDetailsDialog({ job, open, onOpenChange, now }: { job: ActivityJob | null; open: boolean; onOpenChange: (o: boolean) => void; now: number }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {job && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2.5 pr-8">
                <JobIcon job={job} className="size-5" />
                <DialogTitle className="min-w-0 [overflow-wrap:anywhere] text-base leading-snug">{job.title}</DialogTitle>
              </div>
              <DialogDescription>{job.lead.name ? (job.lead.context ? `${job.lead.name} (${job.lead.context})` : job.lead.name) : (job.lead.context || "General activity · not linked to a specific lead")}</DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Item label="Status"><StatusPill status={job.status} /></Item>
              <Item label="Agent">{job.agent}</Item>
              <Item label="Started">
                {job.startedAt ? fullDateTime(job.startedAt) : job.scheduledFor ? `Scheduled ${fullDateTime(job.scheduledFor)}` : "Not started"}
              </Item>
              <Item label="Duration">
                {job.durationSec !== null
                  ? formatDuration(job.durationSec)
                  : job.startedAt && now > 0
                    ? formatDuration((now - new Date(job.startedAt).getTime()) / 1000)
                    : "—"}
              </Item>
              <Item label="Retries">{retriesLabel(job)}{job.retries > 0 ? ` (max ${job.maxRetries})` : ""}</Item>
            </dl>

            {job.error && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive-soft p-3 text-xs leading-relaxed text-destructive">
                <p className="mb-0.5 font-semibold">Why it failed</p>
                {job.error}
              </div>
            )}
            {job.output && (
              <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs leading-relaxed text-foreground">
                <p className="mb-0.5 font-semibold">Result</p>
                {job.output}
              </div>
            )}
            {!job.error && !job.output && (
              <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                {job.status === "running" ? "This task is still running. The result will appear here when it finishes." : job.status === "queued" ? "This task has not started yet." : "This task did not produce a result."}
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
