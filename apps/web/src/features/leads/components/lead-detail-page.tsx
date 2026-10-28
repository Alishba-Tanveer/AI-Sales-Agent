"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Ban, Edit2, ExternalLink, Loader2, Mail, MessageSquareText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/ui/option-select";
import { Textarea } from "@/components/ui/textarea";
import { draftEmail, fetchLead, updateLead, type LeadInput } from "../api";
import type { Lead, LeadCommunication, LeadStage } from "../types";
import { STAGE_META, STAGE_ORDER } from "../stages";
import { LeadAvatar } from "./lead-avatar";
import { TONES } from "@/features/settings/components/settings-ui";
import { markReplySent } from "@/features/inbox/api";

const STAGE_OPTIONS = STAGE_ORDER.map((value) => ({ value, ...STAGE_META[value] }));
// "Do not contact" has its own button, so it is only listed when the lead is already in that stage.
const optionsFor = (stage: LeadStage) => STAGE_OPTIONS.filter((option) => option.value !== "DO_NOT_CONTACT" || stage === "DO_NOT_CONTACT");
const messageLabel = (m: LeadCommunication) => `${m.channel === "EMAIL" ? "Email" : "LinkedIn"} · ${m.direction === "INBOUND" ? "Received" : m.status === "DRAFT" ? "Draft" : "Sent"}`;
const errorText = (e: unknown) => e instanceof Error ? e.message : "Something went wrong.";

export function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [dncOpen, setDncOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const next = await fetchLead(id); setLead(next); setNotes(next.notes ?? ""); setFollowUp(next.nextFollowUpAt?.slice(0, 10) ?? ""); }
    catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const update = async (patch: Parameters<typeof updateLead>[1]) => {
    if (!lead) return;
    setBusy(true);
    try { setLead(await updateLead(lead.id, patch)); toast.success("Lead updated."); }
    catch (e) { toast.error(errorText(e)); }
    finally { setBusy(false); }
  };
  const selectStage = (nextStage: LeadStage) => {
    if (nextStage === "DO_NOT_CONTACT" && lead?.stage !== "DO_NOT_CONTACT") { setDncOpen(true); return; }
    if (lead) void update({ name: lead.name, stage: nextStage });
  };
  const saveContact = async (input: LeadInput) => {
    if (!lead) return;
    setBusy(true);
    try { setLead(await updateLead(lead.id, input)); setEditOpen(false); toast.success("Contact details updated."); }
    catch (e) { toast.error(errorText(e)); }
    finally { setBusy(false); }
  };
  const makeDraft = async () => {
    if (!lead) return;
    setBusy(true);
    try { const draft = await draftEmail(lead.id); setLead((current) => current ? { ...current, communications: [draft, ...(current.communications ?? [])] } : current); toast.success("Email draft ready for your review."); }
    catch (e) { toast.error(errorText(e)); }
    finally { setBusy(false); }
  };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Copied. Paste the message into your email or LinkedIn."); }
    catch { toast.error("Could not copy. Select the message and copy it manually."); }
  };
  const sent = async (message: LeadCommunication) => {
    try {
      const next = await markReplySent(message.id);
      setLead((current) => current ? { ...current, communications: (current.communications ?? []).map((item) => item.id === next.id ? next : item) } : current);
      toast.success("Marked as sent. The lead timeline is updated.");
    } catch (e) { toast.error(errorText(e)); }
  };
  const moveToDoNotContact = async () => {
    if (!lead) return;
    setBusy(true);
    try {
      setLead(await updateLead(lead.id, { stage: "DO_NOT_CONTACT" }));
      setDncOpen(false);
      toast.success(`${lead.name} moved to Do not contact.`);
    } catch (e) { toast.error(errorText(e)); }
    finally { setBusy(false); }
  };

  if (loading) return <main className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-primary"/></main>;
  if (error || !lead) return <main className="mx-auto max-w-5xl p-6"><Button variant="ghost" onClick={() => router.push("/leads")}><ArrowLeft/> Leads</Button><p className="mt-8 text-center">{error || "Lead not found"}</p><div className="mt-3 text-center"><Button variant="outline" onClick={() => void load()}>Retry</Button></div></main>;

  const messages = lead.communications ?? [];
  const latestDrafts = messages.filter((item) => item.direction === "OUTBOUND" && item.status === "DRAFT");
  return <main className="mx-auto w-full max-w-[1400px] space-y-6 p-5 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" onClick={() => router.push("/leads")}><ArrowLeft/> Leads</Button><div className="flex flex-wrap gap-2"><Button variant="outline" className={TONES.primary.btn} onClick={() => setEditOpen(true)}><Edit2/> Edit</Button>{lead.linkedinUrl && <a className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition-all ${TONES.info.btn}`} href={lead.linkedinUrl} target="_blank" rel="noreferrer"><ExternalLink/> LinkedIn profile</a>}{lead.stage !== "DO_NOT_CONTACT" && <Button variant="outline" className={TONES.destructive.btn} onClick={() => setDncOpen(true)}><Ban/> Do not contact</Button>}</div></div>
    <section className="rounded-xl border border-border bg-card p-5 transition-colors duration-200 hover:border-primary/30 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5"><div className="flex items-start gap-4"><LeadAvatar name={lead.name} id={lead.id} size="lg"/><div><p className="text-sm text-primary">{lead.source || "CRM lead"}</p><h1 className="mt-1 text-3xl font-semibold">{lead.name}</h1><p className="mt-1 text-muted-foreground">{[lead.jobTitle, lead.company].filter(Boolean).join(" · ") || "Role and company not added"}</p></div></div><label className="grid gap-2 text-xs text-muted-foreground">Pipeline stage<OptionSelect variant="pill" className="h-9 min-w-44 text-sm" value={lead.stage} options={optionsFor(lead.stage)} disabled={busy} onValueChange={(next) => selectStage(next as LeadStage)} aria-label="Pipeline stage"/></label></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined}/><Detail label="Company website" value={lead.websiteUrl} href={lead.websiteUrl ?? undefined}/><Detail label="LinkedIn" value={lead.linkedinUrl ? "Open profile" : "Not added"} href={lead.linkedinUrl ?? undefined}/><label className="grid gap-1 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">Next follow-up<div className="flex gap-2"><input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"/><Button size="sm" variant="outline" disabled={busy || followUp === (lead.nextFollowUpAt?.slice(0, 10) ?? "")} onClick={() => void update({ name: lead.name, nextFollowUpAt: followUp ? new Date(`${followUp}T12:00:00.000Z`).toISOString() : "" })}>Save</Button></div></label></div>
    </section>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
      <section className="rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Contact notes</h2><p className="mt-1 text-sm text-muted-foreground">Keep context for whichever channel you use next.</p></div><Button size="sm" variant="outline" disabled={busy || notes === (lead.notes ?? "")} onClick={() => void update({ name: lead.name, notes })}>{busy && <Loader2 className="animate-spin"/>}Save notes</Button></div><Textarea className="mt-4 min-h-32" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What matters to this person? What did they reply?"/></section>
      <section className="rounded-xl border border-primary/30 bg-primary-soft/60 p-5"><div className="flex items-center gap-2"><Sparkles className="size-4 text-primary"/><h2 className="text-lg font-semibold">Email outreach</h2></div><p className="mt-1 text-sm text-muted-foreground">Generate a grounded draft, review it, then open your email app and send it yourself.</p><Button className="mt-4" disabled={busy || lead.stage === "DO_NOT_CONTACT" || !lead.email} onClick={() => void makeDraft()}>{busy ? <Loader2 className="animate-spin"/> : <Mail/>}Draft email</Button>{!lead.email && <p className="mt-2 text-xs text-muted-foreground">Add a work email to draft an email.</p>}</section>
    </div>

    {latestDrafts.length > 0 && <section className="space-y-3"><h2 className="text-lg font-semibold">Drafts to review</h2>{latestDrafts.map((draft) => <article key={draft.id} className="rounded-xl border border-border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="inline-flex rounded-md border border-primary/30 bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">EMAIL DRAFT</p><h3 className="mt-1 font-semibold">{draft.subject || "No subject"}</h3></div><Button size="sm" variant="outline" onClick={() => void copy(`${draft.subject ? `${draft.subject}\n\n` : ""}${draft.body}`)}>Copy draft</Button></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{draft.body}</p><div className="mt-4 flex flex-wrap gap-2">{lead.email && <a className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-sm text-primary-foreground" href={`mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(draft.subject ?? "")}&body=${encodeURIComponent(draft.body)}`}><Mail className="size-4"/>Open email draft</a>}<Button size="sm" variant="outline" onClick={() => void sent(draft)}>I sent this</Button></div></article>)}</section>}

    <section className="rounded-xl border border-border bg-card"><div className="border-b border-border p-5"><h2 className="text-lg font-semibold">Activity and conversation</h2><p className="mt-1 text-sm text-muted-foreground">Email and LinkedIn messages you log in the app appear here. External accounts are not synced.</p></div>{messages.length ? <div className="divide-y divide-border">{messages.map((message) => <article key={message.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-medium"><MessageSquareText className="size-4 text-primary"/>{messageLabel(message)}</div><time className="text-xs text-muted-foreground">{new Date(message.occurredAt).toLocaleString()}</time></div>{message.subject && <h3 className="mt-2 font-medium">{message.subject}</h3>}<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{message.body}</p></article>)}</div> : <p className="p-8 text-center text-sm text-muted-foreground">No messages recorded yet. Log a reply from the Inbox page to keep the conversation here.</p>}</section>
    <EditLeadDialog key={`${lead.id}-${lead.updatedAt}`} open={editOpen} lead={lead} busy={busy} onClose={() => setEditOpen(false)} onSave={saveContact}/>
    <Dialog open={dncOpen} onOpenChange={setDncOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Move {lead.name} to Do not contact?</DialogTitle><DialogDescription>This keeps the lead in your pipeline, clears their follow-up date, and prevents AI email drafts.</DialogDescription></DialogHeader><DialogFooter><Button variant="ghost" disabled={busy} onClick={() => setDncOpen(false)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={() => void moveToDoNotContact()}>{busy && <Loader2 className="animate-spin"/>}Move to Do not contact</Button></DialogFooter></DialogContent></Dialog>
  </main>;
}

function Detail({ label, value, href }: { label: string; value: string | null; href?: string }) { return <div className="rounded-lg border border-border bg-background p-3 transition-colors hover:border-primary/40"><p className="text-xs text-muted-foreground">{label}</p>{href ? <a className="mt-1 block truncate text-sm font-medium text-primary hover:underline" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{value}</a> : <p className="mt-1 truncate text-sm font-medium">{value || "Not added"}</p>}</div>; }

function EditLeadDialog({ open, lead, busy, onClose, onSave }: { open: boolean; lead: Lead; busy: boolean; onClose: () => void; onSave: (input: LeadInput) => Promise<void> }) {
  const [name, setName] = useState(lead.name); const [email, setEmail] = useState(lead.email ?? ""); const [jobTitle, setJobTitle] = useState(lead.jobTitle ?? ""); const [company, setCompany] = useState(lead.company ?? ""); const [linkedinUrl, setLinkedinUrl] = useState(lead.linkedinUrl ?? ""); const [websiteUrl, setWebsiteUrl] = useState(lead.websiteUrl ?? "");
  useEffect(() => { if (open) { setName(lead.name); setEmail(lead.email ?? ""); setJobTitle(lead.jobTitle ?? ""); setCompany(lead.company ?? ""); setLinkedinUrl(lead.linkedinUrl ?? ""); setWebsiteUrl(lead.websiteUrl ?? ""); } }, [open, lead]);
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="sm:max-w-xl"><form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void onSave({ name, email, jobTitle, company, linkedinUrl, websiteUrl }); }}><DialogHeader><DialogTitle>Edit contact</DialogTitle><DialogDescription>Update the shared CRM contact used for email and LinkedIn outreach.</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">Name *</span><Input required value={name} onChange={(e) => setName(e.target.value)}/></label><label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">Work email</span><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}/></label><label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">Job title</span><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}/></label><label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">Company</span><Input value={company} onChange={(e) => setCompany(e.target.value)}/></label><label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">LinkedIn URL</span><Input type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)}/></label><label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">Company website</span><Input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}/></label></div><DialogFooter><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !name.trim()}>{busy && <Loader2 className="animate-spin"/>}Save contact</Button></DialogFooter></form></DialogContent></Dialog>;
}
