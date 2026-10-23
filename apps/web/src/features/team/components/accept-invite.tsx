"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Clock, Loader2, MailX, MailWarning, ShieldCheck, TriangleAlert, UserCheck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError, ServerError, inputCls, primaryBtn } from "@/components/auth/auth-shell";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-fields";
import { acceptExistingSchema, acceptNewSchema, type AcceptExistingValues, type AcceptNewValues } from "@/features/auth/schemas";
import { acceptInvite, lookupInvite, type InviteInfo } from "@/features/auth/api";
import { userStore } from "@/features/auth/user-store";
import { hasValidSession } from "@/lib/api";
import { useMounted } from "@/lib/use-mounted";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; invite: InviteInfo };

/**
 * The page an invitation email links to: /accept-invite?token=...
 *
 *   new person        -> picks a name + password, the backend creates the account inside the inviting workspace
 *   existing person   -> enters their password to confirm it is them and join
 *   link not usable   -> says why (expired, revoked, already accepted) and what to do next
 *
 * No onboarding afterwards: the Owner already set the workspace up, so they go straight to the dashboard.
 */
export function AcceptInvite() {
  const token = useSearchParams().get("token") ?? "";
  const [load, setLoad] = useState<Load>(token ? { status: "loading" } : { status: "error", message: "This invitation link is incomplete. Open the link from your email again." });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    lookupInvite(token)
      .then((invite) => !cancelled && setLoad({ status: "ready", invite }))
      .catch((e) => !cancelled && setLoad({ status: "error", message: e instanceof Error ? e.message : "Could not check this invitation." }));
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  const retry = useCallback(() => {
    setLoad({ status: "loading" });
    setAttempt((a) => a + 1);
  }, []);

  if (load.status === "loading") {
    return (
      <AuthCard title="Checking your invitation" subtitle="One moment…">
        <div className="flex justify-center py-6 text-[#94A3B8]" role="status"><Loader2 className="animate-spin" /></div>
      </AuthCard>
    );
  }

  if (load.status === "error") {
    return (
      <Notice
        icon={TriangleAlert}
        title="We couldn't open this invitation"
        text={load.message}
        action={token ? <Button onClick={retry} className={primaryBtn}>Try again</Button> : undefined}
      />
    );
  }

  const { invite } = load;
  const org = invite.organizationName ?? "the workspace";

  if (invite.state === "expired") {
    return <Notice icon={Clock} title="This invitation has expired" text={`Invitations are valid for 7 days. Ask an Owner or Admin of ${org} to resend it, and use the new link in your email.`} />;
  }
  if (invite.state === "cancelled") {
    return <Notice icon={MailX} title="This invitation was cancelled" text={`An admin of ${org} withdrew this invitation. If you think that's a mistake, ask them to invite you again.`} />;
  }
  if (invite.state === "accepted") {
    return <Notice icon={UserCheck} title="This invitation was already used" text={`You have already joined ${org}. Sign in with your email and password to continue.`} action={<SignInLink />} />;
  }

  return <InviteForm token={token} invite={invite} />;
}

function SignInLink() {
  return (
    <Link href="/login" className={`${primaryBtn} inline-flex items-center justify-center`}>
      Go to Sign In
      <ArrowRight size={18} />
    </Link>
  );
}

function Notice({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: React.ReactNode }) {
  return (
    <AuthCard title={title} subtitle={text} footer={<Link href="/login" className="hover:text-[#818CF8]">Return to Sign In</Link>}>
      <div className="flex flex-col items-center gap-4">
        <span className="flex size-12 items-center justify-center rounded-full border border-[#453415] bg-[#2E2210] text-[#FBBF24]">
          <Icon size={22} />
        </span>
        {action && <div className="w-full">{action}</div>}
      </div>
    </AuthCard>
  );
}

function InviteForm({ token, invite }: { token: string; invite: InviteInfo }) {
  const exists = !!invite.accountExists;
  const org = invite.organizationName ?? "the workspace";
  // signed in on this device as somebody else: accepting switches the device to the invited account
  // (read from localStorage, so only after mount: the server render and the first client render must match)
  const mounted = useMounted();
  const me = mounted ? userStore.get() : null;
  const otherAccount =
    mounted && hasValidSession() && me?.email && me.email.toLowerCase() !== (invite.email ?? "").toLowerCase() ? me.email : null;

  return (
    <AuthCard
      title={exists ? `Join ${org}` : `Join ${org} on AI Sales Agent`}
      subtitle={
        exists
          ? "You already have an account. Enter your password to join this workspace."
          : `${invite.inviterName ?? "A teammate"} invited you. Create your login to get started.`
      }
      footer={<Link href="/login" className="hover:text-[#818CF8]">Already joined? Sign in</Link>}
    >
      <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-[#232A3B] bg-[#1A2030] p-3 text-xs leading-relaxed text-[#94A3B8]">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#818CF8]" />
        <p>
          You are joining <span className="font-semibold text-[#E5E7EB]">{org}</span> as{" "}
          <span className="font-semibold text-[#E5E7EB]">{invite.role}</span>.<br />
          Invitation for <span className="font-semibold text-[#E5E7EB]">{invite.email}</span>
          {invite.expiresAt && <> · valid until {new Date(invite.expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</>}.
        </p>
      </div>

      {otherAccount && (
        <div role="status" className="mb-4 flex items-start gap-2.5 rounded-lg border border-[#453415] bg-[#2E2210] p-3 text-xs leading-relaxed text-[#FBBF24]">
          <MailWarning size={18} className="mt-0.5 shrink-0" />
          <p>This device is signed in as {otherAccount}. Joining will sign that account out here and switch to {invite.email}.</p>
        </div>
      )}

      {exists ? <ExistingForm token={token} /> : <NewForm token={token} />}
    </AuthCard>
  );
}

function useFinish() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const run = async (v: { token: string; password: string; name?: string }) => {
    setError(null);
    try {
      await acceptInvite(v.token, v.password, v.name);
      router.replace("/overview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept the invitation.");
    }
  };
  return { error, run };
}

function NewForm({ token }: { token: string }) {
  const { error, run } = useFinish();
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<AcceptNewValues>({ resolver: zodResolver(acceptNewSchema) });
  const pw = useWatch({ control, name: "password" }) ?? "";

  return (
    <form onSubmit={handleSubmit((v) => run({ token, name: v.name, password: v.password }))} className="flex flex-col gap-4" noValidate>
      <ServerError message={error} />
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-xs font-medium text-[#94A3B8]">Full Name</Label>
        <Input id="name" autoComplete="name" placeholder="e.g. Sarah Mitchell" className={inputCls} {...register("name")} />
        <FieldError message={errors.name?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-xs font-medium text-[#94A3B8]">Create Password</Label>
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
          <span>I agree to the <a href="#" className="text-[#818CF8] hover:underline">Terms of Service</a> and <a href="#" className="text-[#818CF8] hover:underline">Privacy Policy</a>.</span>
        </label>
        <FieldError message={errors.terms?.message} />
      </div>
      <Button type="submit" disabled={isSubmitting} className={primaryBtn}>
        {isSubmitting ? <><Loader2 size={16} className="animate-spin" />Joining workspace...</> : <>Accept &amp; Join<ArrowRight size={18} /></>}
      </Button>
    </form>
  );
}

function ExistingForm({ token }: { token: string }) {
  const { error, run } = useFinish();
  const [show, setShow] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AcceptExistingValues>({ resolver: zodResolver(acceptExistingSchema) });

  return (
    <form onSubmit={handleSubmit((v) => run({ token, password: v.password }))} className="flex flex-col gap-4" noValidate>
      <ServerError message={error} />
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-xs font-medium text-[#94A3B8]">Your Password</Label>
        <PasswordInput id="password" show={show} onToggle={() => setShow((s) => !s)} autoComplete="current-password" placeholder="Enter your password" {...register("password")} />
        <FieldError message={errors.password?.message} />
      </div>
      <Button type="submit" disabled={isSubmitting} className={primaryBtn}>
        {isSubmitting ? <><Loader2 size={16} className="animate-spin" />Joining workspace...</> : <>Join Workspace<ArrowRight size={18} /></>}
      </Button>
      <Link href="/forgot-password" className="text-center text-xs font-medium text-[#818CF8] hover:underline">Forgot password?</Link>
    </form>
  );
}
