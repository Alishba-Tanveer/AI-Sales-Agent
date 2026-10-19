"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, LogOut, ShieldCheck, SquarePen, TriangleAlert, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logoutUser } from "@/features/auth/api";
import { userStore } from "@/features/auth/user-store";
import { TIMEZONES } from "../mock-data";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { Field, Pill, SaveButton, SectionCard, initials, inputCls, selectCls } from "./settings-ui";

const MAX_AVATAR = 2 * 1024 * 1024;

export function ProfileTab() {
  const router = useRouter();
  const user = userStore.get();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [roleTitle, setRoleTitle] = useState("Chief Growth Officer & Co-Founder");
  const [tz, setTz] = useState(TIMEZONES[1]);
  const [avatar, setAvatar] = useState<string | null>(null);

  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const roleLabel = user?.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : "Member";

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return void toast.error("Use a JPG, PNG or WEBP image.");
    if (file.size > MAX_AVATAR) return void toast.error("Image is larger than 2MB.");
    setAvatar(URL.createObjectURL(file));
    toast.success("Photo selected. Save changes to apply it.");
  };

  const savePassword = () => {
    if (!pw.current) return setPwError("Enter your current password.");
    if (pw.next.length < 6) return setPwError("New password must be at least 6 characters long.");
    if (pw.next !== pw.confirm) return setPwError("Passwords do not match.");
    setPwError(null);
    setPw({ current: "", next: "", confirm: "" });
    setPwOpen(false);
    toast.success("Password updated successfully");
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
              <Button
                variant="ghost"
                className="h-8 px-3 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => {
                  setAvatar(null);
                  toast("Photo removed");
                }}
              >
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
              {TIMEZONES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>

        <SaveButton onClick={() => toast.success("Profile saved")} />
      </SectionCard>

      <SectionCard
        icon={ShieldCheck}
        tone="warning"
        title="Security & Authentication"
        description="Password updated 3 weeks ago"
        aside={
          <Button variant="outline" className="h-9 gap-1.5 px-3.5 text-sm" onClick={() => setPwOpen((o) => !o)}>
            <SquarePen className="size-4" />
            Update Password
          </Button>
        }
      >
        {pwOpen && (
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-background p-4 md:grid-cols-3">
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
            <div className="flex items-center justify-between gap-3 md:col-span-3">
              <p role="alert" className="text-xs text-destructive">{pwError}</p>
              <div className="flex gap-2">
                <Button variant="outline" className="h-9 text-xs" onClick={() => { setPwOpen(false); setPwError(null); }}>Cancel</Button>
                <Button className="h-9 px-4 text-xs font-semibold" onClick={savePassword}>Save</Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col items-start justify-between gap-4 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">Active Session Clearance</span>
            <span className="text-xs text-muted-foreground">Currently signed in on this device</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => toast.success("Signed out of other sessions")}>
              Sign out other sessions
            </Button>
            <Button
              variant="destructive"
              className="h-8 gap-1.5 px-3 text-xs"
              onClick={() => {
                logoutUser();
                router.replace("/login");
              }}
            >
              <LogOut className="size-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </SectionCard>

      <section className="flex flex-col items-start justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive-soft/40 p-6 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-destructive">
            <TriangleAlert className="size-5" />
            <h2 className="text-base font-semibold">Delete account</h2>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Your account is deactivated right away. You have 30 days to restore it by signing in. After 30 days, your account, workspace, leads and drafts are permanently deleted and cannot be recovered.
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
