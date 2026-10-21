"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck, CalendarClock, CheckCircle2, Clock, ClipboardCopy, ExternalLink, FileText, Lightbulb, Loader2, Newspaper, Pencil, Plus,
  RefreshCw, Send, Sparkles, Trash2, Video, X, Play, Settings2, Link2, TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Pill, inputCls } from "@/features/settings/components/settings-ui";
import { checkPostStatus, fetchScripts } from "../api";
import { ACTIVITY_URL, composeUrl, copyText, normalizeWebUrl, scriptCaption } from "../links";
import type { ContentScript } from "../types";
import { ConfirmDialog, HowItWorksDialog, IconTile, LinkButton, PageHeader, StepStrip, TabBar, fmtDate, fmtTime } from "./linkedin-ui";

type TabId = "approval" | "scheduled" | "posted";
type Confirm = { kind: "dismiss" | "cancel" | "remove"; s: ContentScript } | null;

export function ContentEngine() {
  const [scripts, setScripts] = useState<ContentScript[] | null>(null);
  const [tab, setTab] = useState<TabId>("approval");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [topicOpen, setTopicOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [previewing, setPreviewing] = useState<ContentScript | null>(null);
  const [posting, setPosting] = useState<ContentScript | null>(null);
  const [linking, setLinking] = useState<ContentScript | null>(null);
  const [remindAt, setRemindAt] = useState("08:30");
  const [avatar, setAvatar] = useState("Ahmed Avatar v2");

  useEffect(() => {
    let live = true;
    fetchScripts().then((s) => {
      if (!live) return;
      setScripts(s);
      setSelectedId(s.find((x) => x.status === "needs_approval")?.id ?? null);
    });
    return () => {
      live = false;
    };
  }, []);

  const list = scripts ?? [];
  const pending = list.filter((s) => s.status === "needs_approval");
  const scheduled = list.filter((s) => s.status === "creating_video" || s.status === "ready");
  const posted = list.filter((s) => s.status === "posted");

  const update = (id: string, patch: Partial<ContentScript>) => setScripts((cur) => (cur ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const remove = (id: string) => setScripts((cur) => (cur ?? []).filter((s) => s.id !== id));
  const nextPending = (excludeId: string) => pending.find((s) => s.id !== excludeId)?.id ?? null;

  const approve = (s: ContentScript) => {
    update(s.id, { status: "creating_video", scheduledFor: `2026-10-22T${remindAt}:00` });
    setSelectedId(nextPending(s.id));
    toast.success(`Approved. Your avatar video is being made. We will remind you to post at ${fmtTime(remindAt)}.`);
  };
  const dismiss = (s: ContentScript) => {
    remove(s.id);
    setSelectedId(nextPending(s.id));
    toast("Script dismissed");
  };
  const regenerate = (s: ContentScript) => {
    update(s.id, { draftNo: s.draftNo + 1, hook: "Here is a fresh angle: " + s.hook });
    toast.success("New draft written");
  };
  const addTopic = (topic: string) => {
    const id = `t${Date.now()}`;
    const draft: ContentScript = {
      id, status: "needs_approval", draftNo: 1, source: "Your topic", sourceUrl: "", date: new Date().toISOString().slice(0, 10),
      title: topic, hook: `Here is what most people get wrong about ${topic.toLowerCase()}.`,
      points: ["The key fact your audience should know.", "One example from your own work.", "What to do about it this week."],
      cta: "Follow me for a new tip every day.", seconds: 40, words: 100,
    };
    setScripts((cur) => [draft, ...(cur ?? [])]);
    setTab("approval");
    setSelectedId(id);
    toast.success("Topic added. A script draft is ready for you to review.");
  };
  const markPosted = (s: ContentScript, postUrl?: string) => {
    update(s.id, { status: "posted", postedAt: new Date().toISOString().slice(0, 19), postUrl });
    setPosting(null);
    setTab("posted");
    toast.success("Nice. Marked as posted.");
  };

  const selected = pending.find((s) => s.id === selectedId) ?? null;

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
          <span className="flex items-center gap-1.5"><Clock className="size-4 text-sky-700 dark:text-sky-400" /> Post reminder daily at <b className="font-semibold text-foreground">{fmtTime(remindAt)}</b></span>
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-success" /> Avatar: HeyGen connected <span className="text-foreground">({avatar})</span></span>
        </p>
        <Button variant="ghost" size="sm" onClick={() => setAvatarOpen(true)}><Settings2 /> Change</Button>
      </div>

      <PageHeader
        title="Content Engine"
        description="We find news in your niche, write a short video script, and make the video after you approve. You post it on LinkedIn."
        actions={
          <>
            <Button variant="outline" onClick={() => setHelpOpen(true)}><Lightbulb /> How it works</Button>
            <Button onClick={() => setTopicOpen(true)}><Plus /> Add a topic</Button>
          </>
        }
      />

      <StepStrip
        steps={[
          { label: "News found", count: 8, icon: Newspaper, tone: "info" },
          { label: "Scripts written", count: pending.length + scheduled.length + posted.length, icon: FileText, tone: "violet" },
          { label: "You approve", count: pending.length, icon: BadgeCheck, tone: "warning" },
          { label: "Video created", count: scheduled.length, icon: Video, tone: "primary" },
          { label: "Posted", count: posted.length, icon: Send, tone: "success" },
        ]}
      />

      <TabBar
        label="Content stages"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "approval", label: "Needs approval", count: pending.length },
          { id: "scheduled", label: "Scheduled", count: scheduled.length },
          { id: "posted", label: "Posted", count: posted.length },
        ]}
      />

      {scripts === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading scripts…</div>
      ) : tab === "approval" ? (
        pending.length === 0 ? (
          <Empty title="Nothing to approve" text="New scripts appear here every morning." />
        ) : (
          /* Two equal columns, same height: queue on the left, review on the right */
          <div className="grid items-stretch gap-6 lg:grid-cols-2">
            <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
              <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold text-foreground">Scripts waiting for you</h2>
                <Pill tone="warning">{pending.length} to review</Pill>
              </header>
              <ul className="flex flex-1 flex-col gap-2 p-3">
                {pending.map((s) => {
                  const active = s.id === selectedId;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(s.id)}
                        aria-pressed={active}
                        className={cn(
                          "flex w-full cursor-pointer flex-col gap-1.5 rounded-lg border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active ? "border-primary bg-primary-soft" : "border-border bg-background hover:border-primary/40",
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{s.source}</span>
                          <span>{fmtDate(s.date)}</span>
                          <span>{s.seconds}s · {s.words} words</span>
                        </span>
                        <span className="text-sm font-semibold text-foreground">{s.title}</span>
                        <span className="line-clamp-2 text-xs text-muted-foreground">{s.hook}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <footer className="mt-auto flex items-center gap-2 border-t border-border bg-secondary/30 px-5 py-3 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 shrink-0 text-primary" /> New scripts are written every morning from fresh news in your niche.
              </footer>
            </section>

            {selected ? (
              <ReviewPanel key={selected.id} s={selected} onApprove={approve} onDismiss={(s) => setConfirm({ kind: "dismiss", s })} onRegenerate={regenerate} onSave={(patch) => update(selected.id, patch)} />
            ) : (
              <Empty title="Select a script" text="Pick a script on the left to review it." className="flex flex-col justify-center" />
            )}
          </div>
        )
      ) : tab === "scheduled" ? (
        scheduled.length === 0 ? (
          <Empty title="Nothing scheduled" text="Approved scripts show up here while the video is made." />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {scheduled.map((s) => {
              const ready = s.status === "ready";
              return (
                <li key={s.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-2">
                    {ready ? <Pill tone="success"><CheckCircle2 className="size-3" /> Ready to post</Pill> : <Pill tone="primary"><Loader2 className="size-3 animate-spin" /> Creating video</Pill>}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3.5" /> Remind me {fmtDate(s.scheduledFor, true)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{s.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.hook}</p>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-4">
                    <Button size="lg" disabled={!ready} onClick={() => setPosting(s)}><Send /> {ready ? "Post on LinkedIn" : "Waiting for video"}</Button>
                    <Button variant="outline" size="lg" disabled={!ready} onClick={() => setPreviewing(s)}><Play /> Preview</Button>
                    <Button variant="ghost" size="lg" className="ml-auto" onClick={() => setConfirm({ kind: "cancel", s })}>Cancel</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : posted.length === 0 ? (
        <Empty title="Nothing posted yet" text="Posts you mark as posted will be listed here." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {posted.map((s) => (
            <PostedCard key={s.id} s={s} onFlagDeleted={() => update(s.id, { postDeleted: true })} onAddLink={() => setLinking(s)} onRemove={() => setConfirm({ kind: "remove", s })} />
          ))}
        </ul>
      )}

      <TopicDialog open={topicOpen} onOpenChange={setTopicOpen} onAdd={addTopic} />
      <AvatarDialog open={avatarOpen} onOpenChange={setAvatarOpen} time={remindAt} avatar={avatar} onSave={(t, a) => { setRemindAt(t); setAvatar(a); toast.success("Posting settings saved"); }} />
      <PostGuideDialog s={posting} onClose={() => setPosting(null)} onPosted={markPosted} />
      <PreviewDialog s={previewing} onClose={() => setPreviewing(null)} onPost={(s) => { setPreviewing(null); setPosting(s); }} />

      <PostLinkDialog s={linking} onClose={() => setLinking(null)} onSave={(s, url) => { update(s.id, { postUrl: url, postDeleted: false }); setLinking(null); toast.success("Post link saved"); }} />
      <ConfirmDialog
        open={confirm?.kind === "remove"}
        onOpenChange={(o) => !o && setConfirm(null)}
        tone="destructive"
        icon={Trash2}
        title="Remove from your Posted list?"
        description={confirm ? `“${confirm.s.title}” is only removed from this list. Nothing changes on LinkedIn.` : ""}
        confirmLabel="Remove"
        onConfirm={() => { if (confirm) { remove(confirm.s.id); toast("Removed from list"); } }}
      />
      <ConfirmDialog
        open={confirm?.kind === "dismiss"}
        onOpenChange={(o) => !o && setConfirm(null)}
        tone="destructive"
        icon={Trash2}
        title="Dismiss this script?"
        description={confirm ? `“${confirm.s.title}” will be removed from your list. You can always add the topic again.` : ""}
        confirmLabel="Dismiss script"
        onConfirm={() => confirm && dismiss(confirm.s)}
      />
      <ConfirmDialog
        open={confirm?.kind === "cancel"}
        onOpenChange={(o) => !o && setConfirm(null)}
        tone="destructive"
        icon={X}
        title="Cancel this post?"
        description={confirm ? `“${confirm.s.title}” will be removed from your schedule and its video will be discarded.` : ""}
        confirmLabel="Cancel post"
        cancelLabel="Keep it"
        onConfirm={() => { if (confirm) { remove(confirm.s.id); toast("Post cancelled"); } }}
      />

      <HowItWorksDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        tone="primary"
        title="How the Content Engine works"
        description="From news to a finished video in five steps."
        steps={[
          { title: "We find news", text: "Every day we look for stories in your niche from sources like TechCrunch, Reuters and Forbes." },
          { title: "We write a short script", text: "Each script has a hook, three main points and a call to action, about 40 seconds long." },
          { title: "You approve", text: "Edit the words, ask for a new draft, or dismiss it. Nothing moves forward without your yes." },
          { title: "Your avatar video is made", text: "After you approve, HeyGen creates the video with your avatar." },
          { title: "You post it on LinkedIn", text: "At your reminder time, press Post on LinkedIn. We copy the caption and open LinkedIn's post box for you." },
        ]}
        note="LinkedIn does not let apps publish posts for you, so the last step is a quick paste and Post on your side."
      />
    </main>
  );
}

function Empty({ title, text, className }: { title: string; text: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-dashed border-border bg-card/50 p-10 text-center", className)}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function ReviewPanel({
  s, onApprove, onDismiss, onRegenerate, onSave,
}: {
  s: ContentScript;
  onApprove: (s: ContentScript) => void;
  onDismiss: (s: ContentScript) => void;
  onRegenerate: (s: ContentScript) => void;
  onSave: (patch: Partial<ContentScript>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [hook, setHook] = useState(s.hook);
  const [points, setPoints] = useState(s.points.join("\n"));
  const [cta, setCta] = useState(s.cta);

  const save = () => {
    const pts = points.split("\n").map((p) => p.trim()).filter(Boolean);
    const words = [hook, ...pts, cta].join(" ").split(/\s+/).filter(Boolean).length;
    onSave({ hook: hook.trim(), points: pts, cta: cta.trim(), words, seconds: Math.max(10, Math.round(words / 2.5)) });
    setEditing(false);
    toast.success("Script updated");
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-primary uppercase">Review script · Draft #{s.draftNo}</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">{s.title}</h2>
          {s.sourceUrl && (
            <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              Source: {s.source} <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </header>

      {editing ? (
        <div className="flex flex-col gap-3">
          <Field label="Hook (first line)" htmlFor="hook"><Textarea id="hook" rows={2} value={hook} onChange={(e) => setHook(e.target.value)} /></Field>
          <Field label="Main points (one per line)" htmlFor="points"><Textarea id="points" rows={4} value={points} onChange={(e) => setPoints(e.target.value)} /></Field>
          <Field label="Call to action" htmlFor="cta"><Textarea id="cta" rows={2} value={cta} onChange={(e) => setCta(e.target.value)} /></Field>
          <div className="flex gap-2">
            <Button onClick={save}>Save changes</Button>
            <Button variant="ghost" onClick={() => { setHook(s.hook); setPoints(s.points.join("\n")); setCta(s.cta); setEditing(false); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Block label="Hook" tone="border-primary/40 bg-primary-soft"><p className="text-sm text-foreground">{s.hook}</p></Block>
          <Block label="Main points" tone="border-border bg-background">
            <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">{s.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </Block>
          <Block label="Call to action" tone="border-success/40 bg-success-soft"><p className="text-sm text-foreground">{s.cta}</p></Block>
        </div>
      )}

      <p className="text-xs text-muted-foreground">About {s.seconds} seconds · {s.words} words</p>

      <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
        <Button size="lg" className="h-10 bg-success text-background hover:bg-success/85" onClick={() => onApprove(s)} disabled={editing}>
          <Video /> Approve &amp; create video
        </Button>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="lg" onClick={() => setEditing((e) => !e)}><Pencil /> Edit</Button>
          <Button variant="outline" size="lg" onClick={() => onRegenerate(s)} disabled={editing}><RefreshCw /> Redo</Button>
          <Button variant="ghost" size="lg" onClick={() => onDismiss(s)}><X /> Dismiss</Button>
        </div>
      </div>
    </section>
  );
}

function Block({ label, tone, children }: { label: string; tone: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg border p-3", tone)}>
      <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      {children}
    </div>
  );
}

function TopicDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (t: string) => void }) {
  const [topic, setTopic] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim().length < 3) return void toast.error("Enter a topic of at least 3 characters.");
    onAdd(topic.trim());
    setTopic("");
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> Add a topic</DialogTitle>
            <DialogDescription>Tell us something you want to post about. We will write a short script for you to review.</DialogDescription>
          </DialogHeader>
          <Field label="Topic" htmlFor="topic">
            <Input id="topic" autoFocus value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Why follow-ups win deals" className="h-10" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Write script</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AvatarDialog({ open, onOpenChange, time, avatar, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; time: string; avatar: string; onSave: (t: string, a: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">{open && <AvatarForm time={time} avatar={avatar} onCancel={() => onOpenChange(false)} onSave={(t, a) => { onSave(t, a); onOpenChange(false); }} />}</DialogContent>
    </Dialog>
  );
}

function AvatarForm({ time, avatar, onCancel, onSave }: { time: string; avatar: string; onCancel: () => void; onSave: (t: string, a: string) => void }) {
  const [t, setT] = useState(time);
  const [a, setA] = useState(avatar);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!t) return void toast.error("Pick a reminder time.");
    if (!a.trim()) return void toast.error("Enter an avatar name.");
    onSave(t, a.trim());
  };
  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <div className="flex items-start gap-3 pr-6">
          <IconTile icon={Settings2} tone="violet" className="size-10" />
          <div className="grid gap-1.5">
            <DialogTitle className="text-base">Posting &amp; avatar settings</DialogTitle>
            <DialogDescription>Choose when we remind you to post and which avatar reads your scripts.</DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <Field label="Remind me to post at" htmlFor="remind"><Input id="remind" type="time" value={t} onChange={(e) => setT(e.target.value)} className={inputCls} /></Field>
      <Field label="Avatar" htmlFor="avatar" aside={<Pill tone="success"><span className="size-1.5 rounded-full bg-success" /> HeyGen connected</Pill>}>
        <Input id="avatar" value={a} onChange={(e) => setA(e.target.value)} className={inputCls} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save settings</Button>
      </DialogFooter>
    </form>
  );
}

function PreviewDialog({ s, onClose, onPost }: { s: ContentScript | null; onClose: () => void; onPost: (s: ContentScript) => void }) {
  return (
    <Dialog open={!!s} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {s && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6 text-base">{s.title}</DialogTitle>
              <DialogDescription>About {s.seconds} seconds · made with your avatar</DialogDescription>
            </DialogHeader>
            <div className="mx-auto flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-border bg-background text-center">
              <span className="flex size-12 items-center justify-center rounded-full border border-primary/30 bg-primary-soft text-primary"><Play className="size-5" /></span>
              <p className="px-6 text-xs text-muted-foreground">The video will play here once videos come from HeyGen.</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Caption</p>
              <p className="text-sm whitespace-pre-line text-foreground">{scriptCaption(s)}</p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Close</Button>
              <Button onClick={() => onPost(s)}><Send /> Post on LinkedIn</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** LinkedIn can't be posted to by apps. This popup copies the caption and opens LinkedIn's own "Start a post" box. */
function PostGuideDialog({ s, onClose, onPosted }: { s: ContentScript | null; onClose: () => void; onPosted: (s: ContentScript, url?: string) => void }) {
  return (
    <Dialog open={!!s} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">{s && <PostGuideBody key={s.id} s={s} onClose={onClose} onPosted={onPosted} />}</DialogContent>
    </Dialog>
  );
}

function PostGuideBody({ s, onClose, onPosted }: { s: ContentScript; onClose: () => void; onPosted: (s: ContentScript, url?: string) => void }) {
  const caption = scriptCaption(s);
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const copyAndOpen = async () => {
    if (await copyText(caption)) toast.success("Caption copied. Paste it into LinkedIn's post box.");
  };
  const finish = () => {
    if (!url.trim()) return onPosted(s);
    const clean = normalizeWebUrl(url);
    if (!clean) return void setErr("That doesn’t look like a link. Try linkedin.com/posts/…");
    onPosted(s, clean);
  };

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <div className="flex items-start gap-3 pr-6">
          <IconTile icon={Send} tone="info" className="size-10" />
          <div className="grid gap-1.5">
            <DialogTitle className="text-base">Post on LinkedIn</DialogTitle>
            <DialogDescription>LinkedIn only lets you publish yourself. It takes under a minute.</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <ol className="grid gap-2">
        {[
          "Press the button below. We copy your caption and open LinkedIn’s post box in a new tab.",
          "Add your avatar video with the media button, then paste the caption if it is not already filled in.",
          "Press Post on LinkedIn, then come back here and press “I’ve posted it”.",
        ].map((t, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-foreground">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-muted-foreground">{i + 1}</span>
            {t}
          </li>
        ))}
      </ol>

      <div className="max-h-36 overflow-y-auto rounded-lg border border-border bg-background p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Caption</p>
          <button type="button" onClick={async () => (await copyText(caption)) ? toast.success("Caption copied") : toast.error("Could not copy")} className="flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline">
            <ClipboardCopy className="size-3" /> Copy
          </button>
        </div>
        <p className="text-sm whitespace-pre-line text-foreground">{caption}</p>
      </div>

      <LinkButton href={composeUrl(caption)} onClick={copyAndOpen} className="h-10 w-full">
        <ExternalLink /> Copy caption &amp; open LinkedIn
      </LinkButton>

      <Field label="Link to your post (optional)" htmlFor="post-url">
        <Input id="post-url" type="text" inputMode="url" autoCapitalize="none" spellCheck={false} value={url} onChange={(e) => { setUrl(e.target.value); setErr(null); }} aria-invalid={!!err} placeholder="linkedin.com/posts/your-post" className={inputCls} />
        {err ? <p className="text-xs text-destructive">{err}</p> : <p className="text-xs text-muted-foreground">Paste it to keep a direct link in your Posted list.</p>}
      </Field>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Not yet</Button>
        <Button className="bg-success text-background hover:bg-success/85" onClick={finish}><CheckCircle2 /> I&apos;ve posted it</Button>
      </DialogFooter>
    </div>
  );
}

/** One published post. "View on LinkedIn" checks the post first: live -> opens it, removed -> explains instead of a dead page. */
function PostedCard({ s, onFlagDeleted, onAddLink, onRemove }: { s: ContentScript; onFlagDeleted: () => void; onAddLink: () => void; onRemove: () => void }) {
  const [checking, setChecking] = useState(false);
  const [gone, setGone] = useState(false);

  const view = async () => {
    if (s.postDeleted) return setGone(true);
    // Open the tab now (inside the click) so pop-up blockers allow it, then point it at the right page.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    const go = (url: string) => (tab ? (tab.location.href = url) : window.open(url, "_blank", "noopener,noreferrer"));
    setChecking(true);
    try {
      const status = await checkPostStatus(s.postUrl);
      if (status === "deleted") {
        tab?.close();
        onFlagDeleted();
        setGone(true);
        return;
      }
      // We have the post link: go straight to that post. Otherwise land on your Posts activity list.
      go(s.postUrl ?? ACTIVITY_URL);
    } catch {
      go(s.postUrl ?? ACTIVITY_URL);
    } finally {
      setChecking(false);
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        {s.postDeleted ? <Pill tone="destructive"><TriangleAlert className="size-3" /> Deleted on LinkedIn</Pill> : <Pill tone="success"><span className="size-1.5 rounded-full bg-success" /> Live</Pill>}
        <span className="text-xs text-muted-foreground">{fmtDate(s.postedAt, true)}</span>
      </div>
      <p className={cn("text-sm font-semibold text-foreground", s.postDeleted && "text-muted-foreground line-through")}>{s.title}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button size="sm" variant="outline" onClick={view} disabled={checking}>
          {checking ? <Loader2 className="animate-spin" /> : <ExternalLink />} {checking ? "Checking…" : s.postUrl ? "View post on LinkedIn" : "View in LinkedIn activity"}
        </Button>
        {s.postUrl ? (
          <a href={ACTIVITY_URL} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">All activity</a>
        ) : (
          <button type="button" onClick={onAddLink} className="flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline"><Link2 className="size-3" /> Add post link to open it directly</button>
        )}
      </div>

      <DeletedPostDialog open={gone} onOpenChange={setGone} title={s.title} onRemove={onRemove} />
    </li>
  );
}

function DeletedPostDialog({ open, onOpenChange, title, onRemove }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; onRemove: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3 pr-6">
            <IconTile icon={TriangleAlert} tone="destructive" className="size-10" />
            <div className="grid gap-1.5">
              <DialogTitle className="text-base">This post was deleted</DialogTitle>
              <DialogDescription>“{title}” is no longer on LinkedIn. It may have been removed by you or by LinkedIn, so there is nothing to open.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <p className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
          We keep it here marked as deleted so your history stays complete. You can remove it from the list, or post the video again from Scheduled.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onOpenChange(false); onRemove(); }}><Trash2 /> Remove from list</Button>
          <LinkButton size="default" variant="outline" href={ACTIVITY_URL}><ExternalLink /> Open my activity</LinkButton>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostLinkDialog({ s, onClose, onSave }: { s: ContentScript | null; onClose: () => void; onSave: (s: ContentScript, url: string) => void }) {
  return (
    <Dialog open={!!s} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">{s && <PostLinkForm key={s.id} s={s} onClose={onClose} onSave={onSave} />}</DialogContent>
    </Dialog>
  );
}

function PostLinkForm({ s, onClose, onSave }: { s: ContentScript; onClose: () => void; onSave: (s: ContentScript, url: string) => void }) {
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeWebUrl(url);
    if (!clean) return void setErr("That doesn’t look like a link. Try linkedin.com/posts/…");
    onSave(s, clean);
  };
  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <div className="flex items-start gap-3 pr-6">
          <IconTile icon={Link2} tone="primary" className="size-10" />
          <div className="grid gap-1.5">
            <DialogTitle className="text-base">Add the link to your post</DialogTitle>
            <DialogDescription>On LinkedIn, press the ••• on your post and choose Copy link to post. Then paste it here.</DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <Field label="Post link" htmlFor="pl-url">
        <Input id="pl-url" autoFocus type="text" inputMode="url" autoCapitalize="none" spellCheck={false} value={url} onChange={(e) => { setUrl(e.target.value); setErr(null); }} aria-invalid={!!err} placeholder="linkedin.com/posts/your-post" className={inputCls} />
        {err && <p className="text-xs text-destructive">{err}</p>}
      </Field>
      <DialogFooter>
        <LinkButton size="default" variant="ghost" href={ACTIVITY_URL}><ExternalLink /> Open my activity</LinkButton>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit">Save link</Button>
      </DialogFooter>
    </form>
  );
}
