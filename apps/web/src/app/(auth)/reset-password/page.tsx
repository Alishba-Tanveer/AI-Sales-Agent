"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError, ServerError, primaryBtn } from "@/components/auth/auth-shell";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-fields";
import { resetSchema, type ResetValues } from "@/features/auth/schemas";
import { resetFlow, resetPassword } from "@/features/auth/api";

type Flow = { email: string; otp: string };

export default function ResetPasswordPage() {
  // email + code were verified on the previous screen and kept in sessionStorage
  const [flow, setFlow] = useState<Flow | null | undefined>(undefined);
  const [show, setShow] = useState(false);
  const [showC, setShowC] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
  });
  const pw = useWatch({ control, name: "newPassword" }) ?? "";

  useEffect(() => {
    const timer = window.setTimeout(() => setFlow(resetFlow.get()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (flow === undefined) return null;

  if (!flow) {
    return (
      <AuthCard title="Verification needed" subtitle="Verify your email code before choosing a new password."
        footer={<Link href="/forgot-password" className="font-medium text-[#818CF8] hover:underline">Request a new code</Link>}>
        <ServerError message="Your reset session is missing or has expired." />
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated" subtitle="You can now sign in with your new password.">
        <div className="mb-5 flex gap-3 rounded-lg border border-[#164E2D] bg-[#0F2A1C] p-4 text-sm font-medium text-[#4ADE80]">
          <CheckCircle2 size={20} className="shrink-0" />Your password has been reset successfully.
        </div>
        <Link href="/login" className={`${primaryBtn} inline-flex items-center justify-center text-sm font-semibold transition-colors`}>Go to Sign In<ArrowRight size={18} /></Link>
      </AuthCard>
    );
  }

  const onSubmit = async (v: ResetValues) => {
    setError(null);
    try {
      await resetPassword(flow.email, flow.otp, v.newPassword);
      resetFlow.clear();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset your password.");
    }
  };

  return (
    <AuthCard title="Set a new password" subtitle={`Choose a new password for ${flow.email}.`}
      footer={<Link href="/forgot-password" className="hover:text-[#818CF8]">Code expired? Request a new one</Link>}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <ServerError message={error} />
        <div className="space-y-1.5">
          <Label htmlFor="newPassword" className="text-xs font-medium text-[#E5E7EB]">New password</Label>
          <PasswordInput id="newPassword" show={show} onToggle={() => setShow((s) => !s)} autoComplete="new-password" {...register("newPassword")} />
          <PasswordStrength value={pw} />
          <FieldError message={errors.newPassword?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-xs font-medium text-[#E5E7EB]">Confirm new password</Label>
          <PasswordInput id="confirmPassword" show={showC} onToggle={() => setShowC((s) => !s)} autoComplete="new-password" {...register("confirmPassword")} />
          <FieldError message={errors.confirmPassword?.message} />
        </div>
        <Button type="submit" disabled={isSubmitting} className={primaryBtn}>
          {isSubmitting ? <><Loader2 size={16} className="animate-spin" />Updating...</> : <>Reset Password<ArrowRight size={18} /></>}
        </Button>
      </form>
    </AuthCard>
  );
}
