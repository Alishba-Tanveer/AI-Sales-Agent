"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check, CheckCircle2, ChevronDown, ChevronsDownUp, ChevronsUpDown, ClipboardCopy, ExternalLink, FileUp, Info, Link2, Loader2, RefreshCw,
  Sparkles, Target, TriangleAlert, Undo2, UserRoundPen, Lightbulb, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CARD_INNER, HOVER_BUTTONS, Field, Pill, SectionCard, TONES, inputCls, type Tone } from "@/features/settings/components/settings-ui";
import { ApiError } from "@/lib/api";
import { can } from "@/lib/permissions";
import { useRole } from "@/lib/use-role";
import { analyzeProfile, fetchSavedAudit, importProfilePdf, setSuggestionDone } from "../api";
import { copyText, editTarget, normalizeLinkedInProfileUrl } from "../links";
import type { ProfileAnalysis, ProfileSections, ProfileSuggestion, SuggestionKey } from "../types";
import { ConfirmDialog, HowItWorksDialog, IconTile, LinkButton, PageHeader, StepStrip, fmtDate } from "./linkedin-ui";

const SECTION_ICON: Record<SuggestionKey, LucideIcon> = {
  headline: UserRoundPen, about: Info, experience: Target, skills: Check, featured: Link2,
};
// one accent per section so the list reads at a glance
const SECTION_TONE: Record<SuggestionKey, Tone> = {
  headline: "primary", about: "info", experience: "violet", skills: "warning", featured: "success",
};

const EMPTY_SECTIONS: ProfileSections = { headline: "", about: "", experience: "", skills: "" };
const MAX_PDF_BYTES = 3 * 1024 * 1024;

export function ProfileOptimizer() {
  // Same rule as the API (linkedin.routes.ts): only Owners and Admins may read a profile again or mark changes as applied.
  // useRole() is null until the stored user is read on the client, so editing controls stay hidden until the role is known.
  const role = useRole();
  const canEdit = role !== null && can.editWorkspaceSettings(role);
  const [offer, setOffer] = useState("");
  const [audience, setAudience] = useState("");
  const [url, setUrl] = useState("");
  const [sections, setSections] = useState<ProfileSections>(EMPTY_SECTIONS);
  const [loading, setLoading] = useState(true);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set()); // every suggestion starts closed
  const [profileSectionOpen, setProfileSectionOpen] = useState(true);
  const [guide, setGuide] = useState<ProfileSuggestion | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [rereadOpen, setRereadOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setSection = (key: keyof ProfileSections) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSections((prev) => ({ ...prev, [key]: e.target.value }));
  const hasText = Object.values(sections).some((v) => v.trim());

  // Pick up where the person left off: the niche, the profile text they gave us, the last list of changes and what they applied.
  useEffect(() => {
    let live = true;
    fetchSavedAudit()
      .then((saved) => {
        if (!live) return;
        setOffer(saved.offer);
        setAudience(saved.audience);
        setUrl(saved.profileUrl);
        setSections(saved.sections);
        if (saved.hasAudit) {
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

  /** LinkedIn's own "Save to PDF" file: we pull the text out of it and show it in the boxes so it can be checked. */
  const onPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be chosen again
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return void toast.error("Choose the PDF you saved from LinkedIn.");
    if (file.size > MAX_PDF_BYTES) return void toast.error("That file is larger than 3MB. A LinkedIn profile PDF is normally much smaller.");
    setImporting(true);
    try {
      const found = await importProfilePdf(file);
      setSections((prev) => ({
        headline: found.headline || prev.headline,
        about: found.about || prev.about,
        experience: found.experience || prev.experience,
        skills: found.skills || prev.skills,
      }));
      toast.success("PDF read. Check the text below, then press Get my suggestions.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not read that PDF. Paste the text instead.");
    } finally {
      setImporting(false);
    }
  };

  const read = async () => {
    if (!offer.trim() || !audience.trim()) return void toast.error("Tell us what you do and who you sell to first.");
    if (!hasText) return void toast.error("Paste at least one part of your LinkedIn profile, or upload your LinkedIn PDF.");
    let clean = "";
    if (url.trim()) {
      const normalized = normalizeLinkedInProfileUrl(url);
      if (!normalized) {
        setUrlError("That doesn’t look like a LinkedIn profile link. Try linkedin.com/in/your-name");
        return;
      }
      clean = normalized;
      setUrl(clean);
    }
    setUrlError(null);
    setReading(true);
    try {
      const result = await analyzeProfile(clean, { offer: offer.trim(), audience: audience.trim() }, sections);
      setAnalysis(result);
      setDone(new Set(result.doneKeys));
      setOpenKeys(new Set());
      toast.success("Your changes are ready.");
    } catch (e) {
      // the backend explains bad input itself; anything else gets the generic message
      toast.error(e instanceof ApiError && e.status === 400 ? e.message : "Could not make suggestions. Please try again.");
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
    setSuggestionDone(key, value)
      .then(() => {
        // Applied text is now the person's current profile text (the server keeps it too), so it is never pasted back in.
        const applied = analysis?.suggestions.find((s) => s.key === key);
        if (value && applied && key in sections) setSections((prev) => ({ ...prev, [key]: applied.suggested }));
      })
      .catch(() => {
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
    <main className={cn("mx-auto flex w-full max-w-[1280px] flex-col gap-6 p-6 lg:p-8", HOVER_BUTTONS)}>
      <PageHeader
        title="Profile Optimizer"
        description={canEdit ? "Tell us your niche, share your current LinkedIn text, and get a clear list of changes to make." : "Suggested changes for your LinkedIn profile. You can copy any of them; an Owner or Admin keeps the list up to date."}
        actions={
          <>
            <Button variant="outline" className={TONES.warning.btn} onClick={() => setHelpOpen(true)}><Lightbulb /> How it works</Button>
            {canEdit && analysis && (
              <Button variant="outline" className={TONES.info.btn} onClick={() => (done.size ? setRereadOpen(true) : read())} disabled={reading}>
                {reading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Get new suggestions
              </Button>
            )}
          </>
        }
      />

      {canEdit && (
        <>
      <StepStrip
        steps={[
          { label: "Tell us your niche", icon: Target, tone: "info" },
          { label: "Share your current profile", icon: FileUp, tone: "warning" },
          { label: "Copy, apply, mark as applied", icon: UserRoundPen, tone: "success" },
        ]}
      />

      <SectionCard icon={Target} title="Your niche" description="We write every suggestion for this audience." tone="info">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="What do you do?" htmlFor="offer">
            <Textarea id="offer" rows={2} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="e.g. I build AI agents for B2B SaaS outbound" />
          </Field>
          <Field label="Who do you want to sell to?" htmlFor="audience">
            <Textarea id="audience" rows={2} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. Heads of Sales at SaaS companies with 50–500 people" />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        icon={FileUp}
        title="Your current LinkedIn profile"
        description="LinkedIn does not let any app read a profile, so you share your text with us once. We keep it, so you never paste it twice."
        tone="warning"
        aside={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setProfileSectionOpen((open) => !open)}
            aria-expanded={profileSectionOpen}
            aria-controls="linkedin-profile-fields"
            aria-label={profileSectionOpen ? "Hide LinkedIn profile fields" : "Show LinkedIn profile fields"}
            title={profileSectionOpen ? "Hide profile fields" : "Show profile fields"}
            className="shrink-0"
          >
            <ChevronDown className={cn("transition-transform duration-200", profileSectionOpen && "rotate-180")} />
          </Button>
        }
      >
        {profileSectionOpen && <div id="linkedin-profile-fields" className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <p className="font-medium text-foreground">Fastest way: upload your LinkedIn PDF</p>
            <p className="text-muted-foreground">On LinkedIn open your profile, press More, then Save to PDF. Upload that file here and we fill the boxes for you.</p>
          </div>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" onChange={onPdf} className="sr-only" aria-label="Upload your LinkedIn PDF" />
          <Button variant="outline" className="shrink-0" onClick={() => fileRef.current?.click()} disabled={importing || loading}>
            {importing ? <Loader2 className="animate-spin" /> : <FileUp />} {importing ? "Reading PDF…" : "Upload LinkedIn PDF"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">Or paste the text yourself. Fill in what you have; even one box is enough.</p>

        <div className="grid gap-4">
          <Field label="Headline" htmlFor="cur-headline">
            <Input id="cur-headline" value={sections.headline} onChange={setSection("headline")} placeholder="The line under your name on LinkedIn" className={inputCls} />
          </Field>
          <Field label="About" htmlFor="cur-about">
            <Textarea id="cur-about" rows={5} value={sections.about} onChange={setSection("about")} placeholder="Paste your About section" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Experience (your latest roles)" htmlFor="cur-exp">
              <Textarea id="cur-exp" rows={5} value={sections.experience} onChange={setSection("experience")} placeholder="Paste your role descriptions" />
            </Field>
            <Field label="Skills" htmlFor="cur-skills">
              <Textarea id="cur-skills" rows={5} value={sections.skills} onChange={setSection("skills")} placeholder="Separate with commas" />
            </Field>
          </div>
        </div>

        <div className="border-t border-border pt-5">
          <Field label="Your LinkedIn profile link (optional)" htmlFor="profile-url">
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
                aria-invalid={!!urlError}
                placeholder="linkedin.com/in/your-name"
                className={cn(inputCls, "flex-1")}
              />
              <Button onClick={read} disabled={reading || loading} className="h-10 sm:w-auto">
                {reading ? <Loader2 className="animate-spin" /> : <Sparkles />} {reading ? "Working…" : "Get my suggestions"}
              </Button>
            </div>
            {urlError ? (
              <p className="text-xs text-destructive">{urlError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Only used to open the right LinkedIn page for you. We never read anything from LinkedIn.</p>
            )}
          </Field>
        </div>
        </div>}
      </SectionCard>
        </>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 p-10 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" /> Loading your saved profile text…
        </div>
      ) : !analysis ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <p className="text-sm font-medium text-foreground">Your list of changes will appear here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canEdit ? "Add your niche and your current profile text above, then press “Get my suggestions”." : "An Owner or Admin hasn’t reviewed the profile yet. Suggestions will show up here once they have."}
          </p>
        </div>
      ) : (
        <section className="flex flex-col gap-4" aria-live="polite">
          <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm text-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>
              {canEdit
                ? "LinkedIn doesn't allow apps to edit your profile. Copy each suggestion, paste it into LinkedIn, then press Mark as applied so we remember it."
                : "LinkedIn doesn't allow apps to edit a profile. Copy a suggestion and paste it into LinkedIn yourself. Only Owners and Admins can mark changes as applied."}
            </p>
          </div>
          {analysis.notice && (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground" role="status">
              <Info className="mt-0.5 size-4 shrink-0 text-info" />
              <p>{analysis.notice}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-foreground">Changes to make</h2>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setOpenKeys(allOpen ? new Set() : new Set(analysis.suggestions.map((s) => s.key)))}>
                {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />} {allOpen ? "Close all" : "Open all"}
              </Button>
              <span className="text-sm text-muted-foreground">{done.size} of {total} applied</span>
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
                canEdit={canEdit}
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
        onMarkDone={(key) => { setDoneKey(key, true); toast.success("Nice. Marked as applied."); }}
        canEdit={canEdit}
      />

      <ConfirmDialog
        open={rereadOpen}
        onOpenChange={setRereadOpen}
        tone="warning"
        title="Get new suggestions?"
        description={`You have ${done.size} change${done.size === 1 ? "" : "s"} marked as applied. New suggestions start from the text in the boxes above (your applied changes are already in there) and clear those ticks.`}
        confirmLabel="Get new suggestions"
        onConfirm={read}
      />

      <HowItWorksDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        tone="primary"
        title="How the Profile Optimizer works"
        description="Three quick steps. Your text is saved after the first time."
        steps={[
          { title: "Tell us your niche", text: "Say what you do and who you want to reach. Every suggestion is written for them." },
          { title: "Share your current profile", text: "Upload the PDF from LinkedIn’s Save to PDF, or paste your headline, About, experience and skills. Even one part is enough." },
          { title: "Copy, apply, mark as applied", text: "Open a suggestion, press Copy, then Open LinkedIn to paste it. Press Mark as applied and we remember it as your current text, so you never paste it back." },
        ]}
        note="LinkedIn does not let apps read or edit profiles, and tools that scrape LinkedIn can get your account banned. So the copy and paste is always yours."
      />
    </main>
  );
}

function SuggestionCard({
  s, open, done, onToggleOpen, onToggleDone, onGuide, canEdit,
}: {
  s: ProfileSuggestion;
  open: boolean;
  done: boolean;
  onToggleOpen: () => void;
  onToggleDone: () => void;
  onGuide: () => void;
  canEdit: boolean;
}) {
  const Icon = SECTION_ICON[s.key];
  const copy = async () => {
    if (await copyText(s.suggested)) toast.success(`${s.title} copied. Paste it into LinkedIn.`);
    else toast.error("Could not copy. Select the text and copy it manually.");
  };

  return (
    <li className={cn("rounded-xl border bg-card transition-all duration-200 hover:shadow-lg hover:shadow-primary/5", done ? "border-success/40 hover:border-success/60" : "border-border hover:border-primary/30", open && "shadow-sm")}>
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
            {!open && <span className="mt-0.5 block [overflow-wrap:anywhere] text-xs text-muted-foreground">{s.suggested.replace(/\s*\n\s*/g, " ")}</span>}
          </span>
        </button>

        {done ? (
          <Pill tone="success" className="hidden sm:inline-flex"><CheckCircle2 className="size-3" /> Applied</Pill>
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
            <div className={cn("rounded-lg border border-border bg-background p-3", CARD_INNER)}>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Currently on LinkedIn</p>
              {s.current ? (
                <p className="text-sm whitespace-pre-line text-muted-foreground">{s.current}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">You didn’t share this part, so there is nothing to compare. The suggestion is built from your niche.</p>
              )}
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

          {/\[[^\]]+\]/.test(s.suggested) && (
            <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-xs text-foreground">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
              Replace anything in [square brackets] with your own details before you paste it. We only know what you told us.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="lg" onClick={copy}><ClipboardCopy /> Copy suggestion</Button>
              <Button size="lg" variant="outline" onClick={onGuide}>Open on LinkedIn <ExternalLink className="size-3.5" /></Button>
            </div>
            {canEdit && (done ? (
              <Button size="lg" variant="ghost" onClick={onToggleDone}><Undo2 /> Applied. Undo</Button>
            ) : (
              <Button size="lg" variant="outline" className={TONES.success.btn} onClick={onToggleDone}><CheckCircle2 /> Mark as applied</Button>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

/** Popup shown before leaving for LinkedIn: copies the text, then says exactly where to click and paste. */
function EditGuideDialog({
  s, profileUrl, done, onClose, onMarkDone, canEdit,
}: {
  s: ProfileSuggestion | null;
  profileUrl: string;
  done: boolean;
  onClose: () => void;
  onMarkDone: (key: string) => void;
  canEdit: boolean;
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
              {canEdit && !done && <Button variant="ghost" onClick={() => { onMarkDone(s.key); onClose(); }}><Check /> Mark as applied</Button>}
              <LinkButton href={target.url} onClick={copyAndGo}><ClipboardCopy /> Copy &amp; open LinkedIn</LinkButton>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
