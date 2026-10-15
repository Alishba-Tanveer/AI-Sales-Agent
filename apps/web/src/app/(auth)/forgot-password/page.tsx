"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError, ServerError, inputCls, primaryBtn } from "@/components/auth/auth-shell";
import { forgotSchema, type ForgotValues } from "@/features/auth/schemas";
import { requestPasswordReset } from "@/features/auth/api";

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async (email: string) => {
    setError(null);
    try {
      await requestPasswordReset(email);
      setSentTo(email);
      setCooldown(60);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the reset link.");
    }
  };

  if (sentTo) {
    return (
      <AuthCard title="Check your inbox" subtitle="Security authorization dispatched to your registered address.">
        <div className="mb-4 flex gap-3 rounded-lg border border-[#164E2D] bg-[#0F2A1C] p-4">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#4ADE80]" />
          <div>
            <p className="text-sm font-medium text-[#4ADE80]">We&apos;ve sent a password reset link to <span className="font-semibold text-white underline">{sentTo}</span>.</p>
            <p className="mt-0.5 text-xs text-[#86EFAC]">The single-use link will expire in 15 minutes.</p>
          </div>
        </div>
        <ServerError message={error} />
        <div className="my-4 rounded-lg border border-[#232A3B] bg-[#1A2030] p-4 text-xs text-[#94A3B8]">
          Didn&apos;t receive the email? Check your spam folder. You can request another link shortly.
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" disabled={cooldown > 0} onClick={() => send(sentTo)} className="h-10 flex-1 gap-1.5 border-[#232A3B] bg-[#1A2030] text-xs text-[#E5E7EB] hover:bg-[#232A3B]">
            <RefreshCw size={14} />{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Link"}
          </Button>
          <Link href="/login" className="h-10 flex-1 gap-1.5 bg-[#818CF8] text-xs font-medium text-[#0B0F19] hover:bg-[#6366F1]">Return to Sign In<ArrowRight size={14} /></Link>
        </div>
        <button onClick={() => setSentTo(null)} className="mx-auto mt-5 block text-xs text-[#94A3B8] hover:text-[#E5E7EB]">Enter a different email</button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your work email address and we'll send you a secure link to reset your credentials."
      footer={<Link href="/login" className="inline-flex items-center gap-1.5 hover:text-[#818CF8]"><ArrowLeft size={14} />Return to Sign In</Link>}
    >
      <div className="mb-4 flex gap-2.5 rounded-lg border border-[#453415] bg-[#2E2210] p-3 text-xs leading-relaxed text-[#FBBF24]">
        <ShieldAlert size={18} className="shrink-0" />
        <p><span className="font-semibold">Security Notice:</span> Password reset tokens expire in 15 minutes and can only be used once.</p>
      </div>
      <form onSubmit={handleSubmit((v) => send(v.email))} className="flex flex-col gap-4" noValidate>
        <ServerError message={error} />
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium text-[#E5E7EB]">Work Email Address</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="alex.vance@company.com" className={inputCls} {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>
        <Button type="submit" disabled={isSubmitting} className={primaryBtn}>
          {isSubmitting ? <><Loader2 size={16} className="animate-spin" />Sending...</> : <>Send Reset Link<ArrowRight size={18} /></>}
        </Button>
      </form>
    </AuthCard>
  );
}
