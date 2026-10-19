import Link from "next/link";
import { ArrowRight, CircleAlert, Clock, PartyPopper, User, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AttentionItem } from "../types";

const kindConfig: Record<
  AttentionItem["kind"],
  { icon: LucideIcon; iconCls: string; label: string; href: string; actionCls: string; showArrow?: boolean }
> = {
  reply: {
    icon: User,
    iconCls: "bg-primary-soft text-primary",
    label: "Take over",
    href: "/inbox",
    actionCls: "border border-border bg-secondary text-secondary-foreground hover:bg-muted",
  },
  approvals: {
    icon: Clock,
    iconCls: "bg-warning-soft text-warning",
    label: "Review",
    href: "/approvals",
    actionCls: "bg-primary text-primary-foreground hover:bg-primary/85",
  },
  failure: {
    icon: CircleAlert,
    iconCls: "bg-destructive-soft text-destructive",
    label: "View",
    href: "/activity",
    actionCls: "bg-transparent px-0 text-primary shadow-none hover:bg-transparent hover:shadow-none hover:underline motion-safe:hover:translate-y-0",
    showArrow: true,
  },
};

export function AttentionCard({ items }: { items: AttentionItem[] }) {
  return (
    <section
      className="flex flex-col rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
      aria-labelledby="attention-title"
    >
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <h2 id="attention-title" className="text-base font-medium text-foreground">
            Needs your attention
          </h2>
          {items.length > 0 && (
            <Badge className="h-auto rounded-md border border-warning/30 bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">
              {items.length} {items.length === 1 ? "item" : "items"}
            </Badge>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3.5 pt-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
            <PartyPopper className="size-[18px]" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">You&apos;re all caught up</span>
            <span className="mt-0.5 text-xs text-muted-foreground">Nothing needs your attention right now.</span>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const cfg = kindConfig[item.kind];
            const Icon = cfg.icon;
            return (
              <li
                key={item.id}
                className="group -mx-3 flex flex-col justify-between gap-4 rounded-lg px-3 py-4 transition-colors duration-150 hover:bg-muted/60 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full transition-transform duration-200 motion-safe:group-hover:scale-110",
                      cfg.iconCls,
                    )}
                  >
                    <Icon className="size-[18px]" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                    <span className="mt-0.5 truncate text-xs text-muted-foreground">{item.subtitle}</span>
                  </div>
                </div>
                <Link
                  href={cfg.href}
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "group/action h-auto shrink-0 gap-1 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-md",
                    cfg.actionCls,
                  )}
                >
                  {cfg.label}
                  {cfg.showArrow && (
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover/action:translate-x-1" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
