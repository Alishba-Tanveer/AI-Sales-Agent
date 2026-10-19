"use client";

import { useState } from "react";
import { Building2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { INDUSTRIES, MAX_SERVICES } from "@/features/onboarding/options";
import type { OnboardingValues } from "@/features/onboarding/schema";
import { updateProfile } from "@/features/onboarding/api";
import { loadOnboarding, validateFields } from "@/features/onboarding/status";
import { Field, Pill, SaveButton, SectionCard, TagGroup, inputCls, selectCls } from "./settings-ui";

type Draft = Pick<OnboardingValues, "companyName" | "websiteUrl" | "industry" | "description" | "services" | "differentiation">;

/** Company + Services answers from onboarding, editable here. */
export function BusinessTab() {
  const [v, setV] = useState<Draft>(() => {
    const s = loadOnboarding() ?? {};
    return {
      companyName: s.companyName ?? "",
      websiteUrl: s.websiteUrl ?? "",
      industry: s.industry ?? "",
      description: s.description ?? "",
      services: s.services ?? [],
      differentiation: s.differentiation ?? "",
    };
  });
  const set = <K extends keyof Draft>(k: K, val: Draft[K]) => setV((p) => ({ ...p, [k]: val }));
  const text = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never);

  const save = async (keys: (keyof Draft)[], message: string) => {
    const error = validateFields(v, keys);
    if (error) return void toast.error(error);
    try {
      await updateProfile(v);
      toast.success(message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your changes.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        icon={Building2}
        tone="success"
        title="Company"
        description="The sales agent reads these details to write personalized drafts and icebreakers."
        aside={<Pill tone="success">From your onboarding</Pill>}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Company name *" htmlFor="bz-company">
            <Input id="bz-company" value={v.companyName} onChange={text("companyName")} placeholder="e.g. BrightLine Digital" className={inputCls} />
          </Field>
          <Field label="Website URL (optional)" htmlFor="bz-site">
            <Input id="bz-site" value={v.websiteUrl ?? ""} onChange={text("websiteUrl")} placeholder="https://example.com" className={inputCls} />
          </Field>
          <Field label="Industry *" htmlFor="bz-industry" className="md:col-span-2">
            <select id="bz-industry" value={v.industry} onChange={text("industry")} className={selectCls}>
              <option value="" disabled>Select industry...</option>
              {INDUSTRIES.map(([val, name]) => <option key={val} value={val}>{name}</option>)}
            </select>
          </Field>
          <Field label="Company description (optional)" htmlFor="bz-overview" className="md:col-span-2">
            <Textarea id="bz-overview" rows={3} value={v.description ?? ""} onChange={text("description")} placeholder="Describe what your business does, key offerings, and target market..." className="text-sm md:text-sm" />
          </Field>
        </div>
        <SaveButton onClick={() => save(["companyName", "websiteUrl", "industry", "description"], "Company details saved")} />
      </SectionCard>

      <SectionCard
        icon={Wrench}
        tone="primary"
        title="Services"
        description={`What you offer and why customers choose you (up to ${MAX_SERVICES} services).`}
      >
        <TagGroup label="Services *" tags={v.services} onChange={(t) => set("services", t)} addLabel="Add service" placeholder="New service" />
        <Field label="What makes you different (optional)" htmlFor="bz-diff">
          <Textarea id="bz-diff" rows={3} value={v.differentiation ?? ""} onChange={text("differentiation")} placeholder="In one or two sentences, why do customers choose you?" className="text-sm md:text-sm" />
        </Field>
        <SaveButton onClick={() => save(["services", "differentiation"], "Services saved")} />
      </SectionCard>
    </div>
  );
}
