"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError, ServerError, inputCls, primaryBtn } from "@/components/auth/auth-shell";
import { PASSWORD_RULES, passwordStrength, signupSchema, type SignupValues } from "@/features/auth/schemas";
import { registerUser } from "@/features/auth/api";

const BAR = ["#F87171", "#FBBF24", "#38BDF8", "#4ADE80"];
const LABEL = ["Too weak", "Weak", "Okay", "Good", "Strong"];

function PasswordInput({ id, show, onToggle, ...rest }: React.ComponentProps<typeof Input> & { show: boolean; onToggle: () => void }) {
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} placeholder="••••••••••••" className={`${inputCls} pr-10`} {...rest} />
      <button type="button" aria-label="Toggle password visibility" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#E5E7EB]">
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
  });
  const pw = watch("password") ?? "";
  const strength = passwordStrength(pw);

  const onSubmit = async (v: SignupValues) => {
    setError(null);
    try {
      await registerUser(v); // LIVE backend call
      router.push("/onboarding");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create your account.");
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start generating qualified pipeline with AI Sales Agent."
      footer={<>Already have an account?<Link href="/login" className="ml-1 font-medium text-[#818CF8] hover:underline">Sign In</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <ServerError message={error} />
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-medium text-[#94A3B8]">Full Name</Label>
          <Input id="name" autoComplete="name" placeholder="e.g. Sarah Mitchell" className={inputCls} {...register("name")} />
          <FieldError message={errors.name?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium text-[#94A3B8]">Work Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" className={inputCls} {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-medium text-[#94A3B8]">Password</Label>
          <PasswordInput id="password" show={showPw} onToggle={() => setShowPw((s) => !s)} autoComplete="new-password" {...register("password")} />
          <div className="grid h-1 grid-cols-4 gap-1.5 pt-1">
            {BAR.map((c, i) => <div key={c} className="h-1 rounded-full bg-[#232A3B] transition-colors" style={i < strength ? { background: c } : undefined} />)}
          </div>
          <p className="flex items-center gap-1 pt-1 text-[11px] text-[#94A3B8]">
            {strength === 4 && <CheckCircle2 size={14} className="text-[#4ADE80]" />}
            {LABEL[strength]}
          </p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1">
            {PASSWORD_RULES.map((r) => {
              const ok = r.test(pw);
              return (
                <li key={r.id} className={`flex items-center gap-1.5 text-[11px] ${ok ? "text-[#4ADE80]" : "text-[#94A3B8]"}`}>
                  <CheckCircle2 size={13} className={ok ? "" : "opacity-40"} />
                  {r.label}
                </li>
              );
            })}
          </ul>
          <FieldError message={errors.password?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-xs font-medium text-[#94A3B8]">Confirm Password</Label>
          <PasswordInput id="confirmPassword" show={showCpw} onToggle={() => setShowCpw((s) => !s)} autoComplete="new-password" {...register("confirmPassword")} />
          <FieldError message={errors.confirmPassword?.message} />
        </div>
        <div>
          <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-[#94A3B8]">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#818CF8]" {...register("terms")} />
            <span>I agree to the <a href="#" className="text-[#818CF8] hover:underline">Terms of Service</a> and <a href="#" className="text-[#818CF8] hover:underline">Privacy Policy</a>, and acknowledge human approval requirements.</span>
          </label>
          <FieldError message={errors.terms?.message} />
        </div>
        <Button type="submit" disabled={isSubmitting} className={primaryBtn}>
          {isSubmitting ? <><Loader2 size={16} className="animate-spin" />Creating workspace...</> : <>Create Account<ArrowRight size={18} /></>}
        </Button>
      </form>
    </AuthCard>
  );
}
