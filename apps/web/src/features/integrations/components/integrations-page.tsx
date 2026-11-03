"use client";

import Link from "next/link";
import { Bot, Briefcase, ExternalLink, Info, Lock, Mail, Network, Search, Video } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { useRole } from "@/lib/use-role";
import { gmailInboxUrl } from "@/features/inbox/gmail";
import { SOURCES } from "@/features/opportunities/constants";
import { Reveal } from "@/features/overview/components/reveal";
import { getOutreach, getUsage } from "@/features/settings/api";
import { HOVER_BUTTONS, Pill, TONES, type Tone } from "@/features/settings/components/settings-ui";
import { useLoad } from "@/features/settings/use-load";
import { IntegrationCard, Row } from "./integrations-ui";

/** Filled primary button, or an outline button tinted with its card's theme colour. */
const linkBtn = (primary = false, tone?: Tone) =>
  cn(buttonVariants({ variant: primary ? "default" : "outline" }), "h-8 gap-1.5 px-3 text-[13px]", !primary && tone && TONES[tone].btn);
const money = (n: number) => `$${n.toFixed(2)}`;

function Meter({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span className={cn("block h-full rounded-full transition-all duration-300", pct >= 90 ? "bg-destructive" : "bg-primary")} style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Daily limit and approval come from Settings → Outreach, so they are always the real numbers. */
function OutreachRows() {
  const { state } = useLoad(getOutreach);
  if (state.status === "loading") return <Row label="Daily limit">Loading…</Row>;
  if (state.status === "error") return <Row label="Daily limit">Could not load</Row>;
  const { dailyCap, approved } = state.data;
  return (
    <>
      <Row label="Daily limit">{dailyCap} messages per day</Row>
      <Row label="Strategy">{approved ? <Pill tone="success">Approved</Pill> : <Pill tone="warning">Not approved yet</Pill>}</Row>
    </>
  );
}

/** Only the Owner may read usage (the backend answers 403 to everyone else), so this component is only rendered for them. */
function UsageRows() {
  const { state } = useLoad(getUsage);
  if (state.status === "loading") return <Row label="This month">Loading…</Row>;
  if (state.status === "error") return <Row label="This month">Could not load</Row>;
  const u = state.data;
  return (
    <>
      <Row label="This month">
        {money(u.aiSpendThisMonth)} of {money(u.aiLimit)}
        <Meter value={u.aiSpendThisMonth} max={u.aiLimit} />
      </Row>
      <Row label="Today">
        {u.requestsToday} of {u.requestsDailyLimit} requests
        <Meter value={u.requestsToday} max={u.requestsDailyLimit} />
      </Row>
    </>
  );
}

export function IntegrationsPage() {
  const role = useRole();
  const allowed = role === null ? null : can.connectIntegrations(role);
  const isOwner = role !== null && can.manageUsageAndBilling(role);

  if (allowed === null) return <main className="mx-auto w-full max-w-[1600px] p-6 lg:p-8" aria-busy />;

  if (!allowed) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
            <Lock className="size-5" />
          </span>
          <h1 className="text-lg font-semibold text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground">Only the workspace Owner or an Admin can see integrations. Ask one of them if you need something changed.</p>
          <Link href="/overview" className="text-sm font-medium text-primary hover:underline">
            Back to Overview
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={cn("mx-auto w-full max-w-[1600px] p-6 lg:p-8", HOVER_BUTTONS)}>
      <div className="flex w-full flex-col gap-6">
        <Reveal>
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Integrations</h1>
            <p className="text-sm text-muted-foreground">The tools your AI Sales Agent works with, and what each one is allowed to do.</p>
          </header>
        </Reveal>

        <Reveal delay={60}>
          <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary-soft/40 p-3.5 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p>
              <span className="font-medium text-foreground">Nothing here logs in to your mailbox or LinkedIn.</span> <span className="font-medium text-foreground">Built in</span> tools run for your whole workspace with nothing to set
              up. <span className="font-medium text-foreground">Manual</span> means you do the last step yourself, so nothing is ever sent without you.
            </p>
          </div>
        </Reveal>

        <div className="grid w-full min-w-0 grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          <Reveal delay={100} className="grid">
            <IntegrationCard
              icon={Mail}
              tone="info"
              title="Gmail"
              subtitle="You send, the app drafts and keeps track."
              status="manual"
              actions={
                <>
                  <a href={gmailInboxUrl} target="_blank" rel="noopener noreferrer" className={linkBtn(false, "info")}>
                    Open Gmail <ExternalLink className="size-3.5" />
                  </a>
                  <Link href="/inbox" className={linkBtn(true)}>
                    Go to Inbox
                  </Link>
                </>
              }
            >
              <Row label="Sending">You send from your own Gmail</Row>
              <Row label="Replies">Copy a reply into the Inbox to log it</Row>
              <Row label="Access">No connection to your mailbox</Row>
              <OutreachRows />
            </IntegrationCard>
          </Reveal>

          <Reveal delay={140} className="grid">
            <IntegrationCard
              icon={Bot}
              tone="violet"
              title="AI provider"
              subtitle="Writes drafts, replies and post scripts."
              status="builtin"
              actions={
                isOwner ? (
                  <Link href="/settings?tab=usage" className={linkBtn(false, "violet")}>
                    Usage and limits
                  </Link>
                ) : undefined
              }
            >
              <Row label="Providers">Google Gemini and Groq</Row>
              <Row label="Does">Email and LinkedIn drafts, reply drafts, profile tips, post scripts</Row>
              <Row label="Access">Generates text only. It never sends anything.</Row>
              {isOwner ? <UsageRows /> : <Row label="Usage">Visible to the workspace Owner</Row>}
            </IntegrationCard>
          </Reveal>

          <Reveal delay={180} className="grid">
            <IntegrationCard
              icon={Search}
              tone="primary"
              title="Web research"
              subtitle="Tavily search. Looks things up on the public web."
              status="builtin"
              actions={
                <Link href="/linkedin?tab=connections" className={linkBtn(false, "primary")}>
                  Find buyers
                </Link>
              }
            >
              <Row label="Used for">Finding buyers and this week&apos;s news for your LinkedIn posts</Row>
              <Row label="Access">Public web pages only</Row>
            </IntegrationCard>
          </Reveal>

          <Reveal delay={220} className="grid">
            <IntegrationCard
              icon={Briefcase}
              tone="warning"
              title="Job sources"
              subtitle="Public job boards used by Find Opportunities."
              status="builtin"
              actions={
                <Link href="/find-opportunities" className={linkBtn(false, "warning")}>
                  Find Opportunities
                </Link>
              }
            >
              <Row label="Sources">
                <span className="flex flex-wrap gap-1.5">
                  {SOURCES.map((s) => (
                    <Pill key={s.id} tone="muted">
                      {s.label}
                    </Pill>
                  ))}
                </span>
              </Row>
              <Row label="Credentials">None needed. Public listings only.</Row>
            </IntegrationCard>
          </Reveal>

          <Reveal delay={260} className="grid">
            <IntegrationCard
              icon={Network}
              tone="pink"
              title="LinkedIn"
              subtitle="Not connected. You copy and paste yourself."
              status="manual"
              actions={
                <>
                  <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" className={linkBtn(false, "pink")}>
                    Open LinkedIn <ExternalLink className="size-3.5" />
                  </a>
                  <Link href="/linkedin" className={linkBtn(true)}>
                    LinkedIn tools
                  </Link>
                </>
              }
            >
              <Row label="Messages">You send them yourself on LinkedIn</Row>
              <Row label="Posts">You publish the approved script yourself</Row>
              <Row label="Access">No LinkedIn login is stored</Row>
            </IntegrationCard>
          </Reveal>

          <Reveal delay={300} className="grid">
            <IntegrationCard icon={Video} tone="success" title="D-ID Video Generation"
              subtitle="Turns an approved script into a photorealistic AI avatar video."
              status="builtin"
              actions={
                <Link href="/linkedin?tab=content" className={linkBtn(true)}>
                  Content Engine
                </Link>
              }
            >
              <Row label="Provider">D-ID Avatar API</Row>
              <Row label="Status"><Pill tone="success">Active</Pill></Row>
              <Row label="Does">Creates talking head avatar videos from LinkedIn scripts</Row>
              <Row label="Credentials">Configured with D_DI_KEY_AVATAR</Row>
            </IntegrationCard>
          </Reveal>
        </div>
      </div>
    </main>
  );
}
