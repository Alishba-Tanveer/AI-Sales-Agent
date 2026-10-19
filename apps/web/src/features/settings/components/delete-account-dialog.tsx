"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const ready = password.length > 0 && confirm.trim() === "DELETE";

  const close = (o: boolean) => {
    if (!o) {
      setPassword("");
      setConfirm("");
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-4" />
            Delete account
          </DialogTitle>
          <DialogDescription>You have 30 days to restore it by signing in. After that it cannot be recovered.</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/20 bg-destructive-soft p-3 text-xs leading-relaxed text-destructive">
          All campaigns, AI pipelines, personas and synced outreach history will be permanently deleted after 30 days.
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="del-password" className="text-xs text-muted-foreground">Enter your password</Label>
            <Input id="del-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-9" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="del-confirm" className="text-xs text-muted-foreground">
              Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm
            </Label>
            <Input id="del-confirm" placeholder="DELETE" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-9" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!ready}
            onClick={() => {
              close(false);
              toast.success("Account scheduled for deactivation.");
            }}
          >
            <Trash2 />
            Delete account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
