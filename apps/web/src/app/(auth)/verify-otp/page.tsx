"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError, ServerError, inputCls, primaryBtn } from "@/components/auth/auth-shell";
import { otpSchema, type OtpValues } from "@/features/auth/schemas";
import { requestPasswordReset, resetFlow, verifyOtp } from "@/features/auth/api";

const RESEND_SECONDS = 30;

function VerifyForm() {
  const router = useRouter();
  const email = useSearchParams().get("email")?.trim() ?? "";
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!email) {
    return (
      <AuthCard title="Start again" subtitle="We need your email address to send the verification code."
        footer={<Link href="/forgot-password" className="font-medium text-[#818CF8] hover:underline">Reset your password</Link>}>
        <ServerError message="No email address was provided." />
      </AuthCard>
    );
  }

  const onSubmit = async (v: OtpValues) => {
    setError(null);
    setInfo(null);
    try {
      await verifyOtp(email, v.otp);
      resetFlow.set({ email, otp: v.otp });
      router.push("/reset-password");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify the code.");
    }
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    try {
      await requestPasswordReset(email);
      setInfo("A new code has been sent if the account exists.");
      setCooldown(RESEND_SECONDS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend the code.");
    }
  };

  return (
    <AuthCard
      title="Enter verification code"
      subtitle={`If an account exists for ${email}, we sent it a 6-digit code. It expires in 10 minutes.`}
      footer={<Link href="/forgot-password" className="inline-flex items-center gap-1.5 hover:text-[#818CF8]"><ArrowLeft size={14} />Use a different email</Link>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <ServerError message={error} />
        {info && (
          <div role="status" className="flex gap-2 rounded-lg border border-[#164E2D] bg-[#0F2A1C] p-3 text-xs text-[#4ADE80]">
            <MailCheck size={16} className="shrink-0" />{info}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="otp" className="text-xs font-medium text-[#E5E7EB]">6-digit code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            className={`${inputCls} text-center text-lg tracking-[0.5em]`}
            {...register("otp")}
          />
          <FieldError message={errors.otp?.message} />
        </div>
        <Button type="submit" disabled={isSubmitting} className={primaryBtn}>
          {isSubmitting ? <><Loader2 size={16} className="animate-spin" />Verifying...</> : <>Verify code<ArrowRight size={18} /></>}
        </Button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="text-xs font-medium text-[#818CF8] hover:underline disabled:cursor-not-allowed disabled:text-[#94A3B8] disabled:no-underline"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't get it? Resend code"}
        </button>
      </form>
    </AuthCard>
  );
}

export default function VerifyOtpPage() {
  return <Suspense><VerifyForm /></Suspense>;
}
