"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { getNotifications, saveNotifications } from "../api";
import { useLoad } from "../use-load";
import type { NotificationRule } from "../types";
import { TabError, TabLoading } from "./load-states";
import { cn } from "cn";
import { CARD_INNER, Pill, SaveButton, SectionCard } from "./settings-ui";

export function NotificationsTab() {
  const { state, reload } = useLoad(getNotifications);
  if (state.status === "loading") return <TabLoading label="Loading notification preferences…" />;
  if (state.status === "error") return <TabError message={state.message} onRetry={reload} />;
  return <NotificationsForm initial={state.data} />;
}

function NotificationsForm({ initial }: { initial: NotificationRule[] }) {
  const [rules, setRules] = useState(initial);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      setRules(await saveNotifications(rules));
      toast.success("Notification preferences saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save notification preferences.");
    } finally {
      setSaving(false);
    }
  };
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
          <div key={r.id} className={cn("flex flex-col justify-between gap-4 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center", CARD_INNER)}>
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
      <SaveButton busy={saving} onClick={save} />
    </SectionCard>
  );
}
