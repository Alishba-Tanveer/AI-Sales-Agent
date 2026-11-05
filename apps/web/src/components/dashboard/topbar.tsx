"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2, Menu, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { buildSuggestions, type Suggestion } from "@/features/search/destinations";
import { resolveLookup } from "@/features/search/resolve";
import { currentRole } from "@/lib/permissions";
import { cn } from "cn";
import { NotificationsSheet } from "@/features/notifications/components/notifications-sheet";
import { useNotifications } from "@/features/notifications/store";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const listId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const { unread } = useNotifications();

  // Global search: as you type it suggests matching pages and tabs ("team" -> Settings > Team); the last row searches Leads.
  // The role is read here (client only, after typing starts) because it comes from localStorage.
  const items = useMemo(() => (open ? buildSuggestions(query, currentRole()) : []), [query, open]);
  const showList = open && items.length > 0;

  const reset = () => {
    setQuery("");
    setActive(0);
    setOpen(false);
  };

  const go = (href: string) => {
    router.push(href);
    reset();
  };

  /** Nothing matched: stay on the current page, keep what was typed so it can be corrected, and say so. */
  const notFound = (text: string) => {
    setOpen(false);
    toast("Nothing found", { description: `No page, tab, conversation or lead matches “${text.trim()}”. Try a page name like “inbox”, “settings team” or “target buyers”, or a person’s name.` });
  };

  const choose = async (pick: Suggestion | undefined, typed: string) => {
    if (!pick) return notFound(typed);
    if (pick.lookup === undefined) return go(pick.href);
    setSearching(true);
    try {
      const href = await resolveLookup(pick.lookup);
      if (href) go(href);
      else if (pick.lookup.scope === "inbox") { setOpen(false); toast("Nothing found", { description: `No Inbox conversation matches “${pick.lookup.term}”.` }); }
      else notFound(typed);
    } catch {
      setOpen(false);
      toast.error("Could not search right now. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || searching) return;
    void choose(items[active] ?? items[0], query);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (open) e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!items.length) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => (e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length));
    }
  };

  return (
    <header className="fixed top-0 right-0 left-0 z-30 border-b border-sidebar-border bg-sidebar/95 backdrop-blur-xl lg:left-60">
      {/* same centred 1280px column + side padding as the pages below, so the search box lines up with their content */}
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-3 px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
          onClick={onMenuClick}
        >
          <Menu className="size-5" />
        </Button>

        <form
          ref={formRef}
          onSubmit={onSubmit}
          role="search"
          className="relative w-full max-w-lg"
          onBlur={(e) => {
            if (!formRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
          }}
        >
          {searching
            ? <Loader2 className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 animate-spin text-primary" />
            : <Search className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-muted-foreground" />}
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList ? `${listId}-${active}` : undefined}
            autoComplete="off"
            placeholder="Search a page, tab or person, e.g. target buyers, inbox alishba..."
            aria-label="Search"
            className="h-10 rounded-lg border-border bg-card pr-4 pl-9 text-xs transition-all duration-200 hover:border-primary/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-xs dark:bg-card [&::-webkit-search-cancel-button]:appearance-none"
          />
          {showList && (
            <div className="absolute top-full right-0 left-0 z-40 mt-1.5 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg shadow-black/20">
              <ul id={listId} role="listbox" aria-label="Search suggestions" className="flex flex-col">
                {items.map((it, i) => {
                  const Icon = it.icon;
                  return (
                    <li key={it.key} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                      <button
                        type="button"
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => void choose(it, query)}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs outline-none transition-colors",
                          i === active ? "bg-primary-soft text-primary" : "text-foreground hover:bg-muted",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1 [overflow-wrap:anywhere] font-medium">{it.label}</span>
                        <span className={cn("shrink-0 text-[11px]", i === active ? "text-primary/80" : "text-muted-foreground")}>{it.kind}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="hidden border-t border-border px-2.5 pt-1.5 pb-1 text-[11px] text-muted-foreground sm:block">↑ ↓ to move · Enter to open · Esc to close</p>
            </div>
          )}
        </form>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* theme switch lives here (top-right) instead of the sidebar */}
        <ThemeToggle className="size-9 border-border bg-card text-muted-foreground hover:text-foreground dark:bg-card" />

        <Button
          variant="ghost"
          size="icon-lg"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          aria-haspopup="dialog"
          aria-expanded={notifOpen}
          onClick={() => setNotifOpen(true)}
          className="group relative text-muted-foreground transition-colors duration-200 hover:bg-primary-soft hover:text-primary"
        >
          <Bell className="size-5 origin-top transition-transform duration-300 motion-safe:group-hover:rotate-12" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums ring-2 ring-sidebar transition-transform duration-200 group-hover:scale-110">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
        <NotificationsSheet open={notifOpen} onOpenChange={setNotifOpen} />
      </div>
      </div>
    </header>
  );
}
