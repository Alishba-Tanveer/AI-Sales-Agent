"use client";

import { useState } from "react";
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

export default function LoginPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { remember: true },
  });

  const onSubmit = async (v: LoginValues) => {
    setError(null);
    try {
      await loginUser(v.email, v.password);
      router.push("/overview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Incorrect email or password.");
    }
  };

  return (
    <AuthCard
      title="Sign in to your account"
      subtitle="Welcome back. Enter your credentials to access your workspace."
      footer={<>Don&apos;t have an account?<Link href="/signup" className="ml-1 font-medium text-[#818CF8] hover:underline">Create Account</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <ServerError message={error} />
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
            Remember this device for 30 days
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
