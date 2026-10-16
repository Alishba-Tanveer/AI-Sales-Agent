"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bot, ChevronsUpDown, LogOut, User } from "lucide-react";
import { cn } from "cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutUser } from "@/features/auth/api";
import { userStore } from "@/features/auth/user-store";
import { useNavCounts } from "@/features/overview/hooks";
import { NAV_SECTIONS, isNavActive, type NavItem } from "./nav-config";
import { ThemeSwitch } from "./theme-switch";

const pillTone = {
  warning: "border-warning/30 bg-warning-soft text-warning",
  destructive: "border-destructive/30 bg-destructive-soft text-destructive",
} as const;

function NavLink({
  item,
  active,
  count,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  count?: number;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center justify-between rounded-lg px-2 py-2 text-sm font-medium transition-all duration-200",
        // left accent bar: always shown when active, grows in on hover
        "before:absolute before:top-1/2 before:left-0 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary before:transition-all before:duration-200",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground before:h-5"
          : "text-muted-foreground before:h-0 hover:bg-muted hover:text-foreground hover:before:h-4 motion-safe:hover:translate-x-0.5",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon
          className={cn(
            "size-[18px] shrink-0 transition-all duration-200 motion-safe:group-hover:scale-110",
            !active && "group-hover:text-primary",
          )}
        />
        <span className="truncate">{item.label}</span>
      </span>
      {item.badge && count ? (
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[10px] font-semibold",
            pillTone[item.badge.tone],
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  const router = useRouter();
  const counts = useNavCounts();
  const user = userStore.get();

  const signOut = () => {
    logoutUser();
    router.replace("/login");
  };

  return (
    <>
      {/* mobile backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col justify-between border-r border-sidebar-border bg-sidebar transition-transform duration-200 select-none lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {/* brand */}
          <Link
            href="/overview"
            onClick={onClose}
            className="group flex items-center gap-2 border-b border-sidebar-border px-4 py-4"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bot className="size-[18px]" />
            </div>
            <span className="truncate text-base font-semibold leading-tight text-foreground">
              AI Sales Agent
            </span>
          </Link>

          {/* navigation */}
          <nav aria-label="Main" className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
            {NAV_SECTIONS.map((section, i) => (
              <div key={section.title ?? i} className={cn(i > 0 && "pt-1")}>
                {section.title && (
                  <div className="mb-1 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
                    {section.title}
                  </div>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      active={isNavActive(item, pathname, tab)}
                      count={item.badge ? counts?.[item.badge.key] : undefined}
                      onNavigate={onClose}
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* footer: theme + user */}
        <div className="flex shrink-0 flex-col gap-2 border-t border-sidebar-border bg-sidebar p-2">
          <ThemeSwitch />

          <DropdownMenu>
            <DropdownMenuTrigger
              className="group flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-card p-1.5 text-left transition-all duration-200 outline-none hover:border-primary/40 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="relative">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <User className="size-[18px]" />
                </span>
                <span className="absolute right-0 bottom-0 size-2 rounded-full bg-success ring-2 ring-sidebar" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs leading-tight font-semibold text-foreground">
                  {user?.name ?? "Your account"}
                </span>
                <span className="truncate text-[11px] text-muted-foreground capitalize">
                  {user?.role?.toLowerCase() ?? "Member"}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              {/* Base UI's GroupLabel must live inside a Group, otherwise it throws when the menu opens */}
              <DropdownMenuGroup>
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-foreground">{user?.name}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {user?.email}
                  </span>
                  {user?.organization?.name && (
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {user.organization.name}
                    </span>
                  )}
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
