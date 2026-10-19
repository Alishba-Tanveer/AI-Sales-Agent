"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, Building2, Megaphone, ShieldCheck, SlidersHorizontal, User, Users, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Reveal } from "@/features/overview/components/reveal";
import { SENT_TODAY } from "../mock-data";
import { TONES, type Tone } from "./settings-ui";
import type { SettingsTabId } from "../types";
import { ApprovalRulesTab } from "./approval-rules-tab";
import { BusinessTab } from "./business-tab";
import { NotificationsTab } from "./notifications-tab";
import { OutreachTab } from "./outreach-tab";
import { ProfileTab } from "./profile-tab";
import { TeamTab } from "./team-tab";
import { UsageTab } from "./usage-tab";

const TABS: { id: SettingsTabId; label: string; icon: LucideIcon; tone: Tone; dot?: boolean }[] = [
  { id: "profile", label: "Profile", icon: User, tone: "primary" },
  { id: "business", label: "Business", icon: Building2, tone: "success" },
  { id: "team", label: "Team", icon: Users, tone: "primary" },
  { id: "outreach", label: "Outreach Strategy", icon: Megaphone, tone: "success", dot: true },
  { id: "governance", label: "Approval Rules", icon: ShieldCheck, tone: "warning" },
  { id: "notifications", label: "Notifications", icon: Bell, tone: "primary" },
  { id: "usage", label: "Usage and Limits", icon: SlidersHorizontal, tone: "success" },
];

const isTab = (v: string | null): v is SettingsTabId => TABS.some((t) => t.id === v);

export function SettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab: SettingsTabId = isTab(raw) ? raw : "profile";

  // shared between "Outreach Strategy" (where it is edited) and "Usage and Limits" (where it is shown)
  const [dailyCap, setDailyCap] = useState(Math.max(40, SENT_TODAY));

  const go = (id: SettingsTabId) => router.replace(id === "profile" ? pathname : `${pathname}?tab=${id}`, { scroll: false });

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 p-6 lg:p-8">
      <Reveal>
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your personal account, company profile, outreach parameters, and governance rules.
          </p>
        </header>
      </Reveal>

      <div>
        <div role="tablist" aria-label="Settings sections" className="flex w-full items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-border whitespace-nowrap [scrollbar-width:none] sm:gap-2 [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ id, label, icon: Icon, dot, tone }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                id={`tab-${id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${id}`}
                onClick={() => go(id)}
                className={cn(
                  "-mb-px flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-primary font-semibold text-primary" : "border-transparent font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", TONES[tone].text)} />
                {label}
                {dot && <span className="size-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Each workspace&apos;s data is separate.</p>
      </div>

      <Reveal key={tab}>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === "profile" && <ProfileTab />}
          {tab === "business" && <BusinessTab />}
          {tab === "team" && <TeamTab />}
          {tab === "outreach" && <OutreachTab dailyCap={dailyCap} onDailyCapChange={setDailyCap} />}
          {tab === "governance" && <ApprovalRulesTab />}
          {tab === "notifications" && <NotificationsTab />}
          {tab === "usage" && <UsageTab dailyCap={dailyCap} onOpenOutreach={() => go("outreach")} />}
        </div>
      </Reveal>
    </main>
  );
}
