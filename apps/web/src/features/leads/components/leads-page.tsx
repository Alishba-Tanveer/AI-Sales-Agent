"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Ban, Download, FileUp, Loader2, Plus, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/ui/option-select";
import { Textarea } from "@/components/ui/textarea";
import { createLead, fetchLeads, updateLead, importLeads, type LeadInput } from "../api";
import type { Lead, LeadStage } from "../types";
import { STAGE_META, STAGE_ORDER } from "../stages";
import { LeadAvatar } from "./lead-avatar";

const FILTERS: { value: LeadStage | "ALL"; label: string; color?: string }[] = [
  { value: "ALL", label: "All leads" },
  ...STAGE_ORDER.map((value) => ({ value, ...STAGE_META[value] })),
];
const STAGE_OPTIONS = STAGE_ORDER.map((value) => ({ value, ...STAGE_META[value] }));
// "Do not contact" has its own button, so it is only listed when a lead is already in that stage.
const optionsFor = (stage: LeadStage) => STAGE_OPTIONS.filter((option) => option.value !== "DO_NOT_CONTACT" || stage === "DO_NOT_CONTACT");
const errorText = (e: unknown) => e instanceof Error ? e.message : "Something went wrong.";

function parseCsv(source: string) {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"' && quoted && source[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.toLowerCase());
  const idx = (names: string[], fallback: number) => { const found = header.findIndex((h) => names.some((n) => h.includes(n))); return found < 0 ? fallback : found; };
  const name = idx(["name", "contact"], 0), email = idx(["email"], 1), role = idx(["role", "title", "job"], 2), company = idx(["company", "organization"], 3), url = idx(["linkedin", "profile"], 4);
  const hasHeader = header.some((h) => ["name", "email", "company", "linkedin", "role", "title"].some((k) => h.includes(k)));
  const data = hasHeader ? rows.slice(1) : rows;
  return data.map((r) => ({ name: r[name] ?? "", email: r[email] ?? "", jobTitle: r[role] ?? "", company: r[company] ?? "", linkedinUrl: r[url] ?? "" })).filter((r) => r.name);
}

export function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState<Partial<Record<LeadStage, number>>>({});
  const [stage, setStage] = useState<LeadStage | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<LeadInput[]>([]);
  const [importSkipped, setImportSkipped] = useState<string[]>([]);
  const [dncLead, setDncLead] = useState<Lead | null>(null);
  const [stageBusyId, setStageBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const result = await fetchLeads(query, stage === "ALL" ? undefined : stage);
      setLeads(result.leads); setCounts(result.counts);
    } catch (e) { setLoadError(errorText(e)); }
    finally { setLoading(false); }
  }, [query, stage]);
  useEffect(() => { void load(); }, [load]);

  const visible = leads;
  const exportCsv = () => {
    const fields = ["name", "email", "jobTitle", "company", "stage", "source", "linkedinUrl"] as const;
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [fields.join(","), ...visible.map((l) => fields.map((f) => escape(l[f])).join(","))].join("\r\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = "leads.csv"; link.click(); URL.revokeObjectURL(link.href);
  };
  const onFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 2_000_000) return void toast.error("Choose a CSV smaller than 2MB.");
    const parsed = parseCsv(await file.text());
    const rows: LeadInput[] = []; const skipped: string[] = [];
    parsed.forEach((row, index) => {
      const rowNumber = index + 1;
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) { skipped.push(`Row ${rowNumber}: invalid email address.`); return; }
      if (row.linkedinUrl) {
        try { const url = new URL(row.linkedinUrl.startsWith("http") ? row.linkedinUrl : `https://${row.linkedinUrl}`); if (!/(^|\.)linkedin\.com$/i.test(url.hostname) || !/^\/(in|pub)\//i.test(url.pathname)) throw new Error(); row.linkedinUrl = url.toString(); }
        catch { skipped.push(`Row ${rowNumber}: invalid LinkedIn profile URL.`); return; }
      }
      rows.push({ ...row, source: "CSV import" });
    });
    setImportRows(rows); setImportSkipped(skipped); setImportOpen(true);
    if (!rows.length) toast.error("No lead rows found. Include a name column or put the name in the first column.");
  };
  const submitImport = async () => {
    setSaving(true);
    try {
      const result = await importLeads(importRows);
      toast.success(`Imported ${result.importedCount} lead${result.importedCount === 1 ? "" : "s"}.`);
      setImportOpen(false); setImportRows([]); setImportSkipped([]); await load();
    } catch (e) { toast.error(errorText(e)); }
    finally { setSaving(false); }
  };
  const saveNew = async (input: LeadInput) => {
    setSaving(true);
    try { const lead = await createLead(input); setOpen(false); toast.success(`${lead.name} added to your lead pipeline.`); router.push(`/leads/${lead.id}`); }
    catch (e) { toast.error(errorText(e)); }
    finally { setSaving(false); }
  };
  const changeStage = async (lead: Lead, nextStage: LeadStage) => {
    if (lead.stage === nextStage) return;
    if (nextStage === "DO_NOT_CONTACT") { setDncLead(lead); return; }
    setStageBusyId(lead.id);
    try {
      await updateLead(lead.id, { stage: nextStage });
      toast.success(`${lead.name} moved to ${STAGE_META[nextStage].label}.`);
      await load();
    } catch (e) { toast.error(errorText(e)); }
    finally { setStageBusyId(null); }
  };
  const moveToDoNotContact = async () => {
    if (!dncLead) return;
    setSaving(true);
    try {
      await updateLead(dncLead.id, { stage: "DO_NOT_CONTACT" });
      toast.success(`${dncLead.name} moved to Do not contact.`);
      setDncLead(null);
      await load();
    } catch (e) { toast.error(errorText(e)); }
    finally { setSaving(false); }
  };

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-6 p-5 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-semibold tracking-tight">Leads</h1><p className="mt-1 text-muted-foreground">One contact record for email and LinkedIn outreach, with every next step tracked here.</p></div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}><FileUp /> Import CSV</Button>
          <Button variant="outline" onClick={exportCsv} disabled={!visible.length}><Download /> Export</Button>
          <Button onClick={() => setOpen(true)}><Plus /> Add lead</Button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: "All active leads", value: Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0), color: "" }, { label: "New leads", value: counts.NEW ?? 0, color: STAGE_META.NEW.color }, { label: "Contacted", value: counts.CONTACTED ?? 0, color: STAGE_META.CONTACTED.color }, { label: "Interested", value: counts.INTERESTED ?? 0, color: STAGE_META.INTERESTED.color }].map((item) => (
          <div key={item.label} className="group flex cursor-default items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 motion-safe:hover:-translate-y-0.5">
            <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
              <span className="size-2 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-150" style={{ backgroundColor: item.color || "var(--primary)" }} aria-hidden /><span className="truncate">{item.label}</span>
            </p>
            <p className="text-2xl font-semibold tracking-tight">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card transition-colors duration-200 hover:border-primary/25">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex flex-wrap gap-1.5">{FILTERS.map((item) => <button key={item.value} onClick={() => setStage(item.value)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${stage === item.value ? "border-primary/30 bg-primary-soft text-primary" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{item.color && <span className="size-1.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />}{item.label}{item.value !== "ALL" && <span className={`rounded-md px-1.5 py-0.5 text-xs ${stage === item.value ? "bg-primary/15" : "bg-muted"}`}>{counts[item.value] ?? 0}</span>}</button>)}</div>
          <label className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, company, email" className="h-9 pl-9" aria-label="Search leads"/></label>
        </div>
        {loadError ? <div className="p-12 text-center"><p className="font-medium">Could not load leads</p><p className="mt-1 text-sm text-muted-foreground">{loadError}</p><Button className="mt-4" variant="outline" onClick={() => void load()}>Retry</Button></div> : loading ? <div className="flex justify-center p-14"><Loader2 className="size-6 animate-spin text-primary"/></div> : visible.length === 0 ? <div className="p-14 text-center"><div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound/></div><h2 className="mt-3 font-semibold">No leads here yet</h2><p className="mt-1 text-sm text-muted-foreground">Add a person, import a CSV, or promote a researched LinkedIn contact into this pipeline.</p><Button className="mt-4" onClick={() => setOpen(true)}><Plus/> Add lead</Button></div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr>{["Contact", "Company", "Source", "Stage", "Next follow-up", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{visible.map((lead, index) => <tr key={lead.id} className="group transition-colors hover:bg-primary/5"><td className="px-4 py-3"><div className="flex items-center gap-3"><LeadAvatar name={lead.name} id={lead.id} prevId={visible[index - 1]?.id}/><div className="min-w-0"><button className="text-left font-medium transition-colors hover:text-primary" onClick={() => router.push(`/leads/${lead.id}`)}>{lead.name}</button><p className="truncate text-xs text-muted-foreground">{lead.jobTitle || "Role not set"}{lead.email ? ` · ${lead.email}` : ""}</p></div></div></td><td className="px-4 py-3">{lead.company || "—"}</td><td className="px-4 py-3 text-muted-foreground">{lead.source || "—"}</td><td className="px-4 py-3"><OptionSelect variant="pill" value={lead.stage} options={optionsFor(lead.stage)} disabled={stageBusyId === lead.id} onValueChange={(next) => void changeStage(lead, next as LeadStage)} aria-label={`Change ${lead.name} stage`}/></td><td className="px-4 py-3 text-muted-foreground">{lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleDateString() : "—"}</td><td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive" onClick={() => setDncLead(lead)} aria-label={`Move ${lead.name} to Do not contact`} title="Move to Do not contact"><Ban/></Button></td></tr>)}</tbody></table></div>
        )}
      </section>

      <LeadForm open={open} busy={saving} onClose={() => setOpen(false)} onSave={saveNew}/>
      <Dialog open={!!dncLead} onOpenChange={(value) => !value && setDncLead(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Move {dncLead?.name} to Do not contact?</DialogTitle><DialogDescription>This keeps the lead in your pipeline, clears their follow-up date, and prevents AI email drafts.</DialogDescription></DialogHeader><DialogFooter><Button variant="ghost" disabled={saving} onClick={() => setDncLead(null)}>Cancel</Button><Button variant="destructive" disabled={saving} onClick={() => void moveToDoNotContact()}>{saving && <Loader2 className="animate-spin"/>}Move to Do not contact</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={importOpen} onOpenChange={setImportOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Import leads</DialogTitle><DialogDescription>{importRows.length} ready to import{importSkipped.length ? ` · ${importSkipped.length} skipped` : ""}. New contacts will be added as New in your pipeline.</DialogDescription></DialogHeader><div className="max-h-64 overflow-auto rounded-lg border border-border"><table className="w-full text-sm"><thead className="sticky top-0 bg-card text-muted-foreground"><tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Email</th><th className="p-2 text-left">Company</th></tr></thead><tbody>{importRows.slice(0, 50).map((r, i) => <tr key={`${r.name}-${i}`} className="border-t border-border"><td className="p-2">{r.name}</td><td className="p-2">{r.email || "—"}</td><td className="p-2">{r.company || "—"}</td></tr>)}</tbody></table></div>{importSkipped.length > 0 && <ul className="max-h-24 list-disc overflow-y-auto pl-5 text-xs text-destructive">{importSkipped.map((reason) => <li key={reason}>{reason}</li>)}</ul>}<DialogFooter><Button variant="ghost" onClick={() => setImportOpen(false)}>Cancel</Button><Button disabled={saving || !importRows.length} onClick={() => void submitImport()}>{saving && <Loader2 className="animate-spin"/>}Import {importRows.length}</Button></DialogFooter></DialogContent></Dialog>
    </main>
  );
}

function LeadForm({ open, busy, onClose, onSave }: { open: boolean; busy: boolean; onClose: () => void; onSave: (input: LeadInput) => Promise<void> }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [jobTitle, setJobTitle] = useState(""); const [company, setCompany] = useState(""); const [linkedinUrl, setLinkedinUrl] = useState(""); const [websiteUrl, setWebsiteUrl] = useState(""); const [notes, setNotes] = useState("");
  useEffect(() => { if (!open) { setName(""); setEmail(""); setJobTitle(""); setCompany(""); setLinkedinUrl(""); setWebsiteUrl(""); setNotes(""); } }, [open]);
  const reset = () => { setName(""); setEmail(""); setJobTitle(""); setCompany(""); setLinkedinUrl(""); setWebsiteUrl(""); setNotes(""); onClose(); };
  return <Dialog open={open} onOpenChange={(value) => !value && reset()}><DialogContent className="sm:max-w-xl"><form onSubmit={(e) => { e.preventDefault(); void onSave({ name, email, jobTitle, company, linkedinUrl, websiteUrl, notes, source: "Manual" }); }} className="grid gap-4"><DialogHeader><DialogTitle>Add lead</DialogTitle><DialogDescription>Add a contact once, then manage their email and LinkedIn outreach from the same record.</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Field label="Full name *"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="Work email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field><Field label="Job title"><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></Field><Field label="Company"><Input value={company} onChange={(e) => setCompany(e.target.value)} /></Field><Field label="LinkedIn profile URL"><Input type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." /></Field><Field label="Company website"><Input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} /></Field></div><Field label="Notes"><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Context, pain points, or why this person fits" /></Field><DialogFooter><Button type="button" variant="ghost" disabled={busy} onClick={reset}>Cancel</Button><Button type="submit" disabled={busy || !name.trim()}>{busy && <Loader2 className="animate-spin"/>}Save &amp; open lead</Button></DialogFooter></form></DialogContent></Dialog>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">{label}</span>{children}</label>; }
