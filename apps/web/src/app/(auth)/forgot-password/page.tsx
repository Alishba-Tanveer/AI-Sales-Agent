"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Info, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError, ServerError, inputCls, primaryBtn } from "@/components/auth/auth-shell";
import { forgotSchema, type ForgotValues } from "@/features/auth/schemas";
import { requestPasswordReset } from "@/features/auth/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (v: ForgotValues) => {
    setError(null);
    try {
      const res = await requestPasswordReset(v.email);
      // Backend flow: it returns a reset token -> go straight to the reset page.
      if (res.resetToken) {
        router.push(`/reset-password?token=${encodeURIComponent(res.resetToken)}`);
        return;
      }
      // No token (generic response) -> show the backend's message.
      setNotice(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process your request.");
    }
  };

  if (notice) {
    return (
      <AuthCard title="Request received" subtitle="Check the details below.">
        <div className="mb-4 flex gap-3 rounded-lg border border-[#232A3B] bg-[#1A2030] p-4 text-sm text-[#E5E7EB]">
          <Info size={20} className="mt-0.5 shrink-0 text-[#818CF8]" />
          <p>{notice}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" onClick={() => setNotice(null)} className="h-10 flex-1 border-[#232A3B] bg-[#1A2030] text-xs text-[#E5E7EB] hover:bg-[#232A3B]">
            Try a different email
          </Button>
          <Link href="/login" className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#818CF8] text-xs font-medium text-[#0B0F19] transition-colors hover:bg-[#6366F1]">
            Return to Sign In<ArrowRight size={14} />
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your work email address to start resetting your password."
      footer={<Link href="/login" className="inline-flex items-center gap-1.5 hover:text-[#818CF8]"><ArrowLeft size={14} />Return to Sign In</Link>}
    >
      <div className="mb-4 flex gap-2.5 rounded-lg border border-[#453415] bg-[#2E2210] p-3 text-xs leading-relaxed text-[#FBBF24]">
        <ShieldAlert size={18} className="shrink-0" />
        <p><span className="font-semibold">Security Notice:</span> Password reset tokens expire in 15 minutes and can only be used once.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <ServerError message={error} />
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium text-[#E5E7EB]">Work Email Address</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="alex.vance@company.com" className={inputCls} {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>
        <Button type="submit" disabled={isSubmitting} className={primaryBtn}>
          {isSubmitting ? <><Loader2 size={16} className="animate-spin" />Please wait...</> : <>Continue<ArrowRight size={18} /></>}
        </Button>
      </form>
    </AuthCard>
  );
}
