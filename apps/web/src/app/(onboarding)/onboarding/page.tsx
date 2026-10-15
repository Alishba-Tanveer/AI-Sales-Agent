"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Bot, Building2, Check, ChevronDown, ClipboardCheck, Loader2, Pencil, Users, Wrench, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, ServerError } from "@/components/auth/auth-shell";
import { Backdrop } from "@/components/auth/backdrop";
import { TagInput } from "@/features/onboarding/tag-input";
import { onboardingSchema, STEP_FIELDS, type OnboardingValues } from "@/features/onboarding/schema";
import { saveOnboarding } from "@/features/onboarding/api";

const STEPS = ["Company", "Services", "Customer", "Review"];
const INDUSTRIES = [["b2b_saas", "B2B SaaS"], ["professional_services", "Professional Services"], ["ecommerce", "E-commerce"], ["healthcare", "Healthcare"], ["financial_tech", "Financial Tech"]];
const SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];
const SUGGESTED = ["Lead Research", "Email Outreach", "Follow-ups", "LinkedIn Content", "Reporting"];
const field = "h-11 rounded-lg border border-[#2A3350] bg-[#0B0F19] px-3.5 text-sm text-[#F1F5F9] placeholder:text-[#7C8AA5] focus-visible:border-[#818CF8] focus-visible:ring-[3px] focus-visible:ring-[#818CF8]/20 focus-visible:ring-offset-0";
const area = `${field} h-[104px] resize-none py-2.5`;
const lbl = "text-sm font-medium text-[#E2E8F0]";

const Req = () => <span className="ml-1 font-bold text-[#F87171]">*</span>;
const Chips = ({ items }: { items?: string[] }) => (
  <div className="flex flex-wrap gap-2">
    {items?.map((i) => <span key={i} className="flex h-7 items-center rounded-md border border-[#818CF8]/35 bg-[#818CF8]/10 px-2.5 text-[13px] text-[#C7D2FE]">{i}</span>)}
  </div>
);
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><span className="mb-1.5 block text-xs text-[#A8B3C7]">{label}</span>{children}</div>
);
const Text = ({ v }: { v?: string }) => <p className="text-sm text-[#F1F5F9]">{v || <span className="text-[#7C8AA5]">Not provided</span>}</p>;

// One icon + colour per step (from the Stitch design)
const STEP_ICONS: { Icon: LucideIcon; rgb: string; hex: string }[] = [
  { Icon: Building2, rgb: "129,140,248", hex: "#818CF8" },
  { Icon: Wrench, rgb: "96,165,250", hex: "#60A5FA" },
  { Icon: Users, rgb: "74,222,128", hex: "#4ADE80" },
  { Icon: ClipboardCheck, rgb: "251,191,36", hex: "#FBBF24" },
];

function IconTile({ index, size = 36 }: { index: number; size?: number }) {
  const { Icon, rgb, hex } = STEP_ICONS[index];
  const small = size < 32;
  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{
        width: size, height: size, borderRadius: small ? 6 : 10,
        backgroundColor: `rgba(${rgb},0.12)`,
        border: small ? undefined : `1px solid rgba(${rgb},0.30)`,
      }}
    >
      <Icon size={small ? 16 : 20} color={hex} />
    </div>
  );
}

function Section({ icon, title, onEdit, children }: { icon: number; title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border border-[#2A3350] bg-[#0D121F] p-4">
      <div className="mb-3.5 flex items-center justify-between border-b border-[#2A3350] pb-2.5">
        <div className="flex items-center gap-2.5">
          <IconTile index={icon} size={28} />
          <h3 className="text-[15px] font-semibold text-[#F1F5F9]">{title}</h3>
        </div>
        <button type="button" onClick={onEdit} className="flex items-center gap-1 text-[13px] font-medium text-[#818CF8] hover:underline">
          <Pencil size={14} />Edit
        </button>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState<"next" | "save" | "finish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, control, trigger, getValues, watch, formState: { errors } } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    mode: "onTouched",
    defaultValues: { industry: "", companySize: "", services: [], targetIndustries: [], targetTitles: [], locations: [] },
  });
  const v = watch();

  const next = async () => {
    if (await trigger(STEP_FIELDS[step])) setStep((s) => s + 1);
  };
  const persist = async (complete: boolean, kind: "save" | "finish") => {
    setError(null);
    if (complete && !(await trigger())) return setError("Some required details are missing. Use Edit to fix them.");
    setBusy(kind);
    try {
      await saveOnboarding(getValues(), complete); // MOCK until backend route exists
      router.push(complete ? "/overview" : "/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your details.");
      setBusy(null);
    }
  };

  const headers = [
    ["Company Profile", "Tell us about your company so AI can write better drafts."],
    ["Services", "Tell us what you offer so AI can describe it in your emails."],
    ["Customer", "Describe your ideal customer so AI can find and write to the right people."],
    ["Review", "Check your details. You can change them later in Settings."],
  ][step];

  return (
    <div className="relative isolate min-h-screen">
      <Backdrop />
      <header className="relative z-10 flex h-16 items-center border-b border-[#232A3B] px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#818CF8] text-[#0B0F19]"><Bot size={20} /></div>
          <span className="text-[15px] font-semibold text-[#F1F5F9]">AI Sales Agent</span>
        </div>
      </header>
      <main className="relative z-10 mx-auto flex max-w-[640px] flex-col px-4 pb-16 pt-12">
        <h1 className="text-[28px] font-semibold tracking-tight text-[#F8FAFC]">Set up your workspace</h1>
        <p className="mb-6 mt-1.5 text-sm text-[#A8B3C7]">4 short steps. You can change everything later in Settings.</p>

        <div className="relative overflow-hidden rounded-xl border border-[#2A3350] bg-[#111623] p-8 shadow-2xl">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#818CF8] to-[#C084FC]" />

          <ol className="relative mb-6 grid grid-cols-4 gap-2">
            <div className="absolute left-0 top-3.5 h-px w-full bg-[#2A3350]" />
            {STEPS.map((s, i) => (
              <li key={s} className="relative flex flex-col items-center">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold ${
                  i < step ? "border border-[#2F5F4A] bg-[#182E2E] text-[#4ADE80]"
                  : i === step ? "bg-[#818CF8] text-[#0B0F19] shadow-[0_0_0_3px_rgba(129,140,248,0.25)]"
                  : "border border-[#2A3350] bg-[#1A2030] font-medium text-[#A8B3C7]"}`}>
                  {i < step ? <Check size={16} /> : i + 1}
                </div>
                <span className={`mt-2 text-[13px] ${i === step ? "font-semibold text-[#F1F5F9]" : i < step ? "font-medium text-[#A8B3C7]" : "font-medium text-[#7C8AA5]"}`}>{s}</span>
              </li>
            ))}
          </ol>

          <div className="mb-6 flex h-10 items-center rounded-lg border border-[#818CF8]/30 bg-[#818CF8]/10 px-4 text-[13px] text-[#C7D2FE]">
            We use this to write better drafts for the right people.
          </div>
          <div className="mb-6 flex items-center gap-3">
            <IconTile index={step} />
            <div>
              <p className="mb-1 text-xs text-[#A8B3C7]">Step {step + 1} of 4 · about 1 minute</p>
              <h2 className="text-[22px] font-semibold tracking-tight text-[#F8FAFC]">Step {step + 1}: {headers[0]}</h2>
              <p className="mt-1 text-sm text-[#A8B3C7]">{headers[1]}</p>
            </div>
          </div>

          <ServerError message={error} />

          <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-5" noValidate>
            {step === 0 && (<>
              <div className="space-y-2">
                <Label htmlFor="companyName" className={lbl}>Company Name<Req /></Label>
                <Input id="companyName" placeholder="e.g. BrightLine Digital" className={field} {...register("companyName")} />
                <FieldError message={errors.companyName?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="websiteUrl" className={lbl}>Website URL<Req /></Label>
                <Input id="websiteUrl" placeholder="https://example.com" className={field} {...register("websiteUrl")} />
                <FieldError message={errors.websiteUrl?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry" className={lbl}>Industry<Req /></Label>
                <div className="relative">
                  <select id="industry" className={`${field} w-full cursor-pointer appearance-none pr-10`} {...register("industry")}>
                    <option value="" disabled>Select industry...</option>
                    {INDUSTRIES.map(([val, name]) => <option key={val} value={val}>{name}</option>)}
                  </select>
                  <ChevronDown size={20} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#A8B3C7]" />
                </div>
                <FieldError message={errors.industry?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className={lbl}>Company Description</Label>
                <Textarea id="description" placeholder="Describe what your business does, key offerings, and target market..." className={area} {...register("description")} />
                <p className="text-[13px] text-[#A8B3C7]">Optional. A short description helps AI write better drafts.</p>
              </div>
            </>)}

            {step === 1 && (<>
              <div className="space-y-2">
                <Label htmlFor="services" className={lbl}>Services<Req /></Label>
                <Controller name="services" control={control} render={({ field: f }) => (
                  <TagInput id="services" value={f.value} onChange={f.onChange} max={5} placeholder="Type a service and press Enter" suggestions={SUGGESTED} />
                )} />
                <p className="text-[13px] text-[#A8B3C7]">Add one to five services.</p>
                <FieldError message={errors.services?.message as string | undefined} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="differentiation" className={lbl}>What makes you different?</Label>
                <Textarea id="differentiation" placeholder="In one or two sentences, why do customers choose you?" className={area} {...register("differentiation")} />
                <p className="text-[13px] text-[#A8B3C7]">Optional.</p>
              </div>
            </>)}

            {step === 2 && (<>
              {([["targetIndustries", "Target industries", "e.g. B2B SaaS, Logistics"], ["targetTitles", "Target job titles", "e.g. VP Sales, Head of Operations"]] as const).map(([name, label, ph]) => (
                <div key={name} className="space-y-2">
                  <Label htmlFor={name} className={lbl}>{label}<Req /></Label>
                  <Controller name={name} control={control} render={({ field: f }) => <TagInput id={name} value={f.value} onChange={f.onChange} placeholder={ph} />} />
                  <FieldError message={errors[name]?.message as string | undefined} />
                </div>
              ))}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="locations" className={lbl}>Locations<Req /></Label>
                  <Controller name="locations" control={control} render={({ field: f }) => <TagInput id="locations" value={f.value} onChange={f.onChange} placeholder="e.g. United States" />} />
                  <FieldError message={errors.locations?.message as string | undefined} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companySize" className={lbl}>Company size<Req /></Label>
                  <div className="relative">
                    <select id="companySize" className={`${field} w-full cursor-pointer appearance-none pr-10`} {...register("companySize")}>
                      <option value="" disabled>Select size...</option>
                      {SIZES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={20} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#A8B3C7]" />
                  </div>
                  <FieldError message={errors.companySize?.message} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerDescription" className={lbl}>Describe your ideal customer</Label>
                <Textarea id="customerDescription" placeholder="e.g. Software companies with 20 to 150 employees that want more qualified leads." className={area} {...register("customerDescription")} />
                <p className="text-[13px] text-[#A8B3C7]">Optional.</p>
              </div>
            </>)}

            {step === 3 && (
              <div className="flex flex-col gap-3">
                <Section icon={0} title="Company" onEdit={() => setStep(0)}>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Row label="Company name"><Text v={v.companyName} /></Row>
                    <Row label="Website"><Text v={v.websiteUrl} /></Row>
                    <Row label="Industry"><Text v={INDUSTRIES.find(([k]) => k === v.industry)?.[1]} /></Row>
                  </div>
                  <Row label="Description"><Text v={v.description} /></Row>
                </Section>
                <Section icon={1} title="Services" onEdit={() => setStep(1)}>
                  <Row label="Services"><Chips items={v.services} /></Row>
                  <Row label="What makes you different"><Text v={v.differentiation} /></Row>
                </Section>
                <Section icon={2} title="Ideal customer" onEdit={() => setStep(2)}>
                  <Row label="Target industries"><Chips items={v.targetIndustries} /></Row>
                  <Row label="Target job titles"><Chips items={v.targetTitles} /></Row>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Row label="Locations"><Chips items={v.locations} /></Row>
                    <Row label="Company size"><Text v={v.companySize} /></Row>
                  </div>
                  <Row label="Description"><Text v={v.customerDescription} /></Row>
                </Section>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between border-t border-[#2A3350] pt-6">
              <div className="flex items-center gap-3 text-sm font-medium text-[#A8B3C7]">
                <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="flex items-center gap-1 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
                  <ArrowLeft size={18} />Back
                </button>
                {step < 3 && <button type="button" onClick={() => setStep((s) => s + 1)} className="hover:text-white">Skip for now</button>}
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" disabled={!!busy} onClick={() => persist(false, "save")} className="h-10 rounded-lg border-[#2A3350] bg-transparent text-sm font-medium text-[#E2E8F0] hover:bg-[#1A2030]">
                  {busy === "save" && <Loader2 size={16} className="animate-spin" />}Save and finish later
                </Button>
                {step < 3 ? (
                  <Button type="button" onClick={next} className="h-10 gap-2 rounded-lg bg-[#818CF8] px-5 text-sm font-semibold text-[#0B0F19] hover:bg-[#929BFA]">
                    Next<ArrowRight size={18} />
                  </Button>
                ) : (
                  <Button type="button" disabled={!!busy} onClick={() => persist(true, "finish")} className="h-10 gap-2 rounded-lg bg-[#818CF8] px-5 text-sm font-semibold text-[#0B0F19] hover:bg-[#929BFA]">
                    {busy === "finish" ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}Finish setup
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
