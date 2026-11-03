"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BellOff,
  CheckCheck,
  Info,
  ListChecks,
  MailOpen,
  Mail,
  MessagesSquare,
  Settings,
  Trash2,
  TriangleAlert,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNow } from "@/lib/use-now";
import { groupByDay, relativeTime } from "../format";
import { notificationActions, useNotifications } from "../store";
import type { AppNotification, NotificationType } from "../types";

const ICONS: Record<NotificationType, LucideIcon> = {
  reply: MessagesSquare,
  approval: ListChecks,
  failure: TriangleAlert,
  lead: UserPlus,
  team: Users,
  system: Info,
};

/**
 * One colour per kind of notification, taken from the page it opens, so the same colour always means the same place:
 * Leads page = blue, a lead's own page = green, Inbox = violet, Activity = amber, LinkedIn = pink,
 * Settings / team = sky, Overview = teal. Failures are always red. (Full class names so Tailwind can see them.)
 */
type Tone = { tile: string; dot: string; unread: string };
const TONES = {
  blue: { tile: "border-primary/30 bg-primary-soft text-primary", dot: "bg-primary", unread: "bg-primary-soft/40" },
  green: { tile: "border-success/30 bg-success-soft text-success", dot: "bg-success", unread: "bg-success-soft/40" },
  violet: { tile: "border-violet/30 bg-violet-soft text-violet", dot: "bg-violet", unread: "bg-violet-soft/40" },
  amber: { tile: "border-warning/30 bg-warning-soft text-warning", dot: "bg-warning", unread: "bg-warning-soft/40" },
  pink: { tile: "border-pink/30 bg-pink-soft text-pink", dot: "bg-pink", unread: "bg-pink-soft/40" },
  sky: { tile: "border-info/30 bg-info-soft text-info", dot: "bg-info", unread: "bg-info-soft/40" },
  teal: { tile: "border-teal/30 bg-teal-soft text-teal", dot: "bg-teal", unread: "bg-teal-soft/40" },
  red: { tile: "border-destructive/30 bg-destructive-soft text-destructive", dot: "bg-destructive", unread: "bg-destructive-soft/40" },
  grey: { tile: "border-border bg-secondary text-muted-foreground", dot: "bg-muted-foreground", unread: "bg-secondary/60" },
} satisfies Record<string, Tone>;

const TYPE_FALLBACK: Record<NotificationType, Tone> = {
  reply: TONES.violet,
  approval: TONES.amber,
  failure: TONES.red,
  lead: TONES.green,
  team: TONES.sky,
  system: TONES.grey,
};

function toneFor(n: AppNotification): Tone {
  if (n.type === "failure") return TONES.red;
  const path = (n.href ?? "").split(/[?#]/)[0];
  if (/^\/leads\/[^/]+/.test(path)) return TONES.green; // a lead's own page
  if (path === "/leads") return TONES.blue; // the Leads list
  if (path.startsWith("/inbox")) return TONES.violet;
  if (path.startsWith("/activity")) return TONES.amber;
  if (path.startsWith("/linkedin")) return TONES.pink;
  if (path.startsWith("/settings")) return TONES.sky;
  if (path.startsWith("/overview")) return TONES.teal;
  if (path.startsWith("/find-opportunities")) return TONES.amber;
  return TYPE_FALLBACK[n.type];
}

type Filter = "all" | "unread";

/** The slide-over opened by the bell in the top bar. */
export function NotificationsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <Panel onClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function Panel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const now = useNow();
  const { items, unread } = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");

  const shown = filter === "unread" ? items.filter((n) => !n.read) : items;
  // `now` is 0 for the first instant after opening; the list appears as soon as the clock is read
  const ready = now > 0;
  const groups = ready ? groupByDay(shown, now) : [];

  const open = (n: AppNotification) => {
    notificationActions.markRead(n.id);
    if (n.href) {
      onClose();
      router.push(n.href);
    }
  };

  return (
    <>
      <SheetHeader className="gap-3 border-b border-border px-5 pt-5 pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <SheetTitle className="flex items-center gap-2 text-lg">
              Notifications
              {unread > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground tabular-nums">{unread} new</span>
              )}
            </SheetTitle>
            <SheetDescription>Replies, new leads and anything that needs you.</SheetDescription>
          </div>
          <SheetClose
            aria-label="Close notifications"
            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-[18px]" />
          </SheetClose>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div role="tablist" aria-label="Filter notifications" className="flex h-10 items-center gap-1">
            {(["all", "unread"] as const).map((f) => {
              const active = filter === f;
              const count = f === "all" ? items.length : unread;
              return (
                <button
                  key={f}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "-mb-px flex h-full cursor-pointer items-center border-b-2 px-3 text-sm font-medium capitalize outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                    active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f} <span className="ml-1 tabular-nums">({count})</span>
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="mb-1 gap-1.5 text-xs text-muted-foreground hover:text-primary" disabled={unread === 0} onClick={notificationActions.markAllRead}>
            <CheckCheck className="size-3.5" />
            Mark all as read
          </Button>
        </div>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {!ready ? null : groups.length === 0 ? (
          <Empty filter={filter} />
        ) : (
          groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h3 className="sticky top-0 z-10 border-b border-border bg-popover/95 px-5 py-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase backdrop-blur">
                {g.label}
              </h3>
              <ul className="divide-y divide-border">
                {g.items.map((n) => (
                  <Item key={n.id} n={n} now={now} onOpen={open} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
        <Link
          href="/settings?tab=notifications"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Settings className="size-3.5" />
          Notification settings
        </Link>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive" disabled={items.length === 0} onClick={notificationActions.clearAll}>
          <Trash2 className="size-3.5" />
          Clear all
        </Button>
      </div>
    </>
  );
}

function Item({ n, now, onOpen }: { n: AppNotification; now: number; onOpen: (n: AppNotification) => void }) {
  const Icon = ICONS[n.type];
  const tone = toneFor(n);
  return (
    <li className={cn("group relative transition-colors hover:bg-muted/60", !n.read && tone.unread)}>
      <button type="button" onClick={() => onOpen(n)} className="flex w-full cursor-pointer items-start gap-3 px-5 py-3.5 pr-14 text-left outline-none focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset">
        <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border", tone.tile)}>
          <Icon className="size-[18px]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className={cn("[overflow-wrap:anywhere] text-sm text-foreground", n.read ? "font-medium" : "font-semibold")}>{n.title}</span>
            {!n.read && <span className={cn("size-2 shrink-0 rounded-full", tone.dot)} aria-label="Unread" />}
          </span>
          <span className="[overflow-wrap:anywhere] text-xs leading-relaxed text-muted-foreground">{n.body}</span>
          <span className="mt-0.5 text-[11px] text-muted-foreground/80">{relativeTime(n.at, now)}</span>
        </span>
      </button>

      {/* row actions: appear on hover / keyboard focus, always visible on touch screens */}
      <div className="absolute top-2.5 right-3 flex flex-col items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
        <button
          type="button"
          aria-label="Dismiss notification"
          title="Dismiss"
          onClick={() => notificationActions.dismiss(n.id)}
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-background hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={n.read ? "Mark as unread" : "Mark as read"}
          title={n.read ? "Mark as unread" : "Mark as read"}
          onClick={() => (n.read ? notificationActions.markUnread(n.id) : notificationActions.markRead(n.id))}
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-background hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          {n.read ? <Mail className="size-3.5" /> : <MailOpen className="size-3.5" />}
        </button>
      </div>
    </li>
  );
}

function Empty({ filter }: { filter: Filter }) {
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center px-8 py-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-border bg-secondary">
        <BellOff className="size-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-medium text-foreground">{filter === "unread" ? "No unread notifications" : "You're all caught up"}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        {filter === "unread" ? "Everything has been read. Switch to All to see earlier notifications." : "New replies, leads and failures will show up here."}
      </p>
    </div>
  );
}
