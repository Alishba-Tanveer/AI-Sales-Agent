import { CircleCheck, Mail, MessagesSquare, TriangleAlert, UserPlus, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { timeAgo } from "../format";
import type { ActivityItem, ActivityType } from "../types";

const typeMeta: Record<ActivityType, { icon: LucideIcon; cls: string }> = {
  draft: { icon: Mail, cls: "text-muted-foreground" },
  reply: { icon: MessagesSquare, cls: "text-muted-foreground" },
  approved: { icon: CircleCheck, cls: "text-success" },
  failed: { icon: TriangleAlert, cls: "text-destructive" },
  lead_added: { icon: UserPlus, cls: "text-muted-foreground" },
};

/** Only the newest few are shown so this card stays the same height as its neighbours. */
const MAX_ITEMS = 6;

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  const recent = [...items].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, MAX_ITEMS);
  return (
    <section
      className="flex flex-col rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
      aria-labelledby="activity-title"
    >
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h2 id="activity-title" className="text-base font-medium text-foreground">
          Recent activity
        </h2>
        <span className="text-xs text-muted-foreground">Live feed</span>
      </div>
      <ul className="divide-y divide-border">
        {recent.map((item) => {
          const { icon: Icon, cls } = typeMeta[item.type];
          return (
            <li
              key={item.id}
              className="group -mx-3 flex cursor-default items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors duration-150 last:pb-3 hover:bg-muted/60"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Icon
                  className={cn(
                    "size-[18px] shrink-0 transition-transform duration-200 motion-safe:group-hover:scale-125",
                    cls,
                  )}
                />
                <span className="[overflow-wrap:anywhere] text-sm text-foreground">{item.text}</span>
              </div>
              <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground transition-colors group-hover:text-foreground">
                {timeAgo(item.at)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
