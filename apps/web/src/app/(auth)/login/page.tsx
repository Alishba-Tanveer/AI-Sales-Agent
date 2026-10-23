"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError, ServerError, inputCls, primaryBtn } from "@/components/auth/auth-shell";
import { loginSchema, type LoginValues } from "@/features/auth/schemas";
import { loginUser } from "@/features/auth/api";
import { ApiError, hasValidSession } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the server answers 409 ACCOUNT_RESTORABLE: the password was right, the account is soft-deleted.
  const [restore, setRestore] = useState<{ message: string; daysLeft?: number; scope?: string } | null>(null);
  const { register, getValues, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { remember: true },
  });

  // already signed in (e.g. "Keep me signed in" was ticked last time) -> go straight to the dashboard
  useEffect(() => {
    if (hasValidSession()) router.replace("/overview");
  }, [router]);

  const signIn = async (v: LoginValues, restoreAccount = false) => {
    setError(null);
    try {
      await loginUser(v.email, v.password, !!v.remember, restoreAccount);
      router.push("/overview");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data.code === "ACCOUNT_RESTORABLE") {
        setRestore({ message: e.message, daysLeft: e.data.daysLeft as number | undefined, scope: e.data.scope as string | undefined });
        return;
      }
      setRestore(null);
      setError(e instanceof Error ? e.message : "Incorrect email or password.");
    }
  };
  const onSubmit = (v: LoginValues) => signIn(v);
  const [restoring, setRestoring] = useState(false);
  const confirmRestore = async () => {
    setRestoring(true);
    await signIn(getValues(), true);
    setRestoring(false);
  };

  return (
    <AuthCard
      title="Sign in to your account"
      subtitle="Welcome back. Enter your credentials to access your workspace."
      footer={<>Don&apos;t have an account?<Link href="/signup" className="ml-1 font-medium text-[#818CF8] hover:underline">Create Account</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <ServerError message={error} />
        {restore && (
          <div className="rounded-xl border border-[#818CF8]/30 bg-[#818CF8]/10 p-4 text-sm text-[#E5E7EB]">
            <p className="font-semibold">{restore.message}</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              {restore.scope === "workspace" ? "Your workspace and its team" : "Your account"} was deleted
              {restore.daysLeft != null ? ` and can be restored for ${restore.daysLeft} more day${restore.daysLeft === 1 ? "" : "s"}` : ""}.
            </p>
            <div className="mt-3 flex gap-2">
              <Button type="button" disabled={restoring} onClick={confirmRestore} className="h-10 min-w-0 flex-1 gap-2 rounded-lg bg-[#818CF8] text-sm font-semibold text-[#0B0F19] hover:bg-[#6366F1] disabled:opacity-70">
                {restoring ? "Restoring..." : "Yes, restore & sign in"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setRestore(null)} className="h-10 shrink-0 rounded-lg px-4 text-sm text-[#94A3B8] hover:bg-[#1A2030] hover:text-[#E5E7EB]">Cancel</Button>
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium text-[#E5E7EB]">Email address</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" className={inputCls} {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-medium text-[#E5E7EB]">Password</Label>
          <div className="relative">
            <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" className={`${inputCls} pr-10`} {...register("password")} />
            <button type="button" aria-label="Toggle password visibility" onClick={() => setShow((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#E5E7EB]">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <FieldError message={errors.password?.message} />
        </div>
        <div className="flex items-center justify-between pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[#94A3B8]">
            <input type="checkbox" className="h-4 w-4 accent-[#818CF8]" {...register("remember")} />
            Keep me signed in on this device
          </label>
          <Link href="/forgot-password" className="text-xs font-medium text-[#818CF8] hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" disabled={isSubmitting} className={`${primaryBtn} mt-2`}>
          {isSubmitting ? <><Loader2 size={16} className="animate-spin" />Signing in...</> : <>Sign In<ArrowRight size={18} /></>}
        </Button>
      </form>
    </AuthCard>
  );
}
