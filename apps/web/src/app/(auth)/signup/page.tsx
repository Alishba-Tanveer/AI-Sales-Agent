"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError, ServerError, inputCls, primaryBtn } from "@/components/auth/auth-shell";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-fields";
import { Input } from "@/components/ui/input";
import { signupSchema, type SignupValues } from "@/features/auth/schemas";
import { registerUser } from "@/features/auth/api";

export default function SignupPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
  });
  const pw = useWatch({ control, name: "password" }) ?? "";

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
          <PasswordStrength value={pw} />
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
