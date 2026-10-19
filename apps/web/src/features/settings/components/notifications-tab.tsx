"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_NOTIFICATIONS } from "../mock-data";
import { Pill, SaveButton, SectionCard } from "./settings-ui";

export function NotificationsTab() {
  const [rules, setRules] = useState(DEFAULT_NOTIFICATIONS);
  const toggle = (id: string, key: "email" | "inApp") =>
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: !r[key] } : r)));

  return (
    <SectionCard
      icon={BellRing}
      tone="primary"
      title="Incident & Operational Alert Routing"
      description="Select high-fidelity channels to trigger notifications when urgent revenue events take place."
      aside={<span className="text-[11px] tracking-wider text-muted-foreground uppercase">Multi-Channel</span>}
    >
      <div className="space-y-4">
        {rules.map((r) => (
          <div key={r.id} className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{r.title}</span>
                <Pill tone={r.badge.tone}>{r.badge.label}</Pill>
              </div>
              <p className="text-xs text-muted-foreground">{r.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              {(
                [
                  ["email", "Email"],
                  ["inApp", "In-app banner"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
                  <input type="checkbox" checked={r[key]} onChange={() => toggle(r.id, key)} className="size-4 cursor-pointer accent-primary" />
                  {label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <SaveButton onClick={() => toast.success("Notification preferences saved")} />
    </SectionCard>
  );
}
