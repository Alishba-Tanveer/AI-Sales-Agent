"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock, ClipboardCopy, ExternalLink, Eye, Heart, Lightbulb, Loader2, MessageSquare, Pencil, Plus, Send, Target, UserPlus, Users, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Pill, SectionCard, TONES, initials, inputCls, type Tone } from "@/features/settings/components/settings-ui";
import { fetchLeads, fetchStrategy } from "../api";
import { copyText, normalizeLinkedInProfileUrl, personSearchUrl } from "../links";
import type { Lead, OutreachStrategy } from "../types";
import { ConfirmDialog, HowItWorksDialog, IconTile, LinkButton, PageHeader, TabBar, fmtDate } from "./linkedin-ui";

type TabId = "engaged" | "buyers" | "pending" | "connected";
const PAGE_SIZE = 8;

const REASON_ICON = { like: Heart, comment: MessageSquare, view: Eye, fit: Target } as const;
/** Avatar colors: five of the app's accent colors (red is kept for warnings). */
const AVATAR_TONES: Tone[] = ["primary", "info", "violet", "warning", "success"];
// ids like "l7" use their number, so people added one after another cycle through the colors in order
const hashId = (id: string) => {
  const n = id.match(/(\d+)$/);
  return n ? Number(n[1].slice(-9)) : [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
};
/** A person keeps their color; if two neighbours in a list would match, the lower one shifts to the next color. */
const avatarTone = (id: string, prevId?: string): Tone => {
  const t = hashId(id) % AVATAR_TONES.length;
  const p = prevId === undefined ? -1 : hashId(prevId) % AVATAR_TONES.length;
  return AVATAR_TONES[t === p ? (t + 1) % AVATAR_TONES.length : t];
};

const REASON_TONE = { like: "text-destructive", comment: "text-sky-700 dark:text-sky-400", view: "text-violet-700 dark:text-violet-400", fit: "text-success" } as const;

export function Connections() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [strategy, setStrategy] = useState<OutreachStrategy | null>(null);
  const [tab, setTab] = useState<TabId>("engaged");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [noteLead, setNoteLead] = useState<Lead | null>(null);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [detail, setDetail] = useState<Lead | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "skip" | "withdraw" | "bulk"; lead?: Lead } | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([fetchLeads(), fetchStrategy()]).then(([l, s]) => {
      if (!live) return;
      setLeads(l);
      setStrategy(s);
    });
    return () => {
      live = false;
    };
  }, []);

  const all = leads ?? [];
  const open = (l: Lead) => l.status === "suggested" || l.status === "approved";
  const engaged = all.filter((l) => l.source === "engaged" && open(l));
  const buyers = all.filter((l) => l.source === "buyer" && open(l));
  const pending = all.filter((l) => l.status === "pending");
  const connected = all.filter((l) => l.status === "connected");
  const rows = { engaged, buyers, pending, connected }[tab];

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const patch = (ids: string[], p: Partial<Lead>) => setLeads((cur) => (cur ?? []).map((l) => (ids.includes(l.id) ? { ...l, ...p } : l)));
  const changeTab = (t: TabId) => {
    setTab(t);
    setPage(1);
    setSelected(new Set());
  };

  const send = (l: Lead) => {
    patch([l.id], { status: "pending", sentAt: new Date().toISOString().slice(0, 10) });
    setSelected((s) => { const n = new Set(s); n.delete(l.id); return n; });
    toast.success(`Request sent to ${l.name}`);
  };
  const skip = (l: Lead) => {
    patch([l.id], { status: "skipped" });
    setSelected((s) => { const n = new Set(s); n.delete(l.id); return n; });
    toast(`Skipped ${l.name}`);
  };
  const withdraw = (l: Lead) => {
    patch([l.id], { status: "skipped" });
    toast(`Request to ${l.name} withdrawn`);
  };
  const approveSelected = () => {
    const ids = [...selected];
    const limit = strategy?.perDay ?? ids.length;
    const todays = all.filter((l) => l.status === "pending" && l.sentAt === new Date().toISOString().slice(0, 10)).length;
    const room = Math.max(0, limit - todays);
    const go = ids.slice(0, room);
    if (!go.length) return void toast.error(`Daily limit of ${limit} requests reached.`);
    patch(go, { status: "pending", sentAt: new Date().toISOString().slice(0, 10) });
    setSelected(new Set());
    toast.success(`${go.length} request${go.length > 1 ? "s" : ""} sent${go.length < ids.length ? ` (daily limit of ${limit} reached)` : ""}`);
  };

  const selectable = visible.filter(open);
  const allSelected = selectable.length > 0 && selectable.every((l) => selected.has(l.id));
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s);
    if (allSelected) selectable.forEach((l) => n.delete(l.id));
    else selectable.forEach((l) => n.add(l.id));
    return n;
  });
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const addPerson = (l: Lead) => {
    setLeads((cur) => [l, ...(cur ?? [])]);
    changeTab(l.source === "buyer" ? "buyers" : "engaged");
    toast.success(`${l.name} added`);
  };

  const showSelect = tab === "engaged" || tab === "buyers";

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 p-6 lg:p-8">
      <PageHeader
        title="Engagement & Connections"
        description="See who engages with your posts, find buyers in your niche, and approve who gets a connection request."
        actions={
          <>
            <Button variant="outline" onClick={() => setHelpOpen(true)}><Lightbulb /> How it works</Button>
            <Button variant="outline" onClick={() => setAddOpen(true)}><Plus /> Add person</Button>
            <Button onClick={() => setConfirm({ kind: "bulk" })} disabled={selected.size === 0}><Send /> Approve selected ({selected.size})</Button>
          </>
        }
      />

      <SectionCard
        icon={Target}
        title="Outreach strategy"
        description={strategy ? `Agreed on ${fmtDate(strategy.agreedOn)}. The agent follows this exactly.` : "Loading…"}
        tone="success"
        aside={
          <div className="flex items-center gap-2">
            <Pill tone="success">Active</Pill>
            <Button variant="outline" size="sm" onClick={() => setStrategyOpen(true)} disabled={!strategy}><Pencil /> Edit strategy</Button>
          </div>
        }
      >
        {strategy ? (
          /* Equal-height tiles in a 12-column grid: who (4) · message (5) · two small stats (3) */
          <div className="grid items-stretch gap-3 lg:grid-cols-12">
            <FactTile className="lg:col-span-4" icon={Users} tone="info" label="Who to target">
              <p className="text-sm leading-relaxed text-foreground">{strategy.who}</p>
            </FactTile>
            <FactTile className="lg:col-span-5" icon={MessageSquare} tone="success" label="What to say">
              <p className="text-sm leading-relaxed text-foreground">
                {strategy.message.split(/(\{[^}]+\})/g).map((part, i) =>
                  /^\{[^}]+\}$/.test(part) ? <span key={i} className="rounded border border-primary/30 bg-primary-soft px-1 py-0.5 font-mono text-xs text-primary">{part}</span> : part,
                )}
              </p>
            </FactTile>
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-1">
              <StatTile icon={Send} tone="warning" label="How often" value={String(strategy.perDay)} unit="requests / day" />
              <StatTile icon={Clock} tone="violet" label="Follow up after" value={String(strategy.followUpDays)} unit="days" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading strategy…</div>
        )}
      </SectionCard>

      <TabBar
        label="Connection lists"
        value={tab}
        onChange={changeTab}
        tabs={[
          { id: "engaged", label: "People who engaged", count: engaged.length },
          { id: "buyers", label: "Target buyers", count: buyers.length },
          { id: "pending", label: "Pending", count: pending.length },
          { id: "connected", label: "Connected", count: connected.length },
        ]}
      />

      {leads === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading people…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <p className="text-sm font-medium text-foreground">No one here yet</p>
          <p className="mt-1 text-sm text-muted-foreground">New people appear as they engage or match your target.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
                <tr>
                  {showSelect && (
                    <th className="w-10 px-4 py-3">
                      <Check3 checked={allSelected} onChange={toggleAll} label="Select all on this page" />
                    </th>
                  )}
                  <th className="px-4 py-3 font-medium">Person</th>
                  <th className="px-4 py-3 font-medium">{tab === "pending" ? "Date sent" : tab === "connected" ? "Connected on" : "Why they're here"}</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((l, i) => {
                  const Icon = REASON_ICON[l.reasonKind];
                  return (
                    <tr key={l.id} className={cn("align-middle transition-colors hover:bg-muted/40", selected.has(l.id) && "bg-primary-soft/60")}>
                      {showSelect && (
                        <td className="px-4 py-3"><Check3 checked={selected.has(l.id)} onChange={() => toggle(l.id)} label={`Select ${l.name}`} /></td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", TONES[avatarTone(l.id, visible[i - 1]?.id)].tile)}>{initials(l.name)}</span>
                          <button type="button" onClick={() => setDetail(l)} className="min-w-0 cursor-pointer rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <p className="truncate font-medium text-foreground hover:text-primary">{l.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{l.role} · {l.company}</p>
                          </button>
                        </div>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-muted-foreground">
                        {tab === "pending" ? fmtDate(l.sentAt) : tab === "connected" ? fmtDate(l.connectedAt) : (
                          <span className="flex items-start gap-2"><Icon className={cn("mt-0.5 size-3.5 shrink-0", REASON_TONE[l.reasonKind])} /><span>{l.reason}</span></span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {l.status === "suggested" && <Pill tone="warning">Suggested</Pill>}
                        {l.status === "approved" && <Pill tone="success">Approved</Pill>}
                        {l.status === "pending" && <Pill tone="primary"><Clock className="size-3" /> Awaiting acceptance</Pill>}
                        {l.status === "connected" && <Pill tone="success"><Users className="size-3" /> Connected</Pill>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {open(l) && (
                            <>
                              <Button size="sm" onClick={() => send(l)}><UserPlus /> Approve &amp; send</Button>
                              <Button size="sm" variant="outline" onClick={() => setNoteLead(l)}>Edit note</Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: "skip", lead: l })}>Skip</Button>
                            </>
                          )}
                          {l.status === "pending" && <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: "withdraw", lead: l })}>Withdraw</Button>}
                          {l.status === "connected" && <Button size="sm" variant="outline" onClick={() => setNoteLead(l)}>Message</Button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, rows.length)} of {rows.length}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>Next</Button>
            </div>
          </div>
        </div>
      )}

      <NoteDialog lead={noteLead} onClose={() => setNoteLead(null)} onSend={(l, note) => { patch([l.id], { note }); if (open(l)) send({ ...l, note }); else toast.success(`Message saved for ${l.name}`); setNoteLead(null); }} />
      {strategy && <StrategyDialog open={strategyOpen} onOpenChange={setStrategyOpen} value={strategy} onSave={(s) => { setStrategy(s); toast.success("Strategy updated"); }} />}
      <AddPersonDialog open={addOpen} onOpenChange={setAddOpen} onAdd={addPerson} />
      <LeadDialog lead={detail} onClose={() => setDetail(null)} onEditNote={(l) => { setDetail(null); setNoteLead(l); }} />

      <ConfirmDialog
        open={confirm?.kind === "skip"}
        onOpenChange={(o) => !o && setConfirm(null)}
        tone="warning"
        title="Skip this person?"
        description={confirm?.lead ? `${confirm.lead.name} will be removed from your suggestions and the agent won't contact them.` : ""}
        confirmLabel="Skip"
        onConfirm={() => confirm?.lead && skip(confirm.lead)}
      />
      <ConfirmDialog
        open={confirm?.kind === "withdraw"}
        onOpenChange={(o) => !o && setConfirm(null)}
        tone="destructive"
        title="Withdraw this request?"
        description={confirm?.lead ? `Your request to ${confirm.lead.name} is marked as withdrawn here. To cancel it on LinkedIn too, open Manage invitations → Sent.` : ""}
        confirmLabel="Withdraw"
        onConfirm={() => confirm?.lead && withdraw(confirm.lead)}
      >
        <LinkButton href="https://www.linkedin.com/mynetwork/invitation-manager/sent/" variant="outline" size="sm" className="w-fit">
          Open sent invitations <ExternalLink className="size-3" />
        </LinkButton>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm?.kind === "bulk"}
        onOpenChange={(o) => !o && setConfirm(null)}
        tone="success"
        icon={Send}
        title={`Send ${selected.size} connection request${selected.size === 1 ? "" : "s"}?`}
        description={`Each person gets the note saved on their row. Your daily limit is ${strategy?.perDay ?? "—"} requests, and anything over that waits for tomorrow.`}
        confirmLabel="Approve & send"
        onConfirm={approveSelected}
      />

      <HowItWorksDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        tone="info"
        title="How Connections works"
        description="The agent finds people. You decide who gets a request."
        steps={[
          { title: "We find the right people", text: "People who liked, commented or viewed your profile, plus buyers that match your outreach strategy." },
          { title: "You review the list", text: "Click a name to see why they are here. Edit the note, skip them, or approve." },
          { title: "Approved requests go out", text: "We keep to your daily limit and follow up after the number of days in your strategy." },
          { title: "Pending turns into Connected", text: "Once someone accepts, they move to the Connected tab, ready for a message." },
        ]}
        note="LinkedIn does not let apps send messages for you. Use Copy note on a person's popup and paste it into LinkedIn."
      />
    </main>
  );
}

function FactTile({ icon, tone, label, className, children }: { icon: LucideIcon; tone: Tone; label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-background p-4", className)}>
      <div className="flex items-center gap-2.5">
        <IconTile icon={icon} tone={tone} className="size-8" />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      {children}
    </div>
  );
}

function StatTile({ icon, tone, label, value, unit }: { icon: LucideIcon; tone: Tone; label: string; value: string; unit: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background p-4">
      <IconTile icon={icon} tone={tone} className="size-8" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
          <span className="truncate text-xs text-muted-foreground">{unit}</span>
        </p>
      </div>
    </div>
  );
}

function Check3({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange}
      className={cn("flex size-4.5 cursor-pointer items-center justify-center rounded border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring", checked ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
      {checked && <Check className="size-3" />}
    </button>
  );
}

function NoteDialog({ lead, onClose, onSend }: { lead: Lead | null; onClose: () => void; onSend: (l: Lead, note: string) => void }) {
  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{lead && <NoteForm key={lead.id} lead={lead} onClose={onClose} onSend={onSend} />}</DialogContent>
    </Dialog>
  );
}

function NoteForm({ lead, onClose, onSend }: { lead: Lead; onClose: () => void; onSend: (l: Lead, note: string) => void }) {
  const [note, setNote] = useState(lead.note);
  const isOpen = lead.status === "suggested" || lead.status === "approved";
  const over = note.length > 300;
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{isOpen ? "Edit connection note" : `Message ${lead.name}`}</DialogTitle>
        <DialogDescription>{lead.name} · {lead.role}, {lead.company}</DialogDescription>
      </DialogHeader>
      {isOpen && (
        <div className="rounded-lg border border-primary/30 bg-primary-soft p-3 text-xs text-foreground">
          <b className="font-semibold text-primary">Why now: </b>{lead.reason}
        </div>
      )}
      <Field label="Note" htmlFor="note" aside={<span className={cn("text-xs", over ? "text-destructive" : "text-muted-foreground")}>{note.length}/300</span>}>
        <Textarea id="note" rows={5} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <p className="text-xs text-muted-foreground">LinkedIn does not let apps send from here. Copy your note into LinkedIn if you want to send it yourself.</p>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={over || !note.trim()} onClick={() => onSend(lead, note.trim())}>{isOpen ? "Save & send" : "Save message"}</Button>
      </DialogFooter>
    </div>
  );
}

function StrategyDialog({ open, onOpenChange, value, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; value: OutreachStrategy; onSave: (s: OutreachStrategy) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{open && <StrategyForm value={value} onCancel={() => onOpenChange(false)} onSave={(s) => { onSave(s); onOpenChange(false); }} />}</DialogContent>
    </Dialog>
  );
}

function StrategyForm({ value, onCancel, onSave }: { value: OutreachStrategy; onCancel: () => void; onSave: (s: OutreachStrategy) => void }) {
  const [who, setWho] = useState(value.who);
  const [perDay, setPerDay] = useState(String(value.perDay));
  const [message, setMessage] = useState(value.message);
  const [days, setDays] = useState(String(value.followUpDays));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = Number(perDay), d = Number(days);
    if (!who.trim() || !message.trim()) return void toast.error("Fill in who to target and what to say.");
    if (!Number.isInteger(p) || p < 1 || p > 40) return void toast.error("Requests per day must be between 1 and 40.");
    if (!Number.isInteger(d) || d < 1 || d > 30) return void toast.error("Follow-up must be between 1 and 30 days.");
    onSave({ ...value, who: who.trim(), message: message.trim(), perDay: p, followUpDays: d, agreedOn: new Date().toISOString().slice(0, 10) });
  };
  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Edit outreach strategy</DialogTitle>
        <DialogDescription>The agent will follow this once you save it.</DialogDescription>
      </DialogHeader>
      <Field label="Who to target" htmlFor="who"><Textarea id="who" rows={2} value={who} onChange={(e) => setWho(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Requests per day" htmlFor="perDay"><Input id="perDay" type="number" min={1} max={40} value={perDay} onChange={(e) => setPerDay(e.target.value)} className={inputCls} /></Field>
        <Field label="Follow up after (days)" htmlFor="days"><Input id="days" type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} className={inputCls} /></Field>
      </div>
      <Field label="What to say" htmlFor="msg"><Textarea id="msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save strategy</Button>
      </DialogFooter>
    </form>
  );
}

function AddPersonDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (l: Lead) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const clean = useMemo(() => normalizeLinkedInProfileUrl(url), [url]);
  const [touched, setTouched] = useState(false);
  const valid = name.trim().length > 1 && !!clean;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return void toast.error("Enter a name and a LinkedIn profile link.");
    onAdd({
      id: `p${Date.now()}`, name: name.trim(), role: role.trim() || "—", company: company.trim() || "—", source: "buyer", status: "suggested",
      reasonKind: "fit", reason: "Added by you", url: clean ?? undefined, note: `Hi ${name.trim().split(" ")[0]}, I'd love to connect.`,
    });
    setName(""); setRole(""); setCompany(""); setUrl(""); setTouched(false);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Add person</DialogTitle>
            <DialogDescription>Add someone you want to connect with. They go into Target buyers for approval.</DialogDescription>
          </DialogHeader>
          <Field label="Full name" htmlFor="pn"><Input id="pn" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role" htmlFor="pr"><Input id="pr" value={role} onChange={(e) => setRole(e.target.value)} className={inputCls} /></Field>
            <Field label="Company" htmlFor="pc"><Input id="pc" value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="LinkedIn profile link" htmlFor="pu"><Input id="pu" type="text" inputMode="url" autoCapitalize="none" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)} aria-invalid={touched && !clean} placeholder="linkedin.com/in/their-name" className={inputCls} />
            {touched && !clean ? <p className="text-xs text-destructive">That doesn’t look like a LinkedIn profile link.</p> : <p className="text-xs text-muted-foreground">With or without https:// both work.</p>}
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Add person</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LeadDialog({ lead, onClose, onEditNote }: { lead: Lead | null; onClose: () => void; onEditNote: (l: Lead) => void }) {
  const Icon = lead ? REASON_ICON[lead.reasonKind] : Target;
  const isOpen = !!lead && (lead.status === "suggested" || lead.status === "approved");
  const copy = async () => {
    if (!lead) return;
    if (await copyText(lead.note)) toast.success("Note copied. Paste it into LinkedIn.");
    else toast.error("Could not copy. Select the text and copy it manually.");
  };
  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {lead && (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3 pr-6">
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full border text-sm font-semibold", TONES[avatarTone(lead.id)].tile)}>{initials(lead.name)}</span>
                <div className="grid gap-1">
                  <DialogTitle className="text-base">{lead.name}</DialogTitle>
                  <DialogDescription>{lead.role} · {lead.company}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2">
              {lead.status === "suggested" && <Pill tone="warning">Suggested</Pill>}
              {lead.status === "approved" && <Pill tone="success">Approved</Pill>}
              {lead.status === "pending" && <Pill tone="primary"><Clock className="size-3" /> Awaiting acceptance{lead.sentAt ? ` · sent ${fmtDate(lead.sentAt)}` : ""}</Pill>}
              {lead.status === "connected" && <Pill tone="success"><Users className="size-3" /> Connected{lead.connectedAt ? ` · ${fmtDate(lead.connectedAt)}` : ""}</Pill>}
              <Pill tone="muted">{lead.source === "engaged" ? "Engaged with you" : "Target buyer"}</Pill>
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary-soft p-3">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-primary uppercase"><Icon className="size-3.5" /> Why they are here</p>
              <p className="text-sm text-foreground">{lead.reason}</p>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{isOpen ? "Connection note" : "Saved note"}</p>
              <p className="text-sm whitespace-pre-line text-foreground">{lead.note}</p>
            </div>

            <DialogFooter>
              {isOpen && <Button variant="ghost" onClick={() => onEditNote(lead)}><Pencil /> Edit note</Button>}
              <Button variant="outline" onClick={copy}><ClipboardCopy /> Copy note</Button>
              <LinkButton size="default" href={lead.url ?? personSearchUrl(lead.name, lead.company)}>
                <ExternalLink /> {lead.url ? "Open on LinkedIn" : "Find on LinkedIn"}
              </LinkButton>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
