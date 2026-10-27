"use client";

import { useState } from "react";
import { ArchiveRestore, ChevronDown, Crown, MailPlus, MoreVertical, Plus, Shield, ShieldCheck, UserMinus, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { userStore } from "@/features/auth/user-store";
import { can, currentRole } from "@/lib/permissions";
import { changeMemberRole, inviteMember, listRemoved, listTeam, removeTeamEntry, restoreMember, resendInvite } from "../api";
import { useLoad } from "../use-load";
import { isPendingInvite } from "../types";
import type { RemovedMember, TeamMember, TeamRole } from "../types";
import type { LoadState } from "../use-load";
import { InviteDialog } from "./invite-dialog";
import { TransferOwnershipDialog } from "./transfer-ownership-dialog";
import { TabError, TabLoading } from "./load-states";
import { CARD_HOVER, CARD_LIFT, CARD_ROW, ICON_POP, PersonAvatar, TONES, initials } from "./settings-ui";

const ROLES: { role: TeamRole; icon: typeof Shield; tone: string; text: string }[] = [
  { role: "Owner", icon: Shield, tone: "text-primary", text: "Full control over billing, security, tenant configurations, deletions, and member permissions." },
  { role: "Admin", icon: ShieldCheck, tone: "text-success", text: "Manage outreach settings, approval workflows, ICP targets, integrations, and leads." },
  { role: "Member", icon: Users, tone: "text-warning", text: "Review drafts, manage inbox replies, qualify opportunities, and approve outbound messages." },
];

const STATUS_TONES = {
  success: { badge: "border-success/30 bg-success-soft text-success", dot: "bg-success" },
  warning: { badge: "border-warning/30 bg-warning-soft text-warning", dot: "bg-warning" },
  destructive: { badge: "border-destructive/30 bg-destructive-soft text-destructive", dot: "bg-destructive" },
} as const;

export function TeamTab() {
  const { state, reload, set } = useLoad(listTeam);
  // Members can't see or restore removed accounts, so they never ask for the list (it would just be a 403).
  const { state: removedState, set: setRemoved } = useLoad(() => (can.manageTeam(currentRole()) ? listRemoved() : Promise.resolve([])));
  const [inviteOpen, setInviteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferId, setTransferId] = useState<string | null>(null);

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
    try {
      setRemoved(await listRemoved());
    } catch {
      /* keep the list we have */
    }
  };

  const openTransfer = (id: string | null) => {
    setTransferId(id);
    setTransferOpen(true);
  };
  const setRole = (m: TeamMember, role: TeamRole) => {
    if (role === m.role) return;
    // "Owner" is not a normal role change: there is exactly one Owner, so it opens the transfer dialog for that person
    if (role === "Owner") return void (isOwner && !isPendingInvite(m) && openTransfer(m.id));
    return run(() => changeMemberRole(m.id, role), "Role updated");
  };
  const remove = (m: TeamMember) => {
    if (isMe(m)) return void toast.error("Cannot remove workspace owner");
    return run(() => removeTeamEntry(m), isPendingInvite(m) ? "Invitation revoked" : "Member removed");
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
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isOwner && (
            <Button variant="outline" className="h-9 gap-1.5 px-4 text-sm font-semibold" onClick={() => openTransfer(null)}>
              <Crown className="size-[18px]" />
              Transfer Ownership
            </Button>
          )}
          <Button className="h-9 gap-1.5 px-4 text-sm font-semibold" disabled={!canManage} title={canManage ? undefined : "Only Owners and Admins can invite people"} onClick={() => setInviteOpen(true)}>
            <Plus className="size-[18px]" />
            Invite Member
          </Button>
        </div>
      </div>

      <div className={cn("overflow-hidden rounded-xl border border-border bg-card", CARD_HOVER)}>
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
              const pending = isPendingInvite(m);
              const statusTone = m.status === "Email failed" ? "destructive" : pending ? "warning" : "success";
              return (
                <TableRow key={m.id} className={cn("h-14", CARD_ROW)}>
                  <TableCell className="px-5 py-2">
                    <div className="flex min-w-0 items-center gap-3">
                      {pending ? (
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-warning/50 bg-warning-soft text-xs font-semibold text-warning">
                          {initials(m.name)}
                        </div>
                      ) : (
                        <PersonAvatar name={m.name} id={m.id} />
                      )}
                      <div className="flex min-w-0 flex-col">
                        <span className="[overflow-wrap:anywhere] text-sm font-medium text-foreground">{m.name}</span>
                        <span className="[overflow-wrap:anywhere] text-xs text-muted-foreground">{m.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    {/* same width for Owner / Admin / Member, own chevron so the spacing doesn't depend on the browser */}
                    <div className="relative w-28">
                      <select
                        aria-label={`Role for ${m.name}`}
                        value={m.role}
                        disabled={isMe(m) || !canManage || m.role === "Owner"}
                        onChange={(e) => setRole(m, e.target.value as TeamRole)}
                        className="h-8 w-full cursor-pointer appearance-none rounded-lg border border-border bg-secondary pr-8 pl-3 text-xs font-medium text-foreground outline-none transition-colors hover:border-primary/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:border-border [&>option]:bg-popover"
                      >
                        <option disabled={!isOwner && m.role !== "Owner"}>Owner</option>
                        <option>Admin</option>
                        <option>Member</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUS_TONES[statusTone].badge)} title={(pending && m.reason) || undefined}>
                      <span className={cn("size-1.5 rounded-full", STATUS_TONES[statusTone].dot)} />
                      {m.status}
                    </span>
                  </TableCell>
                  <TableCell className="px-5 py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        disabled={!canManage || m.role === "Owner"}
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
                          <>
                            <DropdownMenuItem onClick={() => setRole(m, m.role === "Member" ? "Admin" : "Member")} disabled={isMe(m)}>
                              <Crown className="size-4" />
                              {m.role === "Member" ? "Make admin" : "Make member"}
                            </DropdownMenuItem>
                            {isOwner && !isMe(m) && (
                              <DropdownMenuItem onClick={() => openTransfer(m.id)}>
                                <Shield className="size-4" />
                                Make owner
                              </DropdownMenuItem>
                            )}
                          </>
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

      <RecentlyRemoved
        state={removedState}
        canManage={canManage}
        onRestore={(m) => run(() => restoreMember(m.id), `${m.name} was restored to the team`)}
      />

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {ROLES.map(({ role, icon: Icon, tone, text }) => (
          <div key={role} className={cn("rounded-lg border border-border bg-card p-3.5", CARD_LIFT)}>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Icon className={cn("size-4", ICON_POP, tone)} />
              {role}
            </span>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground transition-colors duration-200 group-hover:text-foreground">{text}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-sidebar p-3.5 text-xs text-muted-foreground">
        <Shield className="size-4 shrink-0 text-primary" />
        All configurations, training samples, and webhook keys are strictly segregated from other client organizations. Everyone can only see their own workspace&apos;s data.
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvite={invite} canAssignOwner={isOwner} />
      <TransferOwnershipDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        initialId={transferId}
        candidates={members.filter((m) => !isPendingInvite(m) && m.role !== "Owner" && !isMe(m))}
      />
    </div>
  );
}

function RemovedRow({ m, canManage, onRestore }: { m: RemovedMember; canManage: boolean; onRestore: (m: RemovedMember) => void }) {
  return (
    <li className={cn("flex items-center justify-between gap-3 px-4 py-3", CARD_ROW)}>
      <div className="flex min-w-0 items-center gap-3">
        <PersonAvatar name={m.name} id={m.id} />
        <div className="flex min-w-0 flex-col">
          <span className="[overflow-wrap:anywhere] text-sm font-medium text-foreground">{m.name} <span className="text-xs font-normal text-muted-foreground">· {m.role}</span></span>
          <span className="[overflow-wrap:anywhere] text-xs text-muted-foreground">
            {m.email} · {m.reason === "ADMIN" ? `removed by ${m.removedBy}` : "deleted their own account"} · {m.daysLeft} day{m.daysLeft === 1 ? "" : "s"} left
          </span>
        </div>
      </div>
      {m.canRestore ? (
        <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 font-semibold" disabled={!canManage} onClick={() => onRestore(m)}>
          <ArchiveRestore className="size-4" />
          Restore
        </Button>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">They can restore it by signing in</span>
      )}
    </li>
  );
}

/** "Recently removed": two separate groups, people an admin removed and people who deleted their own account. */
function RecentlyRemoved({ state, canManage, onRestore }: { state: LoadState<RemovedMember[]>; canManage: boolean; onRestore: (m: RemovedMember) => void }) {
  if (!canManage) return null;
  const rows = state.status === "ready" ? state.data : [];
  const byAdmin = rows.filter((m) => m.reason === "ADMIN");
  const bySelf = rows.filter((m) => m.reason === "SELF");

  const group = (title: string, hint: string, list: RemovedMember[]) =>
    list.length > 0 && (
      <div className={cn("overflow-hidden rounded-xl border border-border bg-card", CARD_HOVER)}>
        <div className="border-b border-border px-4 py-2.5">
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <ul className="divide-y divide-border">
          {list.map((m) => <RemovedRow key={m.id} m={m} canManage={canManage} onRestore={onRestore} />)}
        </ul>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><span className={cn("flex size-7 items-center justify-center rounded-lg border", TONES.warning.tile)}><UserX className="size-4" /></span>Recently removed</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Removed or deleted accounts can be restored for 30 days. After that they are permanently deleted.</p>
      </div>
      {state.status === "loading" && <p className="text-xs text-muted-foreground">Loading…</p>}
      {state.status === "error" && <p className="text-xs text-destructive">{state.message}</p>}
      {state.status === "ready" && rows.length === 0 && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-8 text-xs text-muted-foreground">
          <UserX className="size-4 text-warning" />No removed accounts right now.
        </div>
      )}
      {group("Removed by an admin", "An Owner or Admin can restore these people.", byAdmin)}
      {group("Deleted their own account", "These people left on their own. Only they can restore the account, by signing in.", bySelf)}
    </div>
  );
}
