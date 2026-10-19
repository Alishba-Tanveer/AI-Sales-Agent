"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError, ServerError, inputCls, primaryBtn } from "@/components/auth/auth-shell";
import { resetSchema, type ResetValues } from "@/features/auth/schemas";
import { resetPassword } from "@/features/auth/api";

function ResetForm() {
  const token = useSearchParams().get("token");
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
  });

  if (!token) {
    return (
      <AuthCard title="Invalid reset link" subtitle="This link is missing its token. Request a new one to continue."
        footer={<Link href="/forgot-password" className="font-medium text-[#818CF8] hover:underline">Request a new link</Link>}>
        <ServerError message="The reset link is incomplete or has already been used." />
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
      await resetPassword(token, v.newPassword);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset your password.");
    }
  };

  return (
    <AuthCard title="Set a new password" subtitle="Choose a new password for your account."
      footer={<Link href="/forgot-password" className="hover:text-[#818CF8]">Link expired? Request a new one</Link>}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <ServerError message={error} />
        <div className="space-y-1.5">
          <Label htmlFor="newPassword" className="text-xs font-medium text-[#E5E7EB]">New password</Label>
          <div className="relative">
            <Input id="newPassword" type={show ? "text" : "password"} autoComplete="new-password" placeholder="••••••••••••" className={`${inputCls} pr-10`} {...register("newPassword")} />
            <button type="button" aria-label="Toggle password visibility" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#E5E7EB]">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <FieldError message={errors.newPassword?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-xs font-medium text-[#E5E7EB]">Confirm new password</Label>
          <Input id="confirmPassword" type={show ? "text" : "password"} autoComplete="new-password" placeholder="••••••••••••" className={inputCls} {...register("confirmPassword")} />
          <FieldError message={errors.confirmPassword?.message} />
        </div>
        <Button type="submit" disabled={isSubmitting} className={primaryBtn}>
          {isSubmitting ? <><Loader2 size={16} className="animate-spin" />Updating...</> : <>Reset Password<ArrowRight size={18} /></>}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>;
}
