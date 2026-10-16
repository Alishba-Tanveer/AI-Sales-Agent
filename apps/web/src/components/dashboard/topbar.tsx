"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  // Global search jumps to the Leads page with the term pre-filled (?search=)
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/leads?search=${encodeURIComponent(q)}`);
  };

  return (
    <header className="fixed top-0 right-0 left-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar/95 px-4 backdrop-blur-xl lg:left-60 lg:px-6">
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

        <form onSubmit={onSubmit} role="search" className="relative w-full max-w-lg">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads, opportunities, or activity..."
            aria-label="Search"
            className="h-10 rounded-lg border-border bg-card pr-4 pl-9 text-xs transition-all duration-200 hover:border-primary/40 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary md:text-xs dark:bg-card"
          />
        </form>
      </div>

      <Button
        variant="ghost"
        size="icon-lg"
        aria-label="Notifications"
        className="group relative text-muted-foreground transition-colors duration-200 hover:bg-primary-soft hover:text-primary"
      >
        <Bell className="size-5 origin-top transition-transform duration-300 motion-safe:group-hover:rotate-12" />
        <span className="absolute top-2 right-2 size-2 rounded-full bg-primary ring-2 ring-sidebar transition-transform duration-200 group-hover:scale-125" />
      </Button>
    </header>
  );
}
