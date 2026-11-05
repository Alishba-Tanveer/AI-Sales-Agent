"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Mail, MessageSquare, Plus, RefreshCw, Search, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/ui/option-select";
import { TONES } from "@/features/settings/components/settings-ui";
import { LeadAvatar } from "@/features/leads/components/lead-avatar";
import { Textarea } from "@/components/ui/textarea";
import { fetchLeads } from "@/features/leads/api";
import type { Lead, LeadCommunication } from "@/features/leads/types";
import { canLogReplyOn, notContactedMessage, sentChannelsOf } from "@/features/leads/stages";
import { deleteThread, draftReply, fetchInbox, fetchThread, markReplySent, recordInbound } from "../api";
import { useRole } from "@/lib/use-role";
import type { InboxItem } from "../types";
import { linkedinChatUrl } from "@/features/linkedin/links";
import { gmailComposeUrl, gmailInboxUrl, gmailSearchUrl } from "../gmail";
import { syncMailboxNow } from "@/features/mailbox/api";
import { useMailbox } from "@/features/mailbox/use-mailbox";
import { SendEmailDialog } from "@/features/mailbox/components/send-email-dialog";
import { IntentBadge } from "@/features/mailbox/components/intent-badge";

const errorText = (e: unknown) => e instanceof Error ? e.message : "Something went wrong.";
const channelBadge = (channel: "EMAIL" | "LINKEDIN") => TONES[channel === "EMAIL" ? "success" : "info"].tile;
const channelText = (channel: "EMAIL" | "LINKEDIN") => channel === "EMAIL" ? "Email" : "LinkedIn";

export function InboxPage() {
  const isOwner = useRole() === "OWNER";
  const [items, setItems] = useState<InboxItem[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [deleteThreadOpen, setDeleteThreadOpen] = useState(false);
  const [thread, setThread] = useState<LeadCommunication[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [saving, setSaving] = useState(false);
  const [newReply, setNewReply] = useState("");
  const [newChannel, setNewChannel] = useState<"EMAIL" | "LINKEDIN">("EMAIL");
  const [newSubject, setNewSubject] = useState("");
  const [loggingInline, setLoggingInline] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  // Mailbox automation (optional). When it is not connected the page works exactly as before: copy, paste and log by hand.
  const { mailbox, ready: mailboxReady, reload: reloadMailbox, setMailbox } = useMailbox();
  const [sendTarget, setSendTarget] = useState<LeadCommunication | null>(null);
  const [syncing, setSyncing] = useState(false);
  const selectedId = selected?.id;
  // New replies arrive in the background; refresh the list (and the open conversation) every minute while connected.
  useEffect(() => {
    if (!mailboxReady) return;
    const timer = setInterval(() => {
      void fetchInbox(query).then(setItems).catch(() => {});
      if (selectedId) void fetchThread(selectedId).then((result) => setThread(result.thread)).catch(() => {});
    }, 60_000);
    return () => clearInterval(timer);
  }, [mailboxReady, query, selectedId]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems(await fetchInbox(query)); }
    catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  }, [query]);
  // Show the spinner as soon as the search changes (adjusting state while rendering, not inside an effect).
  const [loadedQuery, setLoadedQuery] = useState(query);
  if (loadedQuery !== query) { setLoadedQuery(query); setLoading(true); setError(""); }
  useEffect(() => {
    let current = true;
    (async () => {
      try { const next = await fetchInbox(query); if (current) setItems(next); }
      catch (e) { if (current) setError(errorText(e)); }
      finally { if (current) setLoading(false); }
    })();
    return () => { current = false; };
  }, [query]);
  useEffect(() => { void fetchLeads().then((result) => setLeads(result.leads)).catch(() => {}); }, []);

  /** Opens the one conversation for this person. The thread holds their replies, your drafts and what you sent. */
  const selectMessage = async (item: InboxItem, keepInputs = false) => {
    setSelected(item); setLoadingThread(true);
    if (!keepInputs) { setInstruction(""); setNewReply(""); setNewSubject(""); }
    setNewChannel(item.channel);
    try { const result = await fetchThread(item.id); setThread(result.thread); }
    catch (e) { toast.error(errorText(e)); setThread([item]); }
    finally { setLoadingThread(false); }
  };
  useEffect(() => { if (!loadingThread) endRef.current?.scrollIntoView({ block: "end" }); }, [thread, loadingThread, selected?.lead.id]);
  const generateReply = async () => {
    if (!selected) return;
    setDrafting(true);
    try { const draft = await draftReply(lastInbound?.id ?? selected.id, instruction); setThread((current) => [...current, draft]); setInstruction(""); toast.success("Reply draft ready for your review."); }
    catch (e) { toast.error(errorText(e)); }
    finally { setDrafting(false); }
  };
  const copy = async (body: string, channel?: "EMAIL" | "LINKEDIN") => {
    try { await navigator.clipboard.writeText(body); toast.success(channel === "LINKEDIN" ? "Reply copied. Paste it into the LinkedIn message box." : "Reply copied. Paste it into your email."); }
    catch { toast.error("Could not copy the reply. Select the text and copy it manually."); }
  };
  const markSent = async (message: LeadCommunication) => {
    try { const next = await markReplySent(message.id); setThread((current) => current.map((item) => item.id === next.id ? next : item)); toast.success("Marked sent. The lead stage and timeline are updated."); }
    catch (e) { toast.error(errorText(e)); }
  };
  const removeThread = async () => {
    if (!selected) return;
    try { await deleteThread(selected.id); setItems((current) => current.filter((item) => item.lead.id !== selected.lead.id)); setSelected(null); setThread([]); toast.success("Conversation deleted"); }
    catch (e) { toast.error(errorText(e)); }
  };
  const logReply = async (input: { leadId: string; channel: "EMAIL" | "LINKEDIN"; subject?: string; body: string }) => {
    setSaving(true);
    try { const message = await recordInbound(input); setLogOpen(false); const refreshed = await fetchInbox(query); setItems(refreshed); const item = refreshed.find((candidate) => candidate.lead.id === message.leadId); if (item) await selectMessage(item); toast.success("Reply added to the conversation."); }
    catch (e) { toast.error(errorText(e)); }
    finally { setSaving(false); }
  };

  /** Adds the person's newest reply to the conversation that is already open (no new entry in the list). */
  const logInline = async () => {
    if (!selected || !newReply.trim()) return;
    setLoggingInline(true);
    try {
      const message = await recordInbound({ leadId: selected.lead.id, channel: newChannel, subject: newChannel === "EMAIL" ? newSubject : undefined, body: newReply });
      setNewReply(""); setNewSubject("");
      const refreshed = await fetchInbox(query); setItems(refreshed);
      const item = refreshed.find((candidate) => candidate.lead.id === message.leadId);
      if (item) await selectMessage(item, true);
      toast.success(`${selected.lead.name}’s reply added to the conversation.`);
    } catch (e) { toast.error(errorText(e)); }
    finally { setLoggingInline(false); }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const { result, mailbox: next } = await syncMailboxNow();
      setMailbox(next);
      setItems(await fetchInbox(query));
      if (selected) { try { setThread((await fetchThread(selected.id)).thread); } catch { /* keep what is shown */ } }
      toast.success(result.baseline ? "Mailbox linked. Replies that arrive from now on will appear here." : result.imported ? `${result.imported} new ${result.imported === 1 ? "reply" : "replies"} added${result.drafted ? `, ${result.drafted} ${result.drafted === 1 ? "draft" : "drafts"} ready for your approval` : ""}.` : "No new replies.");
    } catch (e) { toast.error(errorText(e)); void reloadMailbox(); }
    finally { setSyncing(false); }
  };

  const inlineAllowed = !selected || canLogReplyOn(selected.lead.stage, sentChannelsOf(thread), newChannel);
  const lastInbound = [...thread].reverse().find((message) => message.direction === "INBOUND");
  const composerUrlFor = (message: LeadCommunication) => {
    if (!selected) return null;
    // with an address: Gmail's inbox with a New Message window addressed to the lead; without one: the plain Gmail inbox
    if (message.channel === "EMAIL") return selected.lead.email ? gmailComposeUrl : gmailInboxUrl;
    if (message.channel === "LINKEDIN") return linkedinChatUrl(selected.lead.linkedinUrl);
    return null;
  };

  return <main className="mx-auto flex h-[calc(100vh-5rem)] min-h-[650px] max-w-[1600px] flex-col gap-5 p-5 md:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight">Inbox</h1><p className="mt-1 text-muted-foreground">Log replies you receive, draft a response, then copy it back to your email or LinkedIn.</p></div><div className="flex flex-wrap gap-2">{mailboxReady && <Button variant="outline" disabled={syncing} onClick={() => void syncNow()}>{syncing ? <Loader2 className="animate-spin"/> : <RefreshCw/>}Sync now</Button>}<Button onClick={() => setLogOpen(true)}><Plus/> Log a reply</Button></div></div>
    {mailboxReady ? <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success-soft p-3.5 text-sm text-muted-foreground"><RefreshCw className="mt-0.5 size-4 shrink-0 text-success"/><p><span className="font-medium text-foreground">Email replies sync automatically from {mailbox?.connected ? mailbox.email : "your mailbox"}.</span> Review the AI draft and press “Approve &amp; send”. Nothing is sent without your approval. LinkedIn replies are still logged by hand.</p></div> : <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft p-3.5 text-sm text-muted-foreground"><MessageSquare className="mt-0.5 size-4 shrink-0 text-warning"/><p><span className="font-medium text-foreground">Messages are not synced automatically.</span> Copy the reply from Gmail or LinkedIn and log it here. Sending also stays manual.</p></div>}

    <section className="grid min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card transition-colors duration-200 hover:border-primary/25 lg:grid-cols-[350px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-b border-border lg:border-r lg:border-b-0"><div className="border-b border-border p-3"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search replies or people" className="h-9 pl-9"/></div><p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><span className="rounded-md border border-primary/30 bg-primary-soft px-1.5 py-0.5 font-semibold text-primary">{items.length}</span>{items.length === 1 ? "conversation" : "conversations"}</p></div>
        <div className="min-h-0 flex-1 overflow-y-auto">{loading ? <div className="flex justify-center p-10"><Loader2 className="size-5 animate-spin text-primary"/></div> : error ? <div className="p-5 text-sm"><p>{error}</p><Button className="mt-3" variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div> : items.length === 0 ? <div className="p-6 text-center"><p className="font-medium">No conversations yet</p><p className="mt-1 text-sm text-muted-foreground">Log the first reply you receive. Every later message from that person stays in the same conversation.</p><Button className="mt-4" size="sm" variant="outline" onClick={() => setLogOpen(true)}><Plus/> Log reply</Button></div> : items.map((item, index) => <button key={item.lead.id} onClick={() => void selectMessage(item)} className={`group flex w-full items-start gap-3 border-b border-l-2 border-b-border p-4 text-left transition-colors hover:bg-muted/50 ${selected?.lead.id === item.lead.id ? "border-l-primary bg-primary-soft/60" : "border-l-transparent"}`}><LeadAvatar name={item.lead.name} id={item.lead.id} prevId={items[index - 1]?.lead.id}/><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className="truncate font-medium transition-colors group-hover:text-primary">{item.lead.name}</span><time className="shrink-0 text-[11px] text-muted-foreground">{new Date(item.occurredAt).toLocaleDateString()}</time></span><span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`rounded-md border px-1.5 py-px text-[10px] font-semibold ${channelBadge(item.channel)}`}>{channelText(item.channel)}</span><IntentBadge intent={item.intent}/><span className="truncate">{item.lead.company && item.lead.company !== "—" ? item.lead.company : ""}</span>{(item.threadReplyCount ?? 1) > 1 && <span className="shrink-0 rounded-full bg-secondary px-1.5 text-[10px] font-semibold text-muted-foreground">{item.threadReplyCount} replies</span>}</span><span className="mt-2 line-clamp-2 break-words text-sm text-muted-foreground">{item.subject || item.body}</span></span></button>)}</div>
      </aside>

      <div className="flex min-h-0 flex-col">{!selected ? <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><div className="flex size-12 items-center justify-center rounded-xl border border-primary/30 bg-primary-soft text-primary"><Mail/></div><h2 className="mt-3 font-semibold">Select a conversation</h2><p className="mt-1 max-w-sm text-sm text-muted-foreground">Choose a person on the left or log a message you received.</p></div> : <>
        <div className="flex items-center justify-between gap-3 border-b border-border p-4"><div className="flex min-w-0 items-center gap-3"><LeadAvatar name={selected.lead.name} id={selected.lead.id} size="md"/><div className="min-w-0"><h2 className="truncate font-semibold">{selected.lead.name}</h2><p className="truncate text-sm text-muted-foreground">{[selected.lead.company && selected.lead.company !== "—" ? selected.lead.company : "", channelText(selected.channel)].filter(Boolean).join(" · ")}{selected.lead.email ? ` · ${selected.lead.email}` : ""}</p></div></div><div className="flex shrink-0 items-center gap-2"><a href={`/leads/${selected.lead.id}`} className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${TONES.info.btn}`}>Open lead</a>{isOwner && <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive-soft" onClick={() => setDeleteThreadOpen(true)} aria-label="Delete conversation" title="Delete conversation"><Trash2/></Button>}</div></div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-6">{loadingThread ? <div className="flex justify-center p-8"><Loader2 className="size-5 animate-spin"/></div> : thread.map((message) => { const target = composerUrlFor(message); const stale = message.direction === "OUTBOUND" && message.status === "DRAFT" && !!lastInbound && new Date(message.occurredAt) < new Date(lastInbound.occurredAt); return <article key={message.id} className={`max-w-[850px] rounded-xl border p-4 ${stale ? "opacity-60 " : ""}${message.direction === "INBOUND" ? "border-border bg-background" : message.status === "DRAFT" ? "border-primary/30 bg-primary-soft/50" : "ml-auto border-success/30 bg-success-soft"}`}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{message.direction === "INBOUND" ? selected.lead.name : "Your reply"} · {messageLabel(message)}</p>{message.direction === "INBOUND" && <IntentBadge intent={message.intent}/>}<time className="text-[11px] text-muted-foreground">{new Date(message.occurredAt).toLocaleString()}</time></div>{message.subject && <h3 className="mt-2 font-medium">{message.subject}</h3>}<p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p>{message.direction === "OUTBOUND" && message.status === "DRAFT" && !stale && <div className="mt-3 flex flex-wrap gap-2">{(message.channel === "EMAIL" || !target) && <Button size="sm" variant="outline" onClick={() => void copy(message.body, message.channel)}>Copy reply</Button>}{target && <a href={target} target="_blank" rel="noreferrer" onClick={() => void copy(message.body, message.channel)} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs transition-colors hover:border-primary/40 hover:bg-muted">{message.channel === "EMAIL" ? <Mail className="size-3.5"/> : <ExternalLink className="size-3.5"/>}{message.channel === "EMAIL" ? (selected.lead.email ? "Copy reply & open Gmail" : "Copy & open Gmail inbox") : "Copy & open LinkedIn chat"}</a>}{message.channel === "EMAIL" && mailboxReady && !!selected.lead.email && selected.lead.stage !== "DO_NOT_CONTACT" && <Button size="sm" onClick={() => setSendTarget(message)}><Send/>Approve &amp; send</Button>}<Button size="sm" variant={mailboxReady && message.channel === "EMAIL" ? "outline" : "default"} onClick={() => void markSent(message)}><Send/>I sent this</Button></div>}</article>; })}
          {lastInbound && <div className="max-w-[850px] rounded-xl border border-dashed border-primary/30 bg-primary-soft/30 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Draft a reply</p><p className="mt-1 text-sm text-muted-foreground">AI drafts are suggestions. Review, copy, and send them yourself.</p>{selected.lead.email && <a href={gmailComposeUrl} target="_blank" rel="noreferrer" onClick={() => { void navigator.clipboard?.writeText(selected.lead.email ?? "").then(() => toast.success(`${selected.lead.email} copied. Paste it in the To box.`)).catch(() => {}); }} className={`mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-muted ${TONES.success.btn}`}><ExternalLink className="size-3.5"/>Open Gmail and write to {selected.lead.name}</a>}<Textarea className="mt-3" rows={2} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Optional: mention a specific next step or tone"/><Button className="mt-3" disabled={drafting || selected.lead.stage === "DO_NOT_CONTACT"} onClick={() => void generateReply()}>{drafting ? <Loader2 className="animate-spin"/> : <Sparkles/>}Draft reply with AI</Button></div>}
          {!loadingThread && <div className="max-w-[850px] rounded-xl border border-dashed border-border p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{selected.lead.name} replied again?</p><p className="mt-1 text-sm text-muted-foreground">Open their emails in Gmail in a new tab, copy their latest message, then return here and paste it. It will be added to this same conversation.</p><div className="mt-3 grid gap-3"><div className="flex flex-wrap items-center gap-2"><div className="w-40"><OptionSelect value={newChannel} onValueChange={(next) => setNewChannel(next as "EMAIL" | "LINKEDIN")} aria-label="Channel" options={[{ value: "EMAIL", label: "Email" }, { value: "LINKEDIN", label: "LinkedIn" }]}/></div>{newChannel === "EMAIL" ? (selected.lead.email ? <a href={gmailSearchUrl(selected.lead.email)} target="_blank" rel="noreferrer" className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${TONES.success.btn}`}><Mail className="size-3.5"/>Open {selected.lead.name}’s emails in Gmail</a> : <p className="text-xs text-warning">{selected.lead.name} has no email address. Select a lead with an email to open their emails.</p>) : <a href={linkedinChatUrl(selected.lead.linkedinUrl)} target="_blank" rel="noreferrer" className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${TONES.info.btn}`}><ExternalLink className="size-3.5"/>Open {selected.lead.name}’s LinkedIn chat</a>}</div>{!inlineAllowed && <div className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm"><p className="font-medium text-foreground">{notContactedMessage(selected.lead.name, newChannel).title}</p><p className="mt-1 text-muted-foreground">{notContactedMessage(selected.lead.name, newChannel).text}</p><a href={`/leads/${selected.lead.id}`} className="mt-2 inline-flex h-8 items-center rounded-lg border border-primary/30 bg-primary-soft px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20">Open {selected.lead.name}’s lead page</a></div>}{newChannel === "EMAIL" && <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Subject (optional)"/>}<Textarea rows={3} value={newReply} onChange={(e) => setNewReply(e.target.value)} placeholder={`Paste ${selected.lead.name}’s new message here`}/><div className="flex justify-end"><Button disabled={loggingInline || !newReply.trim() || !inlineAllowed} onClick={() => void logInline()}>{loggingInline ? <Loader2 className="animate-spin"/> : <Plus/>}Add to conversation</Button></div></div></div>}
          <div ref={endRef}/>
        </div>
      </>}</div>
    </section>
    <SendEmailDialog draft={sendTarget} leadName={selected?.lead.name ?? ""} leadEmail={selected?.lead.email ?? null} testRedirectTo={mailbox?.testRedirectTo} onClose={() => setSendTarget(null)} onSent={(next) => setThread((current) => current.map((item) => item.id === next.id ? next : item))}/>
    <LogReplyDialog open={logOpen} busy={saving} leads={leads} onClose={() => setLogOpen(false)} onSave={logReply}/>
    <ConfirmActionDialog open={deleteThreadOpen} onOpenChange={setDeleteThreadOpen} title={`Delete conversation with ${selected?.lead.name ?? "this lead"}?`} description="This permanently removes the messages in this conversation." onConfirm={removeThread} />
  </main>;
}

function messageLabel(message: LeadCommunication) { return `${channelText(message.channel)} · ${message.direction === "INBOUND" ? "Received" : message.status === "DRAFT" ? "Draft" : "Sent"}`; }

function LogReplyDialog({ open, busy, leads, onClose, onSave }: { open: boolean; busy: boolean; leads: Lead[]; onClose: () => void; onSave: (input: { leadId: string; channel: "EMAIL" | "LINKEDIN"; subject?: string; body: string }) => Promise<void> }) {
  const [leadId, setLeadId] = useState(""); const [channel, setChannel] = useState<"EMAIL" | "LINKEDIN">("EMAIL"); const [subject, setSubject] = useState(""); const [body, setBody] = useState("");
  // Clear the form whenever the dialog closes (adjusting state while rendering, not inside an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) { setWasOpen(open); if (!open) { setLeadId(""); setChannel("EMAIL"); setSubject(""); setBody(""); } }
  const reset = () => { setLeadId(""); setChannel("EMAIL"); setSubject(""); setBody(""); onClose(); };
  const selectedLead = leads.find((lead) => lead.id === leadId);
  const linkedinAvailable = !!selectedLead?.linkedinUrl && !selectedLead.linkedinUrl.includes("/search/");
  const notContacted = !!selectedLead && !canLogReplyOn(selectedLead.stage, selectedLead.sentChannels ?? [], channel);
  const linkedinInboxUrl = channel === "LINKEDIN" && linkedinAvailable ? linkedinChatUrl(selectedLead?.linkedinUrl) : null;
  const showNotContacted = notContacted && !(channel === "LINKEDIN" && !linkedinAvailable);
  return <Dialog open={open} onOpenChange={(value) => !value && reset()}><DialogContent className="sm:max-w-lg"><form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void onSave({ leadId, channel, subject: channel === "EMAIL" ? subject : undefined, body }); }}><DialogHeader><DialogTitle>Log a reply</DialogTitle><DialogDescription>Paste the message you received. You can only log a reply on a channel you have messaged them on. If you already have a conversation with this person, it is added to it.</DialogDescription></DialogHeader><label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">Lead</span><OptionSelect required value={leadId} onValueChange={setLeadId} placeholder="Choose a lead" aria-label="Lead" menuClassName="max-h-72" options={leads.map((lead) => ({ value: lead.id, label: lead.name, description: channel === "LINKEDIN" && (!lead.linkedinUrl || lead.linkedinUrl.includes("/search/")) ? "No LinkedIn profile" : canLogReplyOn(lead.stage, lead.sentChannels ?? [], channel) ? (lead.company ?? undefined) : `Not contacted on ${channel === "LINKEDIN" ? "LinkedIn" : "email"}` }))}/></label>{showNotContacted && selectedLead && <div className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm"><p className="font-medium text-foreground">{notContactedMessage(selectedLead.name, channel).title}</p><p className="mt-1 text-muted-foreground">{notContactedMessage(selectedLead.name, channel).text}</p><a href={`/leads/${selectedLead.id}`} className="mt-2 inline-flex h-8 items-center rounded-lg border border-primary/30 bg-primary-soft px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20">Open {selectedLead.name}’s lead page</a></div>}<label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">Channel</span><OptionSelect value={channel} onValueChange={(next) => setChannel(next as "EMAIL" | "LINKEDIN")} aria-label="Channel" options={[{ value: "EMAIL", label: "Email" }, { value: "LINKEDIN", label: "LinkedIn" }]}/></label>{channel === "LINKEDIN" && <div className="rounded-lg border border-border bg-background p-3"><p className="text-sm text-muted-foreground">Open their LinkedIn chat in a new tab, copy their reply, then return here and paste it below.</p>{linkedinInboxUrl ? <a href={linkedinInboxUrl} target="_blank" rel="noreferrer" className={`mt-2 inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${TONES.info.btn}`}><ExternalLink className="size-4"/>Open {selectedLead?.name}’s LinkedIn chat</a> : <p className="mt-2 text-xs text-warning">Select a lead with a LinkedIn profile to open their chat.</p>}</div>}{channel === "EMAIL" && <div className="rounded-lg border border-border bg-background p-3"><p className="text-sm text-muted-foreground">Open their emails in Gmail in a new tab, copy their reply, then return here and paste it below.</p>{selectedLead?.email ? <a href={gmailSearchUrl(selectedLead.email)} target="_blank" rel="noreferrer" className={`mt-2 inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${TONES.success.btn}`}><Mail className="size-4"/>Open {selectedLead.name}\u2019s emails in Gmail</a> : <p className="mt-2 text-xs text-warning">Select a lead with an email address to open their emails.</p>}</div>}{channel === "EMAIL" && <label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">Subject</span><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>}<label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">Reply text</span><Textarea required rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Paste the message here" /></label><DialogFooter><Button type="button" variant="ghost" disabled={busy} onClick={reset}>Cancel</Button><Button type="submit" disabled={busy || !leadId || !body.trim() || notContacted || (channel === "LINKEDIN" && !linkedinAvailable)}>{busy && <Loader2 className="animate-spin"/>}Save reply</Button></DialogFooter></form></DialogContent></Dialog>;
}
