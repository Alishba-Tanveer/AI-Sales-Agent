"use client";

import { useState } from "react";
import { CalendarClock, History, MailCheck, Gauge, Brain, Target, BadgeCheck, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Textarea } from "@/components/ui/textarea";
import { SIZES } from "@/features/onboarding/options";
import { updateProfile } from "@/features/onboarding/api";
import { loadOnboarding, validateFields } from "@/features/onboarding/status";
import { approveOutreach, getOutreach } from "../api";
import { useLoad } from "../use-load";
import type { MessageTone, OutreachSettings } from "../types";
import { TabError, TabLoading } from "./load-states";
import { CARD_INNER, Field, NumberField, Pill, SaveButton, SectionCard, TagGroup, selectCls } from "./settings-ui";

const TONES: { id: MessageTone; title: string; text: string; hint: string }[] = [
  { id: "professional", title: "Professional", text: "Formal, authoritative, concise. Relies on concrete business metrics and case proofs.", hint: "Recommended for Enterprise" },
  { id: "friendly", title: "Friendly", text: "Conversational, peer-to-peer, warm. Uses casual greetings and collaborative phrasing.", hint: "Effective for Early-Stage" },
  { id: "direct", title: "Direct", text: "Bottom-line focused, rapid elevator pitch with single unambiguous call-to-action.", hint: "High Volume / Cold Outbound" },
];

function ThrottleCard({ title, icon: Icon, unit, note, children }: { title: string; icon: LucideIcon; unit: string; note: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-lg border border-border bg-background p-3.5", CARD_INNER)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-1 flex items-center gap-2">
        {children}
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
      <span className="mt-1 text-[11px] text-muted-foreground">{note}</span>
    </div>
  );
}

export function OutreachTab() {
  const { state, reload } = useLoad(getOutreach);
  if (state.status === "loading") return <TabLoading label="Loading your outreach strategy…" />;
  if (state.status === "error") return <TabError message={state.message} onRetry={reload} />;
  return <OutreachForm initial={state.data} />;
}

function OutreachForm({ initial }: { initial: OutreachSettings }) {
  // ideal-customer answers from onboarding
  const saved = useState(() => loadOnboarding() ?? {})[0];
  const [industries, setIndustries] = useState<string[]>(saved.targetIndustries ?? []);
  const [titles, setTitles] = useState<string[]>(saved.targetTitles ?? []);
  const [locations, setLocations] = useState<string[]>(saved.locations ?? []);
  const [companySize, setCompanySize] = useState(saved.companySize ?? "");
  const [customerDescription, setCustomerDescription] = useState(saved.customerDescription ?? "");
  const [tone, setTone] = useState<MessageTone>(initial.tone);
  const [followUps, setFollowUps] = useState(initial.followUps);
  const [gapDays, setGapDays] = useState(initial.gapDays);
  const [dailyCap, setDailyCap] = useState(initial.dailyCap);
  const [approved, setApproved] = useState(initial.approved);
  const [approving, setApproving] = useState(false);

  const approve = async () => {
    setApproving(true);
    try {
      const res = await approveOutreach({ tone, followUps, gapDays, dailyCap });
      setApproved(res.settings.approved);
      toast.success(res.message ?? "Outreach strategy saved and approved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your outreach strategy.");
    } finally {
      setApproving(false);
    }
  };

  const saveTargeting = async () => {
    const patch = { targetIndustries: industries, targetTitles: titles, locations, companySize, customerDescription };
    const error = validateFields(patch, ["targetIndustries", "targetTitles", "locations", "companySize", "customerDescription"]);
    if (error) return void toast.error(error);
    try {
      await updateProfile(patch);
      toast.success("Ideal customer details saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your changes.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        icon={Target}
        tone="success"
        title="Targeting Taxonomy & Sourcing Filters"
        description="Define categorical tags used by LinkedIn scrapers and Apollo search queries."
        aside={<Pill tone="success">Precision Matching</Pill>}
      >
        {/* 2 columns: row 1 = industries + titles, row 2 = locations + company size, row 3 = full-width description */}
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
          <TagGroup label="Target Industries *" tags={industries} onChange={setIndustries} addLabel="Add industry" placeholder="New industry" />
          <TagGroup label="Target Decision Maker Titles *" tags={titles} onChange={setTitles} addLabel="Add title" placeholder="New job title" />
          <TagGroup label="Target Locations *" tags={locations} onChange={setLocations} addLabel="Add location" placeholder="Country / region" />
          <Field label="Target company size *" htmlFor="ot-size">
            <select id="ot-size" value={companySize} onChange={(e) => setCompanySize(e.target.value)} className={selectCls}>
              <option value="" disabled>Select size...</option>
              {SIZES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Ideal customer description (optional)" htmlFor="ot-desc" className="md:col-span-2">
            <Textarea id="ot-desc" rows={3} value={customerDescription} onChange={(e) => setCustomerDescription(e.target.value)} placeholder="e.g. Software companies with 20 to 150 employees that want more qualified leads." className="text-sm md:text-sm" />
          </Field>
        </div>
        <SaveButton label="Save Targeting" onClick={saveTargeting} />
      </SectionCard>

      <SectionCard
        icon={Brain}
        tone="warning"
        title="Outreach Voice & Tone Synthesizer"
        description="Configures the underlying LLM stylistic instruction prompt across email and LinkedIn touchpoints."
      >
        <div role="radiogroup" aria-label="Message tone" className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TONES.map((t) => {
            const on = tone === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTone(t.id)}
                className={cn(
                  "flex cursor-pointer flex-col rounded-xl border p-4 text-left outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50",
                  on ? "border-2 border-primary bg-primary-soft/40" : "border-border bg-background hover:border-primary/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-foreground">{t.title}</span>
                  <span className={cn("flex size-4 items-center justify-center rounded-full border-2", on ? "border-primary" : "border-muted-foreground/60")}>
                    {on && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t.text}</p>
                <span className={cn("mt-3 text-[11px] font-semibold tracking-wider uppercase", on ? "text-primary" : "text-muted-foreground")}>{t.hint}</span>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        icon={Gauge}
        tone="primary"
        title="Sending Cadence & Deliverability Controls"
        description="Limits that keep your sending volume under control and protect your domain reputation."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <ThrottleCard title="Max Follow-ups per Lead" icon={History} unit="follow-ups" note="The most follow-up messages one lead can get">
            <NumberField label="Max follow-ups per lead" value={followUps} min={1} max={7} onChange={setFollowUps} />
          </ThrottleCard>
          <ThrottleCard title="Interval Between Touches" icon={CalendarClock} unit="days" note="How long to wait between messages to the same lead">
            <NumberField label="Interval between touches" value={gapDays} min={1} max={14} onChange={setGapDays} />
          </ThrottleCard>
          <ThrottleCard title="Daily Sending Cap / Mailbox" icon={MailCheck} unit="emails a day" note="The most emails one mailbox sends in a day">
            <NumberField label="Daily sending cap per mailbox" value={dailyCap} min={10} max={100} onChange={setDailyCap} />
          </ThrottleCard>
        </div>

        <SaveButton icon={BadgeCheck} label={approving ? "Saving…" : approved ? "Update Approved Strategy" : "Save and Approve Strategy"} busy={approving} onClick={approve} />
      </SectionCard>
    </div>
  );
}

