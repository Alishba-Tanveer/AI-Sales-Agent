"use client";

import { useState } from "react";
import { Send, UserPlus } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TeamRole } from "../types";
import { selectCls } from "./settings-ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteDialog({
  open,
  onOpenChange,
  onInvite,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onInvite: (email: string, role: TeamRole) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("Member");
  const [error, setError] = useState<string | null>(null);

  const close = (o: boolean) => {
    if (!o) {
      setEmail("");
      setRole("Member");
      setError(null);
    }
    onOpenChange(o);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return setError("Please provide a valid work email.");
    onInvite(email.trim(), role);
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={submit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-primary" />
              Invite team member
            </DialogTitle>
            <DialogDescription>Collaborate on sequences and approvals.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-email" className="text-xs text-muted-foreground">Work email</Label>
              <Input id="inv-email" type="email" placeholder="colleague@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} className="h-9" aria-invalid={!!error} />
              {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-role" className="text-xs text-muted-foreground">Role</Label>
              <select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as TeamRole)} className={cn(selectCls, "h-9")}>
                <option>Member</option>
                <option>Admin</option>
                <option>Owner</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">An invitation link will be sent to their email valid for 7 days.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
            <Button type="submit" className="gap-1.5 font-semibold">
              <Send className="size-4" />
              Send Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
