"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, LogOut, Save, ShieldCheck, SquarePen, TriangleAlert, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logoutUser } from "@/features/auth/api";
import { passwordSchema } from "@/features/auth/schemas";
import { changePassword, getProfile, removeAvatar, saveProfile, signOutOtherSessions, uploadAvatar } from "../api";
import { TIMEZONES } from "../constants";
import { useLoad } from "../use-load";
import type { UserProfile } from "../types";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { TabError, TabLoading } from "./load-states";
import { cn } from "cn";
import { CARD_INNER, Field, Pill, SectionCard, initials, inputCls, selectCls } from "./settings-ui";

const MAX_AVATAR = 2 * 1024 * 1024;

/** "3 weeks ago" style text for the password-changed line. */
function timeAgo(iso: string | null) {
  if (!iso) return "Password has not been changed yet";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "Password updated just now";
  const units: [string, number][] = [["minute", 60], ["hour", 24], ["day", 7], ["week", 4.345], ["month", 12], ["year", Infinity]];
  let value = mins;
  for (const [name, step] of units) {
    if (value < step) {
      const n = Math.max(1, Math.floor(value));
      return `Password updated ${n} ${name}${n === 1 ? "" : "s"} ago`;
    }
    value /= step;
  }
  return "Password updated a long time ago";
}

export function ProfileTab() {
  const { state, reload } = useLoad(getProfile);
  if (state.status === "loading") return <TabLoading label="Loading your profile…" />;
  if (state.status === "error") return <TabError message={state.message} onRetry={reload} />;
  return <ProfileForm initial={state.data} />;
}

function ProfileForm({ initial }: { initial: UserProfile }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [saved, setSaved] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [roleTitle, setRoleTitle] = useState(initial.roleTitle);
  const [tz, setTz] = useState(initial.timezone);
  // a photo picked but not saved yet (it uploads together with "Save Changes")
  const [pending, setPending] = useState<{ file: File; preview: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [othersBusy, setOthersBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const roleLabel = saved.role ? saved.role.charAt(0) + saved.role.slice(1).toLowerCase() : "Member";
  const avatar = pending?.preview ?? saved.avatar;
  const timezones = TIMEZONES.includes(tz) || !tz ? TIMEZONES : [tz, ...TIMEZONES];

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return void toast.error("Use a JPG, PNG or WEBP image.");
    if (file.size > MAX_AVATAR) return void toast.error("Image is larger than 2MB.");
    if (pending) URL.revokeObjectURL(pending.preview);
    setPending({ file, preview: URL.createObjectURL(file) });
    toast.success("Photo selected. Save changes to apply it.");
  };

  const onRemovePhoto = async () => {
    if (pending) {
      URL.revokeObjectURL(pending.preview);
      setPending(null);
    }
    if (!saved.avatar) return void toast("Photo removed");
    try {
      setSaved(await removeAvatar());
      toast("Photo removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove your photo.");
    }
  };

  const save = async () => {
    if (name.trim().length < 2) return void toast.error("Name must be at least 2 characters long");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return void toast.error("Invalid email address");
    setSaving(true);
    try {
      let next = saved;
      if (pending) {
        next = await uploadAvatar(pending.file);
        URL.revokeObjectURL(pending.preview);
        setPending(null);
        setSaved(next);
      }
      next = await saveProfile({ name: name.trim(), email: email.trim(), roleTitle: roleTitle.trim(), timezone: tz });
      setSaved(next);
      setName(next.name);
      setEmail(next.email);
      toast.success("Profile saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    if (!pw.current) return setPwError("Enter your current password.");
    const strength = passwordSchema.safeParse(pw.next);
    if (!strength.success) return setPwError(strength.error.issues[0].message);
    if (pw.next !== pw.confirm) return setPwError("Passwords do not match.");
    setPwError(null);
    setPwBusy(true);
    try {
      const res = await changePassword(pw.current, pw.next);
      setSaved((s) => ({ ...s, passwordChangedAt: res.passwordChangedAt }));
      setPw({ current: "", next: "", confirm: "" });
      setPwOpen(false);
      toast.success("Password updated successfully");
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "Could not update your password.");
    } finally {
      setPwBusy(false);
    }
  };

  const signOutOthers = async () => {
    setOthersBusy(true);
    try {
      await signOutOtherSessions();
      toast.success("Signed out of other sessions");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sign out other sessions.");
    } finally {
      setOthersBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        icon={User}
        title="Personal Identification"
        description="Manage your credentials, direct avatar, and security clearance."
        aside={<Pill tone="success">Workspace {roleLabel}</Pill>}
      >
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-primary-soft text-xl font-semibold text-primary">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="Profile" className="size-full object-cover" />
            ) : (
              initials(name)
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickPhoto} />
              <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => fileRef.current?.click()}>
                Change photo
              </Button>
              <Button variant="ghost" className="h-8 px-3 text-xs text-muted-foreground hover:text-destructive" onClick={onRemovePhoto}>
                Remove
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Supported files: JPG, PNG or WEBP. Max resolution 800x800px (2MB max).</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Full Name" htmlFor="pf-name">
            <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field
            label="Email Address"
            htmlFor="pf-email"
            aside={
              <span className="flex items-center gap-1 text-[11px] font-semibold text-success">
                <BadgeCheck className="size-3.5" />
                Verified
              </span>
            }
          >
            <Input id="pf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Role Title" htmlFor="pf-role">
            <Input id="pf-role" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Timezone Offset" htmlFor="pf-tz">
            <select id="pf-tz" value={tz} onChange={(e) => setTz(e.target.value)} className={selectCls}>
              {timezones.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex items-center justify-end border-t border-border pt-4">
          <Button type="button" onClick={save} disabled={saving} className="h-9 gap-1.5 px-5 text-sm font-semibold">
            {saving ? <Loader2 className="size-[18px] animate-spin" /> : <Save className="size-[18px]" />}
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        icon={ShieldCheck}
        tone="warning"
        title="Security & Authentication"
        description={timeAgo(saved.passwordChangedAt)}
        aside={
          <Button variant="outline" className="h-9 gap-1.5 px-3.5 text-sm" onClick={() => setPwOpen((o) => !o)}>
            <SquarePen className="size-4" />
            Update Password
          </Button>
        }
      >
        {pwOpen && (
          <div className={cn("grid grid-cols-1 gap-4 rounded-lg border border-border bg-background p-4 md:grid-cols-3", CARD_INNER)}>
            {(
              [
                ["current", "Current Password", "••••••••••••", "current-password"],
                ["next", "New Password", "Min. 6 characters", "new-password"],
                ["confirm", "Confirm New Password", "Re-type password", "new-password"],
              ] as const
            ).map(([key, label, ph, ac]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label htmlFor={`pw-${key}`} className="text-[11px] tracking-wider text-muted-foreground uppercase">{label}</Label>
                <Input id={`pw-${key}`} type="password" autoComplete={ac} placeholder={ph} value={pw[key]} onChange={(e) => setPw((p) => ({ ...p, [key]: e.target.value }))} className="h-9" />
              </div>
            ))}
            <p className="text-xs text-muted-foreground md:col-span-3">Use at least 6 characters with an uppercase letter, a lowercase letter, a number and a symbol.</p>
            <div className="flex items-center justify-between gap-3 md:col-span-3">
              <p role="alert" className="text-xs text-destructive">{pwError}</p>
              <div className="flex gap-2">
                <Button variant="outline" className="h-9 text-xs" disabled={pwBusy} onClick={() => { setPwOpen(false); setPwError(null); }}>Cancel</Button>
                <Button className="h-9 px-4 text-xs font-semibold" disabled={pwBusy} onClick={savePassword}>
                  {pwBusy && <Loader2 className="animate-spin" />}
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className={cn("flex flex-col items-start justify-between gap-4 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center", CARD_INNER)}>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">Active Session Clearance</span>
            <span className="text-xs text-muted-foreground">Currently signed in on this device</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="h-8 px-3 text-xs" disabled={othersBusy} onClick={signOutOthers}>
              {othersBusy && <Loader2 className="animate-spin" />}
              Sign out other sessions
            </Button>
            <Button
              variant="destructive"
              className="h-8 gap-1.5 px-3 text-xs"
              onClick={async () => {
                await logoutUser();
                router.replace("/login");
              }}
            >
              <LogOut className="size-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </SectionCard>

      <section className={cn("flex flex-col items-start justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive-soft/40 p-6 transition-all duration-200 hover:border-destructive/50 hover:shadow-lg hover:shadow-destructive/10 sm:flex-row sm:items-center")}>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-destructive">
            <TriangleAlert className="size-5" />
            <h2 className="text-base font-semibold">Delete account</h2>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Your account is deactivated right away. You have 30 days to restore it by signing in. After 30 days it is permanently deleted and cannot be recovered. If you are the Owner, you can transfer the business to a team member first, or delete the whole business.
          </p>
        </div>
        <Button variant="destructive" className="h-9 shrink-0 gap-2 border border-destructive/40 px-4 text-sm font-semibold" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="size-4" />
          Delete Account
        </Button>
      </section>

      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
