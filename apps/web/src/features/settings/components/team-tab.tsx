"use client";

import { useState } from "react";
import { Crown, MailPlus, MoreVertical, Plus, Shield, ShieldCheck, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { userStore } from "@/features/auth/user-store";
import { changeMemberRole, inviteMember, listTeam, removeTeamEntry, resendInvite } from "../api";
import { useLoad } from "../use-load";
import type { TeamMember, TeamRole } from "../types";
import { InviteDialog } from "./invite-dialog";
import { TabError, TabLoading } from "./load-states";
import { initials } from "./settings-ui";

const ROLES: { role: TeamRole; icon: typeof Shield; tone: string; text: string }[] = [
  { role: "Owner", icon: Shield, tone: "text-primary", text: "Full control over billing, security, tenant configurations, deletions, and member permissions." },
  { role: "Admin", icon: ShieldCheck, tone: "text-success", text: "Manage outreach settings, approval workflows, ICP targets, integrations, and leads." },
  { role: "Member", icon: Users, tone: "text-warning", text: "Review drafts, manage inbox replies, qualify opportunities, and approve outbound messages." },
];

export function TeamTab() {
  const { state, reload, set } = useLoad(listTeam);
  const [inviteOpen, setInviteOpen] = useState(false);

  if (state.status === "loading") return <TabLoading label="Loading your team…" />;
  if (state.status === "error") return <TabError message={state.message} onRetry={reload} />;
  const members = state.data;

  const me = userStore.get();
  const myRole = (me?.role ?? "").toUpperCase();
  const canManage = myRole === "OWNER" || myRole === "ADMIN";
  const isOwner = myRole === "OWNER";
  const isMe = (m: TeamMember) => m.id === me?.id;

  /** Run an API call, toast the outcome, then refresh the list so it always matches the server. */
  const run = async (action: () => Promise<{ message?: string }>, fallback: string) => {
    try {
      const res = await action();
      toast.success(res.message ?? fallback);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
    try {
      set(await listTeam());
    } catch {
      /* keep the list we have */
    }
  };

  const setRole = (m: TeamMember, role: TeamRole) => {
    if (role === m.role) return;
    return run(() => changeMemberRole(m.id, role), "Role updated");
  };
  const remove = (m: TeamMember) => {
    if (isMe(m)) return void toast.error("Cannot remove workspace owner");
    return run(() => removeTeamEntry(m), m.status === "Invited" ? "Invitation revoked" : "Member removed");
  };
  const invite = async (email: string, role: TeamRole) => {
    const res = await inviteMember(email, role);
    toast.success(res.message ?? `Invitation sent to ${email}`);
    try {
      set(await listTeam());
    } catch {
      /* the new invite shows up on the next refresh */
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2.5 text-base font-semibold text-foreground"><span className="flex size-8 items-center justify-center rounded-lg border border-primary/30 bg-primary-soft text-primary"><Users className="size-[18px]" /></span>Team Members &amp; Permissions</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Invite people to your workspace and set what they can do.</p>
        </div>
        <Button className="h-9 shrink-0 gap-1.5 px-4 text-sm font-semibold" disabled={!canManage} title={canManage ? undefined : "Only Owners and Admins can invite people"} onClick={() => setInviteOpen(true)}>
          <Plus className="size-[18px]" />
          Invite Member
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table className="min-w-[640px]">
          <TableHeader className="bg-background">
            <TableRow className="hover:bg-transparent">
              {["Member", "Role", "Status"].map((h) => (
                <TableHead key={h} className="px-4 text-xs font-medium tracking-wider text-muted-foreground uppercase first:px-5">{h}</TableHead>
              ))}
              <TableHead className="px-5 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const pending = m.status === "Invited";
              return (
                <TableRow key={m.id} className="h-14">
                  <TableCell className="px-5 py-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", pending ? "border-warning/40 bg-warning-soft text-warning" : "border-primary/40 bg-primary-soft text-primary")}>
                        {initials(m.name)}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-foreground">{m.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{m.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <select
                      aria-label={`Role for ${m.name}`}
                      value={m.role}
                      disabled={isMe(m) || !canManage}
                      onChange={(e) => setRole(m, e.target.value as TeamRole)}
                      className="rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs text-foreground outline-none focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-70 [&>option]:bg-popover"
                    >
                      <option disabled={!isOwner && m.role !== "Owner"}>Owner</option>
                      <option>Admin</option>
                      <option>Member</option>
                    </select>
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", pending ? "border-warning/30 bg-warning-soft text-warning" : "border-success/30 bg-success-soft text-success")}>
                      <span className={cn("size-1.5 rounded-full", pending ? "bg-warning" : "bg-success")} />
                      {m.status}
                    </span>
                  </TableCell>
                  <TableCell className="px-5 py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        disabled={!canManage}
                        aria-label={`Actions for ${m.name}`}
                        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <MoreVertical className="size-[18px]" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {pending ? (
                          <DropdownMenuItem onClick={() => run(() => resendInvite(m.id), "Invitation resent")}>
                            <MailPlus className="size-4" />
                            Resend invite
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => setRole(m, m.role === "Member" ? "Admin" : "Member")} disabled={isMe(m)}>
                            <Crown className="size-4" />
                            {m.role === "Member" ? "Make admin" : "Make member"}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => remove(m)} disabled={isMe(m)} className="text-destructive">
                          <UserMinus className="size-4" />
                          {pending ? "Revoke invite" : "Remove"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {ROLES.map(({ role, icon: Icon, tone, text }) => (
          <div key={role} className="rounded-lg border border-border bg-card p-3.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Icon className={cn("size-4", tone)} />
              {role}
            </span>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-sidebar p-3.5 text-xs text-muted-foreground">
        <Shield className="size-4 shrink-0 text-primary" />
        All configurations, training samples, and webhook keys are strictly segregated from other client organizations. Everyone can only see their own workspace&apos;s data.
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvite={invite} canAssignOwner={isOwner} />
    </div>
  );
}
