"use client";

import { useState } from "react";
import { ExternalLink, Inbox, Loader2, Mail, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IntegrationCard, Row } from "@/features/integrations/components/integrations-ui";
import { connectMailbox, disconnectMailbox, saveMailboxSettings, syncMailboxNow } from "../api";
import { useMailbox } from "../use-mailbox";
import type { SyncResult } from "../types";

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "Not yet");

function Check({ checked, onChange, disabled, children }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; children: React.ReactNode }) {
  return <label className={cn("flex cursor-pointer items-start gap-2 text-sm", disabled && "cursor-not-allowed opacity-60")}>
    <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    <span>{children}</span>
  </label>;
}

function describe(result: SyncResult) {
  if (result.baseline) return "Mailbox linked. Replies that arrive from now on will be picked up automatically.";
  const parts = [`${result.imported} new ${result.imported === 1 ? "reply" : "replies"}`];
  if (result.drafted) parts.push(`${result.drafted} reply ${result.drafted === 1 ? "draft" : "drafts"} waiting for approval`);
  if (result.bounced) parts.push(`${result.bounced} bounced`);
  return `Checked ${result.checked} new ${result.checked === 1 ? "email" : "emails"}: ${parts.join(", ")}.`;
}

/** Connect the workspace mailbox so approved emails are sent, and replies arrive, without copy and paste. */
export function MailboxCard() {
  const { mailbox, reload, setMailbox } = useMailbox();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"" | "connect" | "sync" | "lookback" | "settings" | "disconnect">("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [imapHost, setImapHost] = useState("imap.gmail.com");
  const [imapPort, setImapPort] = useState("993");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("465");
  const [limit, setLimit] = useState("");

  const connected = mailbox?.connected === true ? mailbox : null;
  const broken = connected?.status === "error";

  const connect = async () => {
    setBusy("connect");
    try {
      const next = await connectMailbox({
        email, password, fromName: fromName || undefined,
        ...(advanced ? { imapHost, imapPort: Number(imapPort), smtpHost, smtpPort: Number(smtpPort) } : {}),
      });
      setMailbox(next); setOpen(false); setPassword("");
      toast.success("Mailbox connected. Approved emails now send from it, and replies sync automatically.");
      void syncMailboxNow().catch(() => {}); // sets the starting point for reply sync right away
    } catch (e) { toast.error(errorText(e)); }
    finally { setBusy(""); }
  };
  const sync = async (lookbackDays?: number) => {
    setBusy(lookbackDays ? "lookback" : "sync");
    try { const { result, mailbox: next } = await syncMailboxNow(lookbackDays); setMailbox(next); toast.success(describe(result)); }
    catch (e) { toast.error(errorText(e)); void reload(); }
    finally { setBusy(""); }
  };
  const save = async (patch: Parameters<typeof saveMailboxSettings>[0]) => {
    setBusy("settings");
    try { setMailbox(await saveMailboxSettings(patch)); }
    catch (e) { toast.error(errorText(e)); }
    finally { setBusy(""); }
  };
  const disconnect = async () => {
    if (!window.confirm("Disconnect the mailbox? Automatic sending and reply sync stop. Manual copy and paste keeps working.")) return;
    setBusy("disconnect");
    try { await disconnectMailbox(); setMailbox({ connected: false, testRedirectTo: mailbox?.testRedirectTo ?? null }); toast.success("Mailbox disconnected."); }
    catch (e) { toast.error(errorText(e)); }
    finally { setBusy(""); }
  };

  return <>
    <IntegrationCard
      icon={Inbox}
      tone="success"
      title="Mailbox automation"
      subtitle="Send approved emails and receive replies automatically."
      status={connected ? (broken ? "setup" : "automated") : "setup"}
      actions={connected ? <>
        <Button size="sm" disabled={busy !== ""} onClick={() => void sync()}>{busy === "sync" ? <Loader2 className="animate-spin"/> : <RefreshCw/>}Sync now</Button>
        <Button size="sm" variant="outline" disabled={busy !== ""} onClick={() => void sync(7)} title="Also look at mail from the last 7 days, for example replies to emails you sent by hand">{busy === "lookback" ? <Loader2 className="animate-spin"/> : <Mail/>}Import last 7 days</Button>
        <Button size="sm" variant="outline" disabled={busy !== ""} onClick={() => setOpen(true)}>{broken ? "Reconnect" : "Change"}</Button>
        <Button size="sm" variant="ghost" disabled={busy !== ""} onClick={() => void disconnect()}><Unplug/>Disconnect</Button>
      </> : <Button size="sm" onClick={() => setOpen(true)}><Mail/>Connect mailbox</Button>}
    >
      {connected ? <>
        <Row label="Mailbox">{connected.email}</Row>
        <Row label="Sending">After you approve each email, on the lead page or in the Inbox</Row>
        <Row label="Replies">{connected.autoSync ? "Checked automatically about every 2 minutes" : "Automatic checking is off. Use Sync now."}</Row>
        <Row label="Last check">{when(connected.lastSyncedAt)}</Row>
        <Row label="Sent today">{connected.sentToday} of {connected.dailyLimit}</Row>
        {connected.lastError && <Row label="Problem"><span className="text-destructive">{connected.lastError}</span></Row>}
        {connected.testRedirectTo && <Row label="Test mode"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-warning"/>All emails go to {connected.testRedirectTo}</span></Row>}
        <div className="mt-1 grid gap-2 border-t border-border pt-3">
          <Check checked={connected.autoSync} disabled={busy !== ""} onChange={(next) => void save({ autoSync: next })}>Check for replies automatically</Check>
          <Check checked={connected.autoDraft} disabled={busy !== ""} onChange={(next) => void save({ autoDraft: next })}>Write a reply draft with AI for each new reply (never sent without your approval)</Check>
          <div className="flex items-center gap-2 text-sm">
            <span>Daily sending limit</span>
            <Input className="h-8 w-20" inputMode="numeric" value={limit || String(connected.dailyLimit)} onChange={(e) => setLimit(e.target.value.replace(/\D/g, "").slice(0, 3))} onBlur={() => { const n = Number(limit); if (limit && n >= 1 && n <= 150 && n !== connected.dailyLimit) void save({ dailyLimit: n }); setLimit(""); }} aria-label="Daily sending limit"/>
          </div>
        </div>
      </> : <>
        <Row label="Sending">Approved emails go out from your own Gmail address</Row>
        <Row label="Replies">Read from your inbox and added to the conversation</Row>
        <Row label="Safety">Nothing is sent without your approval. Only replies from your leads are imported.</Row>
        <Row label="Access">Uses a Gmail App Password. Stored encrypted. Revoke it any time in your Google account.</Row>
        {mailbox?.testRedirectTo && <Row label="Test mode"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-warning"/>All emails will go to {mailbox.testRedirectTo}</span></Row>}
      </>}
    </IntegrationCard>

    <Dialog open={open} onOpenChange={(value) => { if (busy !== "connect") setOpen(value); }}>
      <DialogContent className="sm:max-w-lg">
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void connect(); }}>
          <DialogHeader>
            <DialogTitle>{connected ? "Change mailbox" : "Connect your mailbox"}</DialogTitle>
            <DialogDescription>Works with Gmail (free accounts too) and any provider that offers IMAP and SMTP. The login is tested before anything is saved.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5"><Label htmlFor="mb-email">Email address</Label><Input id="mb-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" required/></div>
          <div className="grid gap-1.5">
            <Label htmlFor="mb-pass">App password</Label>
            <Input id="mb-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="16-character app password" required/>
            <p className="text-xs text-muted-foreground">Gmail needs 2-Step Verification turned on, then create an app password at <a className="inline-flex items-center gap-0.5 text-primary hover:underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">myaccount.google.com/apppasswords<ExternalLink className="size-3"/></a>. Your normal password will not work.</p>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="mb-name">Sender name (optional)</Label><Input id="mb-name" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Shown as the sender, for example Sara from Acme"/></div>
          <button type="button" className="w-fit text-xs font-medium text-primary hover:underline" onClick={() => setAdvanced((v) => !v)}>{advanced ? "Hide" : "Not Gmail?"} server settings</button>
          {advanced && <div className="grid grid-cols-[1fr_90px] gap-2">
            <div className="grid gap-1.5"><Label htmlFor="mb-imap">IMAP server</Label><Input id="mb-imap" value={imapHost} onChange={(e) => setImapHost(e.target.value)}/></div>
            <div className="grid gap-1.5"><Label htmlFor="mb-imap-port">Port</Label><Input id="mb-imap-port" inputMode="numeric" value={imapPort} onChange={(e) => setImapPort(e.target.value.replace(/\D/g, ""))}/></div>
            <div className="grid gap-1.5"><Label htmlFor="mb-smtp">SMTP server</Label><Input id="mb-smtp" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)}/></div>
            <div className="grid gap-1.5"><Label htmlFor="mb-smtp-port">Port</Label><Input id="mb-smtp-port" inputMode="numeric" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value.replace(/\D/g, ""))}/></div>
          </div>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy === "connect"} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy === "connect" || !email.trim() || !password.trim()}>{busy === "connect" && <Loader2 className="animate-spin"/>}Test and connect</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
