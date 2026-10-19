"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError, ServerError, inputCls, primaryBtn } from "@/components/auth/auth-shell";
import { forgotSchema, type ForgotValues } from "@/features/auth/schemas";
import { requestPasswordReset } from "@/features/auth/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (v: ForgotValues) => {
    setError(null);
    try {
      await requestPasswordReset(v.email);
      // The backend answers the same way whether or not the email exists, so always continue to the code screen.
      router.push(`/verify-otp?email=${encodeURIComponent(v.email.trim())}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process your request.");
    }
  };

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your work email address and we'll send you a 6-digit verification code."
      footer={<Link href="/login" className="inline-flex items-center gap-1.5 hover:text-[#818CF8]"><ArrowLeft size={14} />Return to Sign In</Link>}
    >
      <div className="mb-4 flex gap-2.5 rounded-lg border border-[#453415] bg-[#2E2210] p-3 text-xs leading-relaxed text-[#FBBF24]">
        <ShieldAlert size={18} className="shrink-0" />
        <p><span className="font-semibold">Security Notice:</span> Your 6-digit code expires in 10 minutes and can only be used once.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <ServerError message={error} />
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium text-[#E5E7EB]">Work Email Address</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="alex.vance@company.com" className={inputCls} {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>
        <Button type="submit" disabled={isSubmitting} className={primaryBtn}>
          {isSubmitting ? <><Loader2 size={16} className="animate-spin" />Please wait...</> : <>Send code<ArrowRight size={18} /></>}
        </Button>
      </form>
    </AuthCard>
  );
}
