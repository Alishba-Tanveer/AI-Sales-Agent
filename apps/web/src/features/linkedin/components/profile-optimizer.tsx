"use client";

import { useEffect, useState } from "react";
import {
  Check, CheckCircle2, ChevronDown, ChevronsDownUp, ChevronsUpDown, ClipboardCopy, ExternalLink, Info, Link2, Loader2, RefreshCw,
  ScanSearch, Target, TriangleAlert, UserRoundPen, Lightbulb, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Pill, SectionCard, inputCls, type Tone } from "@/features/settings/components/settings-ui";
import { ApiError } from "@/lib/api";
import { analyzeProfile, fetchSavedAudit, setSuggestionDone } from "../api";
import { copyText, editTarget, normalizeLinkedInProfileUrl } from "../links";
import type { ProfileAnalysis, ProfileSuggestion, SuggestionKey } from "../types";
import { ConfirmDialog, HowItWorksDialog, IconTile, LinkButton, PageHeader, StepStrip, fmtDate } from "./linkedin-ui";

const SECTION_ICON: Record<SuggestionKey, LucideIcon> = {
  headline: UserRoundPen, about: Info, experience: Target, skills: Check, featured: Link2,
};
// one accent per section so the list reads at a glance
const SECTION_TONE: Record<SuggestionKey, Tone> = {
  headline: "primary", about: "info", experience: "violet", skills: "warning", featured: "success",
};

export function ProfileOptimizer() {
  const [offer, setOffer] = useState("");
  const [audience, setAudience] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set()); // every suggestion starts closed
  const [guide, setGuide] = useState<ProfileSuggestion | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [rereadOpen, setRereadOpen] = useState(false);

  // Pick up where the person left off: the niche, the profile link, the last list of changes and the ticks.
  useEffect(() => {
    let live = true;
    fetchSavedAudit()
      .then((saved) => {
        if (!live) return;
        setOffer(saved.offer);
        setAudience(saved.audience);
        if (saved.profileUrl) {
          setUrl(saved.profileUrl);
          setAnalysis(saved.analysis);
          setDone(new Set(saved.analysis.doneKeys));
        }
      })
      .catch(() => {
        /* first visit or the server is unreachable: start with an empty form */
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  const read = async () => {
    if (!offer.trim() || !audience.trim()) return void toast.error("Tell us what you do and who you sell to first.");
    const clean = normalizeLinkedInProfileUrl(url);
    if (!clean) {
      setUrlError("That doesn’t look like a LinkedIn profile link. Try linkedin.com/in/your-name");
      return;
    }
    setUrl(clean);
    setUrlError(null);
    setReading(true);
    try {
      const result = await analyzeProfile(clean, { offer: offer.trim(), audience: audience.trim() });
      setAnalysis(result);
      setDone(new Set(result.doneKeys));
      setOpenKeys(new Set());
      toast.success("Profile read. Your changes are ready.");
    } catch (e) {
      // the backend explains bad links itself; anything else gets the generic message
      toast.error(e instanceof ApiError && e.status === 400 ? e.message : "Could not read that profile. Check the link and try again.");
    } finally {
      setReading(false);
    }
  };

  /** Tick / untick a change. Updates the screen at once, then saves it; the tick is rolled back if the save fails. */
  const setDoneKey = (key: string, value: boolean) => {
    const apply = (on: boolean) =>
      setDone((prev) => {
        const next = new Set(prev);
        if (on) next.add(key);
        else next.delete(key);
        return next;
      });
    apply(value);
    setSuggestionDone(key, value).catch(() => {
      apply(!value);
      toast.error("Could not save that. Please try again.");
    });
  };
  const toggleDone = (key: string) => setDoneKey(key, !done.has(key));
  const toggleOpen = (key: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const total = analysis?.suggestions.length ?? 0;
  const pct = total ? Math.round((done.size / total) * 100) : 0;
  const allOpen = total > 0 && openKeys.size === total;

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 p-6 lg:p-8">
      <PageHeader
        title="Profile Optimizer"
        description="Tell us your niche, share your LinkedIn link, and get a clear list of changes to make."
        actions={
          <>
            <Button variant="outline" onClick={() => setHelpOpen(true)}><Lightbulb /> How it works</Button>
            {analysis && (
              <Button variant="outline" onClick={() => (done.size ? setRereadOpen(true) : read())} disabled={reading}>
                {reading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Re-read profile
              </Button>
            )}
          </>
        }
      />

      <StepStrip
        steps={[
          { label: "Tell us your niche", icon: Target, tone: "info" },
          { label: "Connect your profile", icon: Link2, tone: "warning" },
          { label: "Apply the changes", icon: UserRoundPen, tone: "success" },
        ]}
      />

      <SectionCard icon={Target} title="Your niche" description="We compare your LinkedIn profile against this." tone="info">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="What do you do?" htmlFor="offer">
            <Textarea id="offer" rows={2} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="e.g. I build AI agents for B2B SaaS outbound" />
          </Field>
          <Field label="Who do you want to sell to?" htmlFor="audience">
            <Textarea id="audience" rows={2} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. Heads of Sales at SaaS companies with 50–500 people" />
          </Field>
        </div>

        <div className="border-t border-border pt-5">
          <Field
            label="Your LinkedIn profile link"
            htmlFor="profile-url"
            aside={
              analysis && (
                <span className="flex items-center gap-1.5 text-xs text-success">
                  <span className="size-1.5 rounded-full bg-success" /> Profile read · {fmtDate(analysis.readAt)}
                </span>
              )
            }
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              {/* type="text" on purpose: type="url" makes the browser reject links without https:// */}
              <Input
                id="profile-url"
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setUrlError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && read()}
                aria-invalid={!!urlError}
                placeholder="linkedin.com/in/your-name"
                className={cn(inputCls, "flex-1")}
              />
              <Button onClick={read} disabled={reading || loading} className="h-10 sm:w-auto">
                {reading ? <Loader2 className="animate-spin" /> : <ScanSearch />} {reading ? "Reading…" : "Read my profile"}
              </Button>
            </div>
            {urlError ? (
              <p className="text-xs text-destructive">{urlError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">With or without https:// and www. both work.</p>
            )}
          </Field>
        </div>
      </SectionCard>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 p-10 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" /> Loading your last profile read…
        </div>
      ) : !analysis ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <p className="text-sm font-medium text-foreground">Your list of changes will appear here</p>
          <p className="mt-1 text-sm text-muted-foreground">Add your niche and profile link above, then press “Read my profile”.</p>
        </div>
      ) : (
        <section className="flex flex-col gap-4" aria-live="polite">
          <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm text-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>LinkedIn doesn&apos;t allow apps to edit your profile. Copy each suggestion and paste it into LinkedIn yourself.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-foreground">Changes to make</h2>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setOpenKeys(allOpen ? new Set() : new Set(analysis.suggestions.map((s) => s.key)))}>
                {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />} {allOpen ? "Close all" : "Open all"}
              </Button>
              <span className="text-sm text-muted-foreground">{done.size} of {total} done</span>
              <div className="h-2 w-40 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          <ul className="flex flex-col gap-3">
            {analysis.suggestions.map((s) => (
              <SuggestionCard
                key={s.key}
                s={s}
                open={openKeys.has(s.key)}
                done={done.has(s.key)}
                onToggleOpen={() => toggleOpen(s.key)}
                onToggleDone={() => toggleDone(s.key)}
                onGuide={() => setGuide(s)}
              />
            ))}
          </ul>
        </section>
      )}

      <EditGuideDialog
        s={guide}
        profileUrl={url}
        done={guide ? done.has(guide.key) : false}
        onClose={() => setGuide(null)}
        onMarkDone={(key) => { setDoneKey(key, true); toast.success("Nice. Marked as done."); }}
      />

      <ConfirmDialog
        open={rereadOpen}
        onOpenChange={setRereadOpen}
        tone="warning"
        title="Read your profile again?"
        description={`You have ${done.size} change${done.size === 1 ? "" : "s"} marked as done. Reading again builds a fresh list and clears those ticks.`}
        confirmLabel="Re-read profile"
        onConfirm={read}
      />

      <HowItWorksDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        tone="primary"
        title="How the Profile Optimizer works"
        description="Three quick steps. It takes about five minutes."
        steps={[
          { title: "Tell us your niche", text: "Say what you do and who you want to reach. We judge your profile against this." },
          { title: "Paste your profile link", text: "Any LinkedIn profile link works, with or without https://. We read what is public on it." },
          { title: "Apply each change", text: "Open a suggestion, copy the new text, and press Open on LinkedIn. We show you exactly where to paste it." },
        ]}
        note="LinkedIn does not let apps edit profiles, so the final paste is always yours."
      />
    </main>
  );
}

function SuggestionCard({
  s, open, done, onToggleOpen, onToggleDone, onGuide,
}: {
  s: ProfileSuggestion;
  open: boolean;
  done: boolean;
  onToggleOpen: () => void;
  onToggleDone: () => void;
  onGuide: () => void;
}) {
  const Icon = SECTION_ICON[s.key];
  const copy = async () => {
    if (await copyText(s.suggested)) toast.success(`${s.title} copied. Paste it into LinkedIn.`);
    else toast.error("Could not copy. Select the text and copy it manually.");
  };

  return (
    <li className={cn("rounded-xl border bg-card transition-colors", done ? "border-success/40" : "border-border", open && "shadow-sm")}>
      <div className="flex items-center gap-3 p-4 sm:px-5">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-controls={`sg-${s.key}`}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <IconTile icon={done ? CheckCircle2 : Icon} tone={done ? "success" : SECTION_TONE[s.key]} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">{s.title}</span>
            {!open && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{s.suggested.replace(/\s*\n\s*/g, " ")}</span>}
          </span>
        </button>

        {done ? (
          <Pill tone="success" className="hidden sm:inline-flex"><CheckCircle2 className="size-3" /> Done</Pill>
        ) : (
          <Pill tone="warning" className="hidden sm:inline-flex">To do</Pill>
        )}

        <Button
          variant="outline"
          size="icon"
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-controls={`sg-${s.key}`}
          aria-label={open ? `Hide ${s.title}` : `Show ${s.title}`}
          className="shrink-0"
        >
          <ChevronDown className={cn("transition-transform duration-200", open && "rotate-180")} />
        </Button>
      </div>

      {open && (
        <div id={`sg-${s.key}`} className="flex flex-col gap-4 border-t border-border p-4 sm:p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Currently on LinkedIn</p>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{s.current}</p>
            </div>
            <div className="rounded-lg border border-primary/40 bg-primary-soft p-3">
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-primary uppercase">Suggested</p>
              <p className="text-sm whitespace-pre-line text-foreground">{s.suggested}</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Why this change: </span>
            {s.why}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="lg" onClick={copy}><ClipboardCopy /> Copy suggestion</Button>
              <Button size="lg" variant="outline" onClick={onGuide}>Open on LinkedIn <ExternalLink className="size-3.5" /></Button>
            </div>
            <button
              type="button"
              role="checkbox"
              aria-checked={done}
              onClick={onToggleDone}
              className="flex cursor-pointer items-center gap-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={cn("flex size-5 items-center justify-center rounded border transition-colors", done ? "border-success bg-success text-background" : "border-input bg-transparent")}>
                {done && <Check className="size-3.5" />}
              </span>
              Mark as done
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Popup shown before leaving for LinkedIn: copies the text, then says exactly where to click and paste. */
function EditGuideDialog({
  s, profileUrl, done, onClose, onMarkDone,
}: {
  s: ProfileSuggestion | null;
  profileUrl: string;
  done: boolean;
  onClose: () => void;
  onMarkDone: (key: string) => void;
}) {
  const target = s ? editTarget(profileUrl, s.section) : null;

  const copyAndGo = async () => {
    if (!s) return;
    if (await copyText(s.suggested)) toast.success("Copied. Paste it once LinkedIn opens.");
  };

  return (
    <Dialog open={!!s} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {s && target && (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3 pr-6">
                <IconTile icon={SECTION_ICON[s.key]} tone={SECTION_TONE[s.key]} className="size-10" />
                <div className="grid gap-1.5">
                  <DialogTitle className="text-base">Update your {s.title.toLowerCase()}</DialogTitle>
                  <DialogDescription>We copy the new text for you, then open LinkedIn in a new tab.</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="max-h-40 overflow-y-auto rounded-lg border border-primary/40 bg-primary-soft p-3">
              <p className="mb-1 text-[11px] font-semibold tracking-wide text-primary uppercase">New text</p>
              <p className="text-sm whitespace-pre-line text-foreground">{s.suggested}</p>
            </div>

            <ol className="grid gap-2">
              {target.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-muted-foreground">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>

            <p className="text-xs text-muted-foreground">
              Page didn&apos;t open the right spot?{" "}
              <a href={target.profileUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">Open your profile instead</a>
              {" "}and use the pencil on that section.
            </p>

            <DialogFooter>
              {!done && <Button variant="ghost" onClick={() => { onMarkDone(s.key); onClose(); }}><Check /> Already done</Button>}
              <LinkButton href={target.url} onClick={copyAndGo}><ClipboardCopy /> Copy &amp; open LinkedIn</LinkButton>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
