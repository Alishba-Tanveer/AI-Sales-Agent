"use client";

import { useState } from "react";
import { Loader2, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { LeadCommunication } from "@/features/leads/types";
import { approveAndSend } from "../api";

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

/**
 * The human approval step for automated sending. The person sees exactly what will go out, can edit it,
 * and nothing is sent until "Approve & send" is pressed.
 */
export function SendEmailDialog({ draft, leadName, leadEmail, testRedirectTo, onClose, onSent }: {
  draft: LeadCommunication | null;
  leadName: string;
  leadEmail: string | null;
  testRedirectTo?: string | null;
  onClose: () => void;
  onSent: (message: LeadCommunication) => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  // Load the draft's text each time a different draft is opened (adjusting state while rendering, not inside an effect).
  // Closing sets `draft` to null, but the dialog is still fading out for a moment. The text is kept until a different draft
  // opens; clearing it on close made the fields go empty mid-animation, which looked like a second box flashing.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (draft && draft.id !== loadedId) { setLoadedId(draft.id); setSubject(draft.subject ?? ""); setBody(draft.body ?? ""); }

  const send = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const result = await approveAndSend(draft.id, { subject, body });
      toast.success(result.redirectedTo ? `Test mode: sent to ${result.redirectedTo} instead of ${leadName}.` : `Email sent to ${leadName}.`);
      onSent(result.message);
      onClose();
    } catch (e) { toast.error(errorText(e)); }
    finally { setBusy(false); }
  };

  return <Dialog open={!!draft} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto" style={{ width: "min(100% - 2rem, max(70vw, 28rem))", maxWidth: "min(100% - 2rem, max(70vw, 28rem))" }}>
      <DialogHeader>
        <DialogTitle>Review and send</DialogTitle>
        <DialogDescription>This email is sent from your connected mailbox only after you approve it. You can edit it first.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"><span className="text-muted-foreground">To: </span><span className="font-medium">{leadName}</span> <span className="text-muted-foreground">{leadEmail ? `<${leadEmail}>` : "(no email address)"}</span></div>
        {testRedirectTo && <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-warning"/><p><span className="font-medium">Test mode is on.</span> This email will be delivered to <span className="font-medium">{testRedirectTo}</span>, not to {leadName}.</p></div>}
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={240} aria-label="Subject" placeholder="Subject"/>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} aria-label="Message" className="leading-6"/>
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button disabled={busy || !subject.trim() || !body.trim() || !leadEmail} onClick={() => void send()}>{busy ? <Loader2 className="animate-spin"/> : <Send/>}Approve & send</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
