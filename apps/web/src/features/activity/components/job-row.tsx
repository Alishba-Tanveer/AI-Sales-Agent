"use client";

import { Ban, ExternalLink, FileText, MoreHorizontal, RotateCw, Trash2 } from "lucide-react";
import { useRole } from "@/lib/use-role";
import { useState } from "react";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ActivityJob } from "../types";
import { JobIcon, StatusPill } from "./job-ui";

type Props = {
  job: ActivityJob;
  /** ms, from the shared clock (0 until it has started) */
  now?: number;
  busy: boolean;
  onRetry: (job: ActivityJob) => void;
  onCancel: (job: ActivityJob) => void;
  onDelete: (job: ActivityJob) => void | Promise<void>;
  onView: (job: ActivityJob) => void;
  onOpenLead: (job: ActivityJob) => void;
};

export function JobRow({ job, busy, onRetry, onCancel, onDelete, onView, onOpenLead }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canRetry = job.status === "failed" || job.status === "cancelled";
  const isOwner = useRole() === "OWNER";
  const canCancel = job.status === "running" || job.status === "queued";
  const hasLead = !!job.lead.name;

  return (
    <>
    <TableRow className="h-14 border-border">
      <TableCell className="overflow-hidden px-4 py-2 font-medium text-foreground" title={job.title}>
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <JobIcon job={job} />
          <span className="min-w-0 whitespace-normal break-words">{job.title}</span>
        </div>
      </TableCell>

      <TableCell className="overflow-hidden px-4 py-2 text-foreground" title={hasLead ? `${job.lead.name} · ${job.lead.context}` : job.lead.context}>
        <span className="block whitespace-normal [overflow-wrap:anywhere]">
          {hasLead ? (
            <>
              <span>{job.lead.name}</span>
              {job.lead.context ? <span className="text-muted-foreground"> ({job.lead.context})</span> : null}
            </>
          ) : (
            <span className="text-muted-foreground">{job.lead.context || "General activity"}</span>
          )}
        </span>
      </TableCell>

      <TableCell className="overflow-hidden px-4 py-2 text-muted-foreground" title={job.agent}>
        <span className="block whitespace-normal [overflow-wrap:anywhere]">{job.agent}</span>
      </TableCell>

      <TableCell className="px-4 py-2">
        <StatusPill status={job.status} />
      </TableCell>

      <TableCell className="px-2 py-2 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={busy}
            aria-label={`Actions for ${job.title}`}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MoreHorizontal className="size-[18px]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem disabled={!canRetry} onClick={() => onRetry(job)}>
              <RotateCw className="size-4" />
              Retry
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canCancel} onClick={() => onCancel(job)}>
              <Ban className="size-4" />
              Cancel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onView(job)}>
              <FileText className="size-4" />
              View details
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!hasLead} onClick={() => onOpenLead(job)}>
              <ExternalLink className="size-4" />
              Open lead
            </DropdownMenuItem>
            {isOwner && <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4 text-destructive" /> Delete
            </DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
    <ConfirmActionDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete this activity?" description={`“${job.title}” will be permanently removed from Activity.`} onConfirm={() => onDelete(job)} />
    </>
  );
}
