"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logoutUser } from "@/features/auth/api";
import { deleteAccount } from "../api";

export function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = password.length > 0 && confirm.trim() === "DELETE";

  const close = (o: boolean) => {
    if (busy) return;
    if (!o) {
      setPassword("");
      setConfirm("");
      setError(null);
    }
    onOpenChange(o);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      toast.success("Account scheduled for deactivation.");
      // the server already revoked this token; this just clears the local session
      await logoutUser();
      router.replace("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete your account.");
      setBusy(false);
    }
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
            <Input id="del-password" type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} className="h-9" aria-invalid={!!error} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="del-confirm" className="text-xs text-muted-foreground">
              Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm
            </Label>
            <Input id="del-confirm" placeholder="DELETE" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-9" />
          </div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => close(false)}>Cancel</Button>
          <Button variant="destructive" disabled={!ready || busy} onClick={submit}>
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Delete account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
