"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Ban, Check, ChevronDown, Clock, ExternalLink, Eye, Heart, Lightbulb, Loader2, MessageSquare, Pencil, Plus, Search, Send, Target, Trash2, TriangleAlert, Upload, Users, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { can, currentRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CARD_HOVER, CARD_INNER, HOVER_BUTTONS, Field, Pill, SectionCard, TONES, initials, inputCls, type Tone } from "@/features/settings/components/settings-ui";
import { addLeadToCrm, createLead, deleteLeads, discoverBuyers, fetchLeads, fetchStrategy, importLeads, saveLeadNote, saveStrategy, sendLead, skipLead, markLeadSent, markLeadConnected, type ImportRow } from "../api";
import { copyText, linkedinMessageUrl, normalizeLinkedInProfileUrl, personSearchUrl } from "../links";
import type { Lead, OutreachStrategy } from "../types";
import { ConfirmDialog, HowItWorksDialog, IconTile, LinkButton, PageHeader, TabBar, fmtDate } from "./linkedin-ui";

type TabId = "engaged" | "buyers" | "pending" | "connected";
const PAGE_SIZE = 8;
/** The server saves up to 500 people per request as one all-or-nothing batch, so bigger files are sent in chunks. */
const IMPORT_CHUNK = 400;
/** Most people one file may hold. LinkedIn exports of a few thousand connections fit. */
const MAX_IMPORT_ROWS = 3000;
/** The file is only read in the browser, never uploaded whole. LinkedIn's messages.csv holds every message text, so it can be large. */
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

/** "Head of Sales · Acme". Empty when the file had no role or company (LinkedIn's messages export). */
const subtitle = (l: Pick<Lead, "role" | "company">) => [l.role, l.company].filter((x) => x && x !== "—").join(" · ");

/** Row action buttons share one size; color comes from the app's tones so each action reads at a glance. */
const ACT = "h-8 gap-1.5 rounded-lg bg-transparent px-3 text-[13px] font-medium dark:bg-transparent";
/** Outline-only tones (no fill); a faint tint appears on hover. */
const OUT = {
  violet: "border-violet-500/50 text-violet-700 hover:bg-violet-500/10 hover:text-violet-800 dark:border-violet-400/40 dark:text-violet-400 dark:hover:bg-violet-400/10 dark:hover:text-violet-300",
  primary: "border-primary/50 text-primary hover:bg-primary/10 hover:text-primary dark:border-primary/40 dark:hover:bg-primary/10",
  success: "border-success/50 text-success hover:bg-success/10 hover:text-success dark:border-success/40 dark:hover:bg-success/10",
  info: "border-sky-500/50 text-sky-700 hover:bg-sky-500/10 hover:text-sky-800 dark:border-sky-400/40 dark:text-sky-400 dark:hover:bg-sky-400/10 dark:hover:text-sky-300",
  destructive: "border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-destructive/40 dark:hover:bg-destructive/10",
} as const;

const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

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
  const canEditWorkspace = can.editWorkspaceSettings(currentRole());
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [strategy, setStrategy] = useState<OutreachStrategy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<TabId>("engaged");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [noteLead, setNoteLead] = useState<Lead | null>(null);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [researching, setResearching] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [detail, setDetail] = useState<Lead | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "withdraw" | "connected" | "delete" | "bulk-delete"; lead?: Lead } | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    Promise.all([fetchLeads(), fetchStrategy()])
      .then(([l, s]) => {
        if (!live) return;
        setLeads(l);
        setStrategy(s);
      })
      .catch((e) => live && setLoadError(errMsg(e, "Could not load your connections.")));
    return () => {
      live = false;
    };
  }, [attempt]);

  const retryLoad = () => {
    setLoadError(null);
    setLeads(null);
    setStrategy(null);
    setAttempt((a) => a + 1);
  };

  const all = leads ?? [];
  const open = (l: Lead) => l.status === "suggested" || l.status === "approved";
  const engaged = all.filter((l) => l.source === "engaged" && open(l));
  const buyers = all.filter((l) => l.source === "buyer" && open(l));
  const pending = all.filter((l) => l.status === "pending");
  const connected = all.filter((l) => l.status === "connected");
  const tabRows = { engaged, buyers, pending, connected }[tab];
  const q = query.trim().toLowerCase();
  const rows = q ? tabRows.filter((l) => [l.name, l.role, l.company, l.reason, l.url ?? ""].some((v) => v.toLowerCase().includes(q))) : tabRows;

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  /** Swap in the person exactly as the server returned them. */
  const replaceLead = (next: Lead) => setLeads((cur) => (cur ?? []).map((l) => (l.id === next.id ? next : l)));
  const unselect = (id: string) => setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
  const changeTab = (t: TabId) => {
    setTab(t);
    setPage(1);
    setSelected(new Set());
  };

  /** Selection is cleared so a bulk action can never reach people the search is hiding. */
  const search = (v: string) => {
    setQuery(v);
    setPage(1);
    setSelected(new Set());
  };

  const messageOnLinkedIn = (l: Lead) => {
    const note = l.note.trim();
    if (!note) return void toast.error(`Add a note for ${l.name} before opening LinkedIn.`);

    void copyText(note).then((copied) => {
      if (copied) toast.success(`Note copied. LinkedIn's message composer opened for ${l.name}; paste it and send.`);
      else toast.error("LinkedIn's message composer opened, but the note could not be copied. Copy it manually.");
    });

    // Suggested leads become prepared in the app while LinkedIn opens from this click.
    if (l.status === "suggested") {
      void sendLead(l.id, note).then(replaceLead).catch((e) => {
        toast.error(errMsg(e, `Could not save the prepared note for ${l.name}.`));
      });
    }
  };
  const markSent = async (l:Lead) => { try { replaceLead(await markLeadSent(l.id)); toast.success(`Marked ${l.name} invitation as sent.`); } catch(e) { toast.error(errMsg(e,"Could not update this invitation.")); } };
  const markConnected = async (l: Lead) => {
    try {
      replaceLead(await markLeadConnected(l.id));
      setConfirm(null);
      toast.success(`${l.name} marked connected. You can message them or add them to Leads.`);
    } catch (e) { toast.error(errMsg(e, `Could not update ${l.name}'s connection status.`)); }
  };
  const promoteToCrm = async (l: Lead) => {
    try {
      const crmLead = await addLeadToCrm(l.id);
      replaceLead({ ...l, crmLeadId: crmLead.id });
      toast.success(`${l.name} is now in Leads.`);
    } catch (e) { toast.error(errMsg(e, `Could not add ${l.name} to Leads.`)); }
  };
  const withdraw = async (l: Lead) => {
    try {
      replaceLead(await skipLead(l.id, "withdraw"));
      toast(`Request to ${l.name} withdrawn`);
    } catch (e) {
      toast.error(errMsg(e, `Could not withdraw the request to ${l.name}.`));
    }
  };
  /** Removes people for good. The server skips anyone already in Leads, so only rows it deleted leave the list. */
  const removePeople = async (ids: string[], label: string) => {
    try {
      const res = await deleteLeads(ids);
      const gone = new Set(ids);
      setLeads((cur) => (cur ?? []).filter((l) => !gone.has(l.id) || l.crmLeadId));
      setSelected(new Set());
      toast.success(res.deletedCount === 1 ? `Deleted ${label || "1 person"}` : `Deleted ${res.deletedCount} people`);
    } catch (e) {
      toast.error(errMsg(e, "Could not delete. Please try again."));
    }
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

  /** Throws on failure so the dialog stays open. */
  const addPerson = async (v: { name: string; role?: string; company?: string; url: string }) => {
    const l = await createLead(v);
    setLeads((cur) => [l, ...(cur ?? [])]);
    changeTab(l.source === "buyer" ? "buyers" : "engaged");
    toast.success(`${l.name} added`);
  };

  /** Throws on failure so the dialog stays open. Large files go in chunks; each chunk is all-or-nothing. */
  const importPeople = async (rows: ImportRow[]) => {
    let imported = 0, duplicates = 0;
    try {
      for (let i = 0; i < rows.length; i += IMPORT_CHUNK) {
        const res = await importLeads(rows.slice(i, i + IMPORT_CHUNK));
        imported += res.importedCount;
        duplicates += res.skippedDuplicates ?? 0;
        setLeads((cur) => [...res.leads, ...(cur ?? [])]);
      }
    } catch (e) {
      if (imported) toast.message(`${imported} people were imported before the error`, { description: "Fix the problem and import the file again. People already added are skipped automatically." });
      throw e;
    }
    changeTab(rows[0]?.status === "connected" ? "connected" : rows[0]?.source === "buyer" ? "buyers" : "engaged");
    toast.success(`Imported ${imported} ${imported === 1 ? "person" : "people"}`, { description: duplicates ? `${duplicates} already in your list ${duplicates === 1 ? "was" : "were"} skipped.` : undefined });
  };

  /** Searches public sources for buyer candidates (the server verifies each one against the source text). Takes up to about a minute. */
  const researchBuyers = async () => {
    if (researching) return;
    setResearching(true);
    try {
      const res = await discoverBuyers();
      if (res.discoveredCount === 0) {
        const sites = [...new Set(res.researchSources.map((s) => { try { return new URL(s.url).hostname.replace(/^www\./, ""); } catch { return ""; } }).filter(Boolean))].slice(0, 5);
        toast("No new buyers found this time", { description: `Nobody in the public results matched closely enough to verify.${sites.length ? ` Searched: ${sites.join(", ")}.` : ""} Try again later, or widen your buyer titles in Settings.` });
        return;
      }
      setLeads((cur) => [...res.leads, ...(cur ?? [])]);
      changeTab("buyers");
      toast.success(`Found ${res.discoveredCount} possible buyer${res.discoveredCount === 1 ? "" : "s"}. Check each one before you reach out.`);
    } catch (e) {
      toast.error(errMsg(e, "Could not research buyers. Please try again."));
    } finally {
      setResearching(false);
    }
  };

  /** "Save note" on someone waiting for approval, or just save the message for someone already connected. */
  const submitNote = async (l: Lead, note: string) => {
    if (open(l)) {
      replaceLead(await sendLead(l.id, note));
      unselect(l.id);
      toast.success(`Connection note saved for ${l.name}. Send it manually on LinkedIn.`);
    } else {
      replaceLead(await saveLeadNote(l.id, note));
      toast.success(`Message saved for ${l.name}`);
    }
    setNoteLead(null);
  };

  const submitStrategy = async (v: Pick<OutreachStrategy, "who" | "message" | "perDay" | "followUpDays">) => {
    setStrategy(await saveStrategy(v));
    toast.success("Strategy updated");
  };

  const showSelect = tab === "engaged" || tab === "buyers";

  return (
    <main className={cn("mx-auto flex w-full max-w-[1280px] flex-col gap-6 p-6 lg:p-8", HOVER_BUTTONS)}>
      <PageHeader
        title="Engagement & Connections"
        description="Import LinkedIn contacts or add people manually, then track connection status and send notes yourself on LinkedIn."
        actions={
          <>
            <Button variant="outline" className={TONES.warning.btn} onClick={() => setHelpOpen(true)}><Lightbulb /> How it works</Button>
            <Button variant="outline" className={TONES.success.btn} onClick={() => setImportOpen(true)}><Upload /> Import</Button>
            <Button variant="outline" className={TONES.pink.btn} onClick={() => void researchBuyers()} disabled={researching} aria-busy={researching}>
              {researching ? <Loader2 className="animate-spin" /> : <Search />} {researching ? "Researching…" : "Research buyers"}
            </Button>
            <Button variant="outline" className={TONES.info.btn} onClick={() => setAddOpen(true)}><Plus /> Add person</Button>
          </>
        }
      />

      <SectionCard
        icon={Target}
        title="Outreach strategy"
        description={strategy ? `${strategy.agreedOn ? `Saved ${fmtDate(strategy.agreedOn)}.` : "Not agreed yet. Set your target and cadence before outreach."} Requests are manual.` : "Loading…"}
        tone="success"
        aside={
          <div className="flex items-center gap-2">
            <Pill tone={strategy?.agreedOn ? "success" : "warning"}>{strategy?.agreedOn ? "Saved" : "Needs your agreement"}</Pill>
            {canEditWorkspace && <Button variant="outline" size="sm" className={TONES.violet.btn} onClick={() => setStrategyOpen(true)} disabled={!strategy}><Pencil /> Edit strategy</Button>}
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
              <p className="text-sm leading-8 text-foreground">
                {strategy.message.split(/(\{[^}]+\})/g).map((part, i) =>
                  /^\{[^}]+\}$/.test(part) ? <span key={i} className="mx-0.5 rounded border border-primary/30 bg-primary-soft px-1.5 py-0.5 font-mono text-xs text-primary">{part}</span> : part,
                )}
              </p>
            </FactTile>
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-1">
              <StatTile icon={Send} tone="warning" label="How often" value={strategy.perDay ? String(strategy.perDay) : "—"} unit="notes / day" />
              <StatTile icon={Clock} tone="violet" label="Follow up after" value={strategy.followUpDays ? String(strategy.followUpDays) : "—"} unit="days" />
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
        aside={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          {selected.size > 0 && <Button variant="outline" size="sm" className={cn("h-8 shrink-0 gap-1.5 px-2.5 text-xs [&_svg]:size-3.5", TONES.destructive.btn)} onClick={() => setConfirm({ kind: "bulk-delete" })}><Trash2 /> Delete ({selected.size})</Button>}
          <div className="group relative w-full transition-[width] duration-200 sm:w-72 sm:focus-within:w-96">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" aria-hidden />
            <Input type="search" value={query} onChange={(e) => search(e.target.value)} placeholder="Search people…" aria-label="Search this list" spellCheck={false}
              className="h-9 rounded-xl border-border bg-card pr-9 pl-10 text-sm shadow-sm transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20 [&::-webkit-search-cancel-button]:hidden" />
            {query && (
              <button type="button" onClick={() => search("")} aria-label="Clear search" className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-muted text-muted-foreground outline-none transition-colors hover:bg-destructive/15 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          </div>
        }
        tabs={[
          { id: "engaged", label: "People who engaged", count: engaged.length },
          { id: "buyers", label: "Target buyers", count: buyers.length },
          { id: "pending", label: "Pending", count: pending.length },
          { id: "connected", label: "Connected", count: connected.length },
        ]}
      />

      {loadError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive-soft/40 px-6 py-12 text-center" role="alert">
          <TriangleAlert className="size-5 text-destructive" />
          <p className="text-sm text-foreground">{loadError}</p>
          <Button variant="outline" onClick={retryLoad}>Try again</Button>
        </div>
      ) : leads === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading people…</div>
      ) : rows.length === 0 && q ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <p className="text-sm font-medium text-foreground">No matches for “{query.trim()}”</p>
          <p className="mt-1 text-sm text-muted-foreground">Nothing in this list matches. Check the spelling, or switch tabs to search another list.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => search("")}>Clear search</Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          {tab === "pending" || tab === "connected" ? (
            <>
              <p className="text-sm font-medium text-foreground">{tab === "pending" ? "No pending requests" : "No connections yet"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{tab === "pending" ? "People you have sent a connection request to will show up here while they decide." : "People who accept your request will show up here."}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">No one here yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Import people who engaged with your posts, or search public sources for buyer candidates in your niche.</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" size="sm" className={TONES.success.btn} onClick={() => setImportOpen(true)}><Upload /> Import CSV</Button>
                <Button variant="outline" size="sm" className={TONES.pink.btn} onClick={() => void researchBuyers()} disabled={researching}>
                  {researching ? <Loader2 className="animate-spin" /> : <Search />} {researching ? "Researching…" : "Research buyers"}
                </Button>
              </div>
              {researching && <p className="mt-3 text-xs text-muted-foreground" role="status">Searching public sources. This can take up to a minute.</p>}
            </>
          )}
        </div>
      ) : (
        <div className={cn("overflow-hidden rounded-xl border border-border bg-card", CARD_HOVER)}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
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
                    <tr key={l.id} className={cn("align-middle transition-colors hover:bg-muted/60", selected.has(l.id) && "bg-primary-soft/60")}>
                      {showSelect && (
                        <td className="px-4 py-3"><Check3 checked={selected.has(l.id)} onChange={() => toggle(l.id)} label={`Select ${l.name}`} /></td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", TONES[avatarTone(l.id, visible[i - 1]?.id)].tile)}>{initials(l.name)}</span>
                          <button type="button" onClick={() => setDetail(l)} className="min-w-0 cursor-pointer rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <p className="[overflow-wrap:anywhere] font-medium text-foreground hover:text-primary">{l.name}</p>
                            {subtitle(l) && <p className="[overflow-wrap:anywhere] text-xs text-muted-foreground">{subtitle(l)}</p>}
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
                      <td className="px-4 py-3 align-middle">
                        <div className="flex min-h-8 flex-nowrap items-center justify-end gap-2">
                          {open(l) && <Button size="sm" variant="outline" className={cn(ACT, OUT.violet)} onClick={() => setNoteLead(l)}><Pencil /> Edit note</Button>}
                          {open(l) && l.url && <LinkButton size="sm" variant="outline" className={cn(ACT, OUT.primary)} title="Copy your note, then open this person's LinkedIn inbox" href={linkedinMessageUrl(l.url) ?? normalizeLinkedInProfileUrl(l.url) ?? l.url} onClick={() => messageOnLinkedIn(l)}><MessageSquare /> Copy &amp; open inbox</LinkButton>}
                          {l.status === "approved" && <Button size="sm" variant="outline" className={cn(ACT, OUT.success)} onClick={() => markSent(l)}><Check /> I sent it</Button>}
                          {l.status === "pending" && l.url && <LinkButton size="sm" variant="outline" className={cn(ACT, OUT.info)} href={linkedinMessageUrl(l.url) ?? normalizeLinkedInProfileUrl(l.url) ?? l.url}><MessageSquare /> Check reply / follow</LinkButton>}
                          {l.status === "pending" && <DropdownMenu>
                            <DropdownMenuTrigger className={cn(ACT, "inline-flex cursor-pointer items-center border border-border bg-background transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>Update status<ChevronDown className="size-3.5"/></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-44">
                              <DropdownMenuItem onClick={() => setConfirm({ kind: "connected", lead: l })}><Users/>Mark connected</DropdownMenuItem>
                              <DropdownMenuItem variant="destructive" onClick={() => setConfirm({ kind: "withdraw", lead: l })}><Ban/>Mark withdrawn</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>}
                          {/* Add to Leads exists only on the Connected tab. */}
                          {tab === "connected" && (l.crmLeadId ? <span className="px-2 text-xs font-medium text-success">In Leads</span> : <Button size="sm" variant="outline" className={cn(ACT, OUT.success)} onClick={() => void promoteToCrm(l)}><Plus /> Add to Leads</Button>)}
                          {/* Delete is last, a plain red icon (same as Content), and only until the person is in Leads. */}
                          {!l.crmLeadId && <Button size="icon" variant="ghost" aria-label={`Delete ${l.name}`} title="Delete person" className="size-8 rounded-lg text-destructive hover:bg-transparent hover:text-destructive dark:hover:bg-transparent" onClick={() => setConfirm({ kind: "delete", lead: l })}><Trash2 className="size-4" /></Button>}
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

      <NoteDialog lead={noteLead} onClose={() => setNoteLead(null)} onSend={submitNote} />
      {strategy && <StrategyDialog open={strategyOpen} onOpenChange={setStrategyOpen} value={strategy} onSave={submitStrategy} />}
      <AddPersonDialog open={addOpen} onOpenChange={setAddOpen} onAdd={addPerson} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={importPeople} />
      <LeadDialog lead={detail} onClose={() => setDetail(null)} onEditNote={(l) => { setDetail(null); setNoteLead(l); }} />

      <ConfirmDialog
        open={confirm?.kind === "withdraw"}
        onOpenChange={(o) => !o && setConfirm(null)}
        tone="destructive"
        title="Mark this request withdrawn?"
        description={confirm?.lead ? `Your request to ${confirm.lead.name} is marked as withdrawn here. To cancel it on LinkedIn too, open Manage invitations → Sent.` : ""}
        confirmLabel="Mark withdrawn"
        onConfirm={() => confirm?.lead && withdraw(confirm.lead)}
      >
        <LinkButton href="https://www.linkedin.com/mynetwork/invitation-manager/sent/" variant="outline" size="sm" className="w-fit">
          Open sent invitations <ExternalLink className="size-3" />
        </LinkButton>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm?.kind === "connected"}
        onOpenChange={(o) => !o && setConfirm(null)}
        tone="success"
        title="They accepted your invitation?"
        description={confirm?.lead ? `Confirm on LinkedIn that ${confirm.lead.name} accepted. This only updates the status in this app; LinkedIn does not sync acceptance events here.` : ""}
        confirmLabel="Mark connected"
        onConfirm={() => confirm?.lead && markConnected(confirm.lead)}
      />
      <ConfirmDialog
        open={confirm?.kind === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        tone="destructive"
        icon={Trash2}
        title="Delete this person?"
        description={confirm?.lead ? `${confirm.lead.name} is removed from your lists for good. You can import them again later.` : ""}
        confirmLabel="Delete"
        onConfirm={() => confirm?.lead && removePeople([confirm.lead.id], confirm.lead.name)}
      />
      <ConfirmDialog
        open={confirm?.kind === "bulk-delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        tone="destructive"
        icon={Trash2}
        title={`Delete ${selected.size} ${selected.size === 1 ? "person" : "people"}?`}
        description="They are removed from your lists for good. Anyone already in Leads is kept. You can import them again later."
        confirmLabel="Delete"
        onConfirm={() => removePeople([...selected], "")}
      />

      <HowItWorksDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        tone="info"
        title="How Connections works"
        description="Import and track contacts. You decide manually who to contact."
        steps={[
          { title: "Add the right people", text: "Import people who engaged with you from CSV, or add target buyers manually." },
          { title: "You review the list", text: "Click a name to see why they are here. Edit the note, or copy it and send it yourself." },
          { title: "Send from LinkedIn", text: "Copy a personalized note and send invitations yourself in LinkedIn. No automatic messages or campaigns." },
          { title: "Track replies manually", text: "After the invitation is accepted, mark the person Connected here. The app does not read invitation events." },
        ]}
        note="Standard LinkedIn self-serve permissions do not provide engagement-list access or general invitation sending. Import engagement contacts and handle invitations manually."
      />
    </main>
  );
}

function FactTile({ icon, tone, label, className, children }: { icon: LucideIcon; tone: Tone; label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-background p-4", CARD_INNER, className)}>
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
    <div className={cn("flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background p-4", CARD_INNER)}>
      <IconTile icon={icon} tone={tone} className="size-8" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
          <span className="[overflow-wrap:anywhere] text-xs text-muted-foreground">{unit}</span>
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

function NoteDialog({ lead, onClose, onSend }: { lead: Lead | null; onClose: () => void; onSend: (l: Lead, note: string) => Promise<void> }) {
  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{lead && <NoteForm key={lead.id} lead={lead} onClose={onClose} onSend={onSend} />}</DialogContent>
    </Dialog>
  );
}

function NoteForm({ lead, onClose, onSend }: { lead: Lead; onClose: () => void; onSend: (l: Lead, note: string) => Promise<void> }) {
  const [note, setNote] = useState(lead.note);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await onSend(lead, note.trim());
    } catch (e) {
      toast.error(errMsg(e, "Could not save your note."));
      setBusy(false);
    }
  };
  const isOpen = lead.status === "suggested" || lead.status === "approved";
  const over = note.length > 300;
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{isOpen ? "Edit connection note" : `Message ${lead.name}`}</DialogTitle>
        <DialogDescription>{lead.name}{subtitle(lead) && ` · ${subtitle(lead)}`}</DialogDescription>
      </DialogHeader>
      {isOpen && (
        <div className="rounded-lg border border-primary/30 bg-primary-soft p-3 text-xs text-foreground">
          <b className="font-semibold text-primary">Why now: </b>{lead.reason}
        </div>
      )}
      <Field label="Note" htmlFor="note" aside={<span className={cn("text-xs", over ? "text-destructive" : "text-muted-foreground")}>{note.length}/300</span>}>
        <Textarea id="note" rows={5} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <p className="text-xs text-muted-foreground">Save your note, then use Message on LinkedIn to copy it and open the message box. You send it yourself.</p>
      <DialogFooter>
        <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button disabled={over || !note.trim() || busy} onClick={submit}>{busy && <Loader2 className="animate-spin" />} {isOpen ? "Save note" : "Save message"}</Button>
      </DialogFooter>
    </div>
  );
}

type StrategyInput = Pick<OutreachStrategy, "who" | "message" | "perDay" | "followUpDays">;

function StrategyDialog({ open, onOpenChange, value, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; value: OutreachStrategy; onSave: (s: StrategyInput) => Promise<void> }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{open && <StrategyForm value={value} onCancel={() => onOpenChange(false)} onSave={async (s) => { await onSave(s); onOpenChange(false); }} />}</DialogContent>
    </Dialog>
  );
}

function StrategyForm({ value, onCancel, onSave }: { value: OutreachStrategy; onCancel: () => void; onSave: (s: StrategyInput) => Promise<void> }) {
  const [who, setWho] = useState(value.who);
  const [perDay, setPerDay] = useState(String(value.perDay));
  const [message, setMessage] = useState(value.message);
  const [days, setDays] = useState(String(value.followUpDays));
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = Number(perDay), d = Number(days);
    if (!who.trim() || !message.trim()) return void toast.error("Fill in who to target and what to say.");
    if (!Number.isInteger(p) || p < 1 || p > 40) return void toast.error("Daily target must be between 1 and 40.");
    if (!Number.isInteger(d) || d < 1 || d > 30) return void toast.error("Follow-up must be between 1 and 30 days.");
    setBusy(true);
    try {
      await onSave({ who: who.trim(), message: message.trim(), perDay: p, followUpDays: d });
    } catch (err) {
      toast.error(errMsg(err, "Could not save your strategy."));
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Edit outreach strategy</DialogTitle>
        <DialogDescription>Set a target and cadence you agree with. The app prepares notes but does not send invitations.</DialogDescription>
      </DialogHeader>
      <Field label="Who to target" htmlFor="who"><Textarea id="who" rows={2} value={who} onChange={(e) => setWho(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Daily target" htmlFor="perDay"><Input id="perDay" type="number" min={1} max={40} value={perDay} onChange={(e) => setPerDay(e.target.value)} className={inputCls} /></Field>
        <Field label="Follow up after (days)" htmlFor="days"><Input id="days" type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} className={inputCls} /></Field>
      </div>
      <Field label="What to say" htmlFor="msg">
        <Textarea id="msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        <p className="text-xs text-muted-foreground">Personalization fields: {"{first_name}"}, {"{company}"}, {"{role}"}, {"{offer}"}, {"{audience}"}, {"{industry}"}. Review each note before sending it yourself.</p>
      </Field>
      <DialogFooter>
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Save strategy</Button>
      </DialogFooter>
    </form>
  );
}

function AddPersonDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (v: { name: string; role?: string; company?: string; url: string }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const clean = useMemo(() => normalizeLinkedInProfileUrl(url), [url]);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const valid = name.trim().length > 1 && !!clean;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || !clean) return void toast.error("Enter a name and a LinkedIn profile link.");
    setBusy(true);
    try {
      await onAdd({ name: name.trim(), role: role.trim() || undefined, company: company.trim() || undefined, url: clean });
      setName(""); setRole(""); setCompany(""); setUrl(""); setTouched(false);
      onOpenChange(false);
    } catch (err) {
      toast.error(errMsg(err, "Could not add that person."));
    } finally {
      setBusy(false);
    }
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
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Add person</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Splits CSV text into rows of cells; handles quoted cells with commas and "" escapes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell.trim()); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

type ImportPerson = Omit<ImportRow, "source" | "reason">;
type ParsedImport = { ready: ImportPerson[]; skipped: string[]; problems: string[]; linkedinExport: boolean; messagesExport?: boolean };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** "22 Jun 2026" (LinkedIn's format) or "2026-06-22" -> "2026-06-22"; anything else -> undefined. */
function isoDate(v: string): string | undefined {
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})$/);
  if (!m) return undefined;
  const mi = MONTHS.indexOf(m[2].toLowerCase());
  return mi < 0 ? undefined : `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/**
 * Reads LinkedIn's "messages.csv" (Get a copy of your data -> Messages). It has one row per MESSAGE, with columns
 * CONVERSATION ID, CONVERSATION TITLE, FROM, SENDER PROFILE URL, TO, RECIPIENT PROFILE URLS, DATE, SUBJECT, CONTENT...
 * Those are not people, so reading it as name/role/company puts conversation ids where names belong. Instead:
 *  - the person who is in every conversation is you, and is left out;
 *  - everyone else becomes one person (name + profile link), no matter how many messages they sent.
 */
function readMessages(rows: string[][], headerAt: number): ParsedImport {
  const h = rows[headerAt].map((x) => x.toLowerCase().replace(/\s+/g, " ").trim());
  const col = (n: string) => h.indexOf(n);
  const iConv = col("conversation id"), iFrom = col("from"), iFromUrl = col("sender profile url"), iTo = col("to"), iToUrls = col("recipient profile urls");
  const clip = (v: string, n = 120) => v.replace(/\s+/g, " ").trim().slice(0, n);
  const get = (r: string[], i: number) => (i >= 0 ? r[i] ?? "" : "");
  const profileUrls = (v: string) => (v.match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)?linkedin\.com\/(?:in|pub)\/[^\s,;"]+/gi) ?? []).map((u) => normalizeLinkedInProfileUrl(u)).filter((u): u is string => !!u);

  type P = { name: string; url?: string };
  const keyOf = (p: P) => (p.url ?? p.name).toLowerCase();
  const data = rows.slice(headerAt + 1);
  const perRow = data.map((r, i): { conv: string; people: P[] } => {
    const people: P[] = [];
    const fromUrl = profileUrls(get(r, iFromUrl))[0];
    const from = clip(get(r, iFrom));
    if (from || fromUrl) people.push({ name: from, url: fromUrl });
    const toUrls = profileUrls(get(r, iToUrls));
    const to = clip(get(r, iTo), 400);
    const toNames = toUrls.length > 1 ? to.split(/\s*,\s*/) : [to];
    if (toUrls.length) toUrls.forEach((url, k) => people.push({ name: clip(toNames.length === toUrls.length ? toNames[k] : toUrls.length === 1 ? to : ""), url }));
    else if (to) people.push({ name: to });
    return { conv: get(r, iConv) || `row${i}`, people };
  });

  // You are the one person who takes part in every conversation.
  const convsOf = new Map<string, Set<string>>();
  perRow.forEach(({ conv, people }) => people.forEach((p) => { const k = keyOf(p); (convsOf.get(k) ?? convsOf.set(k, new Set()).get(k)!).add(conv); }));
  const me = [...convsOf.entries()].sort((a, b) => b[1].size - a[1].size)[0]?.[0];

  const found = new Map<string, P>();
  perRow.forEach(({ people }) => people.forEach((p) => {
    const k = keyOf(p);
    if (k === me) return;
    const have = found.get(k);
    found.set(k, { name: have?.name || p.name, url: have?.url ?? p.url });
  }));

  const ready: ImportPerson[] = [];
  const skipped: string[] = [];
  const problems: string[] = [];
  const seenUrl = new Set<string>();
  for (const p of found.values()) {
    if (p.url && seenUrl.has(p.url)) continue;
    if (p.url) seenUrl.add(p.url);
    if (p.name.length < 2) { skipped.push(`${p.url ?? "A person"}: no name in the file, skipped.`); continue; }
    if (/^linkedin member$/i.test(p.name)) { skipped.push(`${p.url ?? "A person"}: LinkedIn hides this person’s name (“LinkedIn Member”), skipped.`); continue; }
    ready.push({ name: p.name, url: p.url });
  }
  if (ready.length > MAX_IMPORT_ROWS) problems.push(`Import up to ${MAX_IMPORT_ROWS} people at a time. This file has ${ready.length} people.`);
  if (!ready.length && !problems.length) problems.push("No people were found in this messages file.");
  return { ready, skipped, problems, linkedinExport: false, messagesExport: true };
}

/**
 * Reads LinkedIn's own "Connections.csv" export as well as a simple name/role/company/link list.
 *  - LinkedIn puts a few "Notes:" lines above the header; they are skipped.
 *  - "First Name" + "Last Name", "Position" and "Connected On" columns are understood.
 *  - Without a header, LinkedIn's column order (first, last, link, email, company, position, date) is detected from the link in column 3.
 *  - Empty rows and rows with no usable name are skipped and listed, they never block the rest of the file.
 */
function readImport(text: string): ParsedImport {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  const norm = (h: string) => h.toLowerCase().replace(/\s+/g, " ").trim();
  const messagesAt = rows.findIndex((r) => r.some((h) => norm(h) === "sender profile url") && r.some((h) => norm(h) === "from"));
  if (messagesAt >= 0) return readMessages(rows, messagesAt);
  const headerAt = rows.findIndex((r) => r.length >= 3 && r.some((h) => /^(first name|full name|name)$/.test(norm(h))));
  const header = headerAt >= 0 ? rows[headerAt].map(norm) : null;
  const dataRows = rows.slice(headerAt >= 0 ? headerAt + 1 : 0);
  const isLinkedInLayout = !header && dataRows.slice(0, 8).some((r) => /linkedin\.com\//i.test(r[2] ?? ""));
  const find = (re: RegExp) => (header ? header.findIndex((h) => re.test(h)) : -1);
  const at = header
    ? { first: find(/^first name$/), last: find(/^last name$/), name: find(/^(full )?name$/), role: find(/position|title|role|headline/), company: find(/company|organi[sz]ation|employer/), url: find(/^url$|profile|link|linkedin/), date: find(/connected on/) }
    : isLinkedInLayout
      ? { first: 0, last: 1, name: -1, role: 5, company: 4, url: 2, date: 6 }
      : { first: -1, last: -1, name: 0, role: 1, company: 2, url: 3, date: -1 };
  const linkedinExport = !!header ? at.first >= 0 && at.url >= 0 : isLinkedInLayout;

  const ready: ImportPerson[] = [];
  const skipped: string[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  const clip = (s: string, n = 120) => s.replace(/\s+/g, " ").trim().slice(0, n);
  const cell = (r: string[], i: number) => (i >= 0 ? clip(r[i] ?? "", 500) : "");
  if (dataRows.length > MAX_IMPORT_ROWS) problems.push(`Import up to ${MAX_IMPORT_ROWS} people at a time. Split this file in two.`);

  dataRows.slice(0, MAX_IMPORT_ROWS).forEach((r, i) => {
    const line = i + 1;
    const name = clip(at.name >= 0 ? cell(r, at.name) : `${cell(r, at.first)} ${cell(r, at.last)}`);
    const rawUrl = cell(r, at.url);
    if (!name && !rawUrl && !cell(r, at.company) && !cell(r, at.role)) return; // empty line: nothing to say about it
    if (name.length < 2) return void skipped.push(`Line ${line}: no name${rawUrl ? ` (${rawUrl})` : ""}, skipped.`);
    const url = rawUrl ? normalizeLinkedInProfileUrl(rawUrl) ?? undefined : undefined;
    const key = url ?? `${name}|${cell(r, at.company)}`.toLowerCase();
    if (seen.has(key)) return void skipped.push(`Line ${line} (${name}): listed twice in this file, skipped.`);
    seen.add(key);
    if (rawUrl && !url) skipped.push(`Line ${line} (${name}): the link isn’t a LinkedIn profile, so ${name} is imported without one.`);
    ready.push({ name, role: clip(cell(r, at.role)) || undefined, company: clip(cell(r, at.company)) || undefined, url, connectedAt: at.date >= 0 ? isoDate(cell(r, at.date)) : undefined });
  });
  if (!ready.length && !problems.length) problems.push(rows.length ? "No people with a name were found in this text. Check that the columns are name, role, company, link (or LinkedIn’s export)." : "");
  return { ready, skipped, problems: problems.filter(Boolean), linkedinExport };
}

type ImportDest = "engaged" | "buyer" | "connected";

function ImportDialog({ open, onOpenChange, onImport }: { open: boolean; onOpenChange: (o: boolean) => void; onImport: (rows: ImportRow[]) => Promise<void> }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [dest, setDest] = useState<ImportDest>("engaged");
  const [destTouched, setDestTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => (text.trim() ? readImport(text) : null), [text]);
  // LinkedIn's own export is a list of people you are already connected with, so that is the natural place for it.
  useEffect(() => { if (parsed?.linkedinExport && !destTouched) setDest("connected"); }, [parsed?.linkedinExport, destTouched]);
  useEffect(() => { if (!open) { setText(""); setFileName(""); setDestTouched(false); } }, [open]);
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_IMPORT_BYTES) return void toast.error("That file is larger than 25MB. Split it into smaller files.");
    setText(await f.text());
    setFileName(f.name);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed?.ready.length) return void toast.error("Add at least one person with a name.");
    if (parsed.problems.length) return void toast.error(parsed.problems[0]);
    setBusy(true);
    try {
      const reason = dest === "connected" ? "Imported from your LinkedIn connections" : dest === "engaged" ? "Imported: engaged with your LinkedIn posts" : "Imported: target buyer from your list";
      await onImport(parsed.ready.map((r) => ({ ...r, source: dest === "buyer" ? "buyer" : "engaged", status: dest === "connected" ? "connected" : "suggested", reason })));
      setText("");
      setFileName("");
      onOpenChange(false);
    } catch (err) {
      toast.error(errMsg(err, "Could not import these people."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid min-w-0 gap-4">
          <DialogHeader>
            <DialogTitle>Import people</DialogTitle>
            <DialogDescription>Upload or paste LinkedIn’s Connections.csv or messages.csv export, or a CSV with name, role, company and LinkedIn link. A header row is optional.</DialogDescription>
          </DialogHeader>
          <Field label="Add them to" htmlFor="imp-src">
            <div id="imp-src" role="radiogroup" className="grid grid-cols-3 gap-2">
              {([["connected", "My connections", Users], ["engaged", "Engaged", Heart], ["buyer", "Target buyers", Target]] as const).map(([id, label, Icon]) => (
                <button key={id} type="button" role="radio" aria-checked={dest === id} onClick={() => { setDest(id); setDestTouched(true); }}
                  className={cn("flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring", dest === id ? "border-primary bg-primary-soft text-primary" : "border-input text-foreground hover:bg-secondary/60")}>
                  <Icon className="size-4 shrink-0" /> <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label="CSV" htmlFor="imp-csv" aside={<Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload /> Choose file</Button>}>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" aria-label="Upload a CSV file" />
            {fileName && text ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm">
                <span className="truncate">{fileName}</span>
                <button type="button" className="shrink-0 text-xs font-medium text-primary hover:underline" onClick={() => { setText(""); setFileName(""); }}>Remove</button>
              </div>
            ) : (
              <Textarea id="imp-csv" rows={5} wrap="off" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="max-h-40 w-full min-w-0 resize-none overflow-auto font-mono text-xs whitespace-pre"
                placeholder={"name,role,company,url\nJane Doe,Head of Sales,Acme,linkedin.com/in/jane-doe"} />
            )}
          </Field>
          {parsed && (
            <div className="grid min-w-0 gap-1.5 text-xs" aria-live="polite">
              <p className="text-foreground">
                <b className="font-semibold">{parsed.ready.length}</b> {parsed.ready.length === 1 ? "person" : "people"} ready to import
                {parsed.linkedinExport ? " (LinkedIn export detected)" : parsed.messagesExport ? " (LinkedIn messages export: one person per conversation)" : ""}
                {parsed.skipped.length ? `, ${parsed.skipped.length} line${parsed.skipped.length === 1 ? "" : "s"} skipped` : ""}.
              </p>
              {parsed.problems.length > 0 && (
                <ul className="max-h-24 list-disc overflow-y-auto pl-4 text-destructive">
                  {parsed.problems.map((p) => <li key={p}>{p}</li>)}
                </ul>
              )}
              {parsed.skipped.length > 0 && (
                <ul className="max-h-20 list-disc overflow-y-auto pl-4 text-muted-foreground">
                  {parsed.skipped.slice(0, 20).map((p) => <li key={p} className="[overflow-wrap:anywhere]">{p}</li>)}
                  {parsed.skipped.length > 20 && <li>…and {parsed.skipped.length - 20} more.</li>}
                </ul>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">LinkedIn doesn’t let apps read who liked or commented, so export or copy those people yourself. Get your connections from LinkedIn → Settings → Data privacy → Get a copy of your data → Connections.</p>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !parsed?.ready.length || !!parsed?.problems.length}>{busy && <Loader2 className="animate-spin" />} Import {parsed?.ready.length || ""}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LeadDialog({ lead, onClose, onEditNote }: { lead: Lead | null; onClose: () => void; onEditNote: (l: Lead) => void }) {
  const Icon = lead ? REASON_ICON[lead.reasonKind] : Target;
  const isOpen = !!lead && (lead.status === "suggested" || lead.status === "approved");
  const copyAndMessage = () => {
    if (!lead) return;
    void copyText(lead.note).then((copied) => {
      if (copied) toast.success(`Note copied. LinkedIn's message composer opened for ${lead.name}; paste it and send.`);
      else toast.error("LinkedIn's message composer opened, but the note could not be copied. Copy it manually.");
    });
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
                  <DialogDescription>{subtitle(lead) || "LinkedIn contact"}</DialogDescription>
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

            <div className={cn("rounded-lg border border-border bg-background p-3", CARD_INNER)}>
              <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{isOpen ? "Connection note" : "Saved note"}</p>
              <p className="text-sm whitespace-pre-line text-foreground">{lead.note}</p>
            </div>

            <DialogFooter>
              {isOpen && <Button variant="ghost" onClick={() => onEditNote(lead)}><Pencil /> Edit note</Button>}
              <LinkButton size="default" href={linkedinMessageUrl(lead.url ?? "") ?? normalizeLinkedInProfileUrl(lead.url ?? "") ?? personSearchUrl(lead.name, lead.company)} onClick={copyAndMessage}>
                <MessageSquare /> {lead.url ? "Copy note & open LinkedIn inbox" : "Find on LinkedIn"}
              </LinkButton>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
