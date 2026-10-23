"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError, ServerError, inputCls, primaryBtn } from "@/components/auth/auth-shell";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-fields";
import { passwordSchema } from "@/features/auth/schemas";
import { acceptInvite, lookupInvite, type InviteInfo } from "@/features/auth/api";

const NO_TOKEN_INVITE: InviteInfo = { state: "not_found", message: "This invitation link isn't valid. Ask for a new one." };

function AcceptInvite() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [fetched, setFetched] = useState<InviteInfo | null>(null);
  // no token in the link: nothing to look up, the link is simply not valid
  const invite = token ? fetched : NO_TOKEN_INVITE;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; password?: string; confirm?: string; terms?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    lookupInvite(token)
      .then((info) => {
        setFetched(info);
        if (info.name) setName(info.name);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Could not load this invitation."));
  }, [token]);

  if (loadError) {
    return <AuthCard title="Something went wrong" subtitle={loadError}><Button className={primaryBtn} onClick={() => location.reload()}>Try again</Button></AuthCard>;
  }
  if (!invite) {
    return <AuthCard title="Checking your invitation…" subtitle="One moment."><Loader2 className="mx-auto animate-spin text-[#818CF8]" /></AuthCard>;
  }

  const org = invite.organizationName ?? "the workspace";
  const role = (invite.role ?? "Member").toLowerCase();

  // Link is unusable (expired / cancelled / already used / unknown), or this account is not allowed to join.
  if (invite.state !== "valid" || !invite.canJoin) {
    return (
      <AuthCard
        title={invite.state === "accepted" ? "Invitation already used" : "Can't join this workspace"}
        subtitle={invite.blockedReason ?? invite.message ?? "This invitation can't be used."}
        footer={<Link href="/login" className="font-medium text-[#818CF8] hover:underline">Go to sign in</Link>}
      >
        <Button className={primaryBtn} onClick={() => router.push("/login")}>Sign in</Button>
      </AuthCard>
    );
  }

  const existing = !!invite.accountExists;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const next: typeof errors = {};
    if (!existing) {
      if (name.trim().length < 2) next.name = "Name must be at least 2 characters long";
      const pw = passwordSchema.safeParse(password);
      if (!pw.success) next.password = pw.error.issues[0].message;
      if (password !== confirm) next.confirm = "Passwords do not match.";
    } else if (!password) {
      next.password = "Enter your password";
    }
    if (!terms) next.terms = "You must agree to the Terms of Service and Privacy Policy to continue.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await acceptInvite(token, password, existing ? undefined : name.trim());
      router.push("/overview");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Could not accept the invitation.");
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title={`Join ${org} on AI Sales Agent`}
      subtitle={existing ? "Enter your password to join." : "A teammate invited you. Create your login to get started."}
      footer={<>Already joined?<Link href="/login" className="ml-1 font-medium text-[#818CF8] hover:underline">Sign in</Link></>}
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <ServerError message={serverError} />

        <div className="flex gap-3 rounded-xl border border-[#232A3B] bg-[#1A2030] p-4 text-sm text-[#94A3B8]">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-[#818CF8]" />
          <div>
            <p>You are invited to join <b className="text-[#E5E7EB]">{org}</b> as a <b className="text-[#E5E7EB]">{role}</b>.</p>
            <p className="mt-0.5">
              Invitation for <span className="text-[#E5E7EB]">{invite.email}</span>
              {invite.inviterName ? <> · invited by {invite.inviterName}</> : null}.
            </p>
          </div>
        </div>

        {!existing && (
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-medium text-[#94A3B8]">Full Name</Label>
            <Input id="name" autoComplete="name" placeholder="e.g. Sarah Mitchell" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            <FieldError message={errors.name} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-medium text-[#94A3B8]">{existing ? "Your password" : "Create Password"}</Label>
          <PasswordInput id="password" show={showPw} onToggle={() => setShowPw((s) => !s)} autoComplete={existing ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          {!existing && <PasswordStrength value={password} />}
          <FieldError message={errors.password} />
        </div>

        {!existing && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="text-xs font-medium text-[#94A3B8]">Confirm Password</Label>
            <PasswordInput id="confirm" show={showCpw} onToggle={() => setShowCpw((s) => !s)} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <FieldError message={errors.confirm} />
          </div>
        )}

        <div>
          <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-[#94A3B8]">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#818CF8]" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>I agree to the <a href="#" className="text-[#818CF8] hover:underline">Terms of Service</a> and <a href="#" className="text-[#818CF8] hover:underline">Privacy Policy</a>.</span>
          </label>
          <FieldError message={errors.terms} />
        </div>

        <Button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? <><Loader2 size={16} className="animate-spin" />Joining...</> : <>Accept &amp; Join<ArrowRight size={18} /></>}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function AcceptInvitePage() {
  return <Suspense fallback={null}><AcceptInvite /></Suspense>;
}
