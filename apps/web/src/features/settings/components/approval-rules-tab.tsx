"use client";

import { useState } from "react";
import { Gavel, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getApprovalRules, saveApprovalRules } from "../api";
import { useLoad } from "../use-load";
import type { ApprovalRules } from "../types";
import { TabError, TabLoading } from "./load-states";
import { Pill, SaveButton, SectionCard, Switch, type PillTone } from "./settings-ui";

type RuleRow = {
  title: string;
  text: string;
  badge?: { label: string; tone: PillTone };
  locked?: boolean;
  key?: "replies" | "followups" | "linkedin";
};

const RULES: RuleRow[] = [
  { title: "Require approval on new emails", text: "Every new initial outbound email draft requires human review and sign-off in the Approvals queue.", locked: true },
  { title: "Require approval on video scripts", text: "All personalized HeyGen AI video scripts must be verified prior to consuming render credits.", locked: true },
  { title: "Require approval on AI-generated replies", text: "When an inbound prospect reply is received, generated context-aware responses must be approved before sending.", badge: { label: "Recommended", tone: "success" }, key: "replies" },
  { title: "Require approval on scheduled follow-ups", text: "Scheduled follow-up sequence touchpoints must be approved before dispatch. Turn OFF to auto-fire approved sequence chains.", badge: { label: "Autonomous Sequence", tone: "warning" }, key: "followups" },
  { title: "Require approval on LinkedIn profile changes", text: "Suggested headline, summary, and experience revisions synthesized by agent must be reviewed before syncing.", key: "linkedin" },
];

export function ApprovalRulesTab() {
  const { state, reload } = useLoad(getApprovalRules);
  if (state.status === "loading") return <TabLoading label="Loading approval rules…" />;
  if (state.status === "error") return <TabError message={state.message} onRetry={reload} />;
  return <ApprovalRulesForm initial={state.data} />;
}

function ApprovalRulesForm({ initial }: { initial: ApprovalRules }) {
  const [threshold, setThreshold] = useState(initial.threshold);
  const [on, setOn] = useState({ replies: initial.replies, followups: initial.followups, linkedin: initial.linkedin });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveApprovalRules({ threshold, ...on });
      toast.success("Approval rules saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save approval rules.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      icon={Gavel}
      tone="warning"
      title="Human-in-the-Loop Governance Protocols"
      description="Control mandatory manual checkpoints, auto-approvals, and AI drafting confidence thresholds."
      aside={<Pill tone="warning">Compliance Engine v2.4</Pill>}
    >
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="size-[18px] text-primary" />
              Auto-Approval Confidence Threshold
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground">Drafts scoring above this AI accuracy threshold skip the manual approvals queue.</p>
          </div>
          <span className="rounded border border-primary/30 bg-primary-soft px-2.5 py-0.5 font-mono text-xs font-semibold text-primary">{threshold}%</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">70%</span>
          <input
            type="range"
            min={70}
            max={99}
            value={threshold}
            aria-label="Auto-approval confidence threshold"
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-border accent-primary"
          />
          <span className="text-xs text-muted-foreground">99%</span>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-border">
        {RULES.map((r) => (
          <div key={r.title} className="flex items-center justify-between gap-4 py-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{r.title}</span>
                {r.locked && (
                  <Pill tone="muted" className="font-medium">
                    <Lock className="size-3" />
                    Locked On in this version
                  </Pill>
                )}
                {r.badge && <Pill tone={r.badge.tone}>{r.badge.label}</Pill>}
              </div>
              <p className="text-xs text-muted-foreground">{r.text}</p>
            </div>
            {r.locked ? (
              <Switch checked disabled label={r.title} />
            ) : (
              <Switch checked={on[r.key!]} onChange={(v) => setOn((p) => ({ ...p, [r.key!]: v }))} label={r.title} />
            )}
          </div>
        ))}
      </div>

      <SaveButton busy={saving} onClick={save} />
    </SectionCard>
  );
}
