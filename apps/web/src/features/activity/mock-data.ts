import type { ActivityJob, AgentName, JobKind } from "./types";

const MIN = 60_000;

type Seed = {
  kind: JobKind;
  title: string;
  lead?: string;
  context: string;
  agent?: AgentName;
  /** minutes ago the job started */
  ago: number;
  durationSec: number;
};

const OUTPUT: Record<JobKind, (lead: string | undefined, context: string) => string> = {
  research: (lead, ctx) => `Profile built for ${lead ?? ctx}: role, company size, recent news and 3 talking points saved to the lead.`,
  draft: (lead) => `Draft written for ${lead ?? "the lead"} and sent to the Approvals queue for review.`,
  sync: () => "Connections synced. 14 new connections found, 2 matched existing leads.",
  enrich: (_l, ctx) => `Company data for ${ctx.split(" Inc")[0]} enriched: industry, headcount, funding stage and website.`,
  invite: (lead) => `Connection invite with a personal note sent to ${lead ?? "the lead"}.`,
  analyze: (_l, ctx) => `Tech stack for ${ctx} detected. Fit score updated.`,
  discover: () => "Discovery run finished. 9 new prospects added to Leads as New.",
  followup: (lead) => `Follow-up #2 scheduled for ${lead ?? "the lead"} and queued for approval.`,
  lead: (lead) => `${lead ?? "A new contact"} was added to Leads.`,
};

const mk = (s: Seed, i: number, now: number): ActivityJob => ({
  id: `job-${String(i + 1).padStart(3, "0")}`,
  kind: s.kind,
  title: s.title,
  lead: { id: s.lead ? `lead-${i + 1}` : null, name: s.lead ?? null, context: s.context },
  agent: s.agent ?? "General Agent",
  status: "completed",
  startedAt: new Date(now - s.ago * MIN).toISOString(),
  scheduledFor: null,
  durationSec: s.durationSec,
  retries: 0,
  maxRetries: 3,
  output: OUTPUT[s.kind](s.lead, s.context),
  error: null,
});

/**
 * 28 jobs: 23 completed, 2 running, 2 failed, 1 queued. Newest activity first, like the real feed will be.
 * Times are relative to `now` so the page always looks live.
 */
export function buildMockActivity(now = Date.now()): ActivityJob[] {
  const j = (seed: Seed, i: number) => mk(seed, i, now);

  const first: ActivityJob[] = [
    j({ kind: "research", title: "Research lead: Daniel Hughes", lead: "Daniel Hughes", context: "Northwind Dental", ago: 18, durationSec: 42 }, 0),
    j({ kind: "draft", title: "Draft email: Sarah Mitchell", lead: "Sarah Mitchell", context: "BrightCart", ago: 28, durationSec: 14 }, 1),
    {
      ...j({ kind: "discover", title: "Check job portals", context: "E-commerce Segment", ago: 0, durationSec: 0 }, 2),
      status: "running",
      startedAt: new Date(now - 64_000).toISOString(),
      durationSec: null,
      output: null,
    },
    {
      ...j({ kind: "research", title: "Research lead: Tom Becker", lead: "Tom Becker", context: "Lumen Health", ago: 45, durationSec: 90 }, 3),
      status: "failed",
      retries: 2,
      output: null,
      error: "The company website blocked automated access (HTTP 403) and no other public sources were found. Retried 2 of 3 times.",
    },
    {
      ...j({ kind: "followup", title: "Draft follow-up", lead: "Daniel Hughes", context: "Follow-up Sequence #2", ago: 0, durationSec: 0 }, 4),
      status: "queued",
      startedAt: null,
      scheduledFor: new Date(now + 2 * 60 * MIN).toISOString(),
      durationSec: null,
      output: null,
    },
    j({ kind: "sync", title: "Sync LinkedIn Connections", context: "Global Sync Routine", agent: "LinkedIn Agent", ago: 120, durationSec: 135 }, 5),
    j({ kind: "enrich", title: "Enrich company: CloudScale", lead: "Alex Rivera", context: "CloudScale Inc", ago: 180, durationSec: 38 }, 6),
    j({ kind: "invite", title: "Send invite: Marcus Brody", lead: "Marcus Brody", context: "FinTech Labs", agent: "LinkedIn Agent", ago: 240, durationSec: 19 }, 7),
    {
      ...j({ kind: "analyze", title: "Analyze stack: Apex Global", context: "Systems", ago: 300, durationSec: 45 }, 8),
      lead: { id: "lead-9", name: "Apex Global", context: "Systems" },
      status: "failed",
      retries: 3,
      output: null,
      error: "Tech stack lookup timed out after 30 seconds on every attempt (3 of 3). Try again later or check the lookup service in Integrations.",
    },
    {
      ...j({ kind: "discover", title: "Find decision makers", context: "Hyperion Logistics", ago: 0, durationSec: 0 }, 9),
      status: "running",
      startedAt: new Date(now - 22_000).toISOString(),
      durationSec: null,
      output: null,
    },
  ];

  const older: Seed[] = [
    { kind: "research", title: "Research lead: Priya Nair", lead: "Priya Nair", context: "Orbit Analytics", ago: 360, durationSec: 51 },
    { kind: "draft", title: "Draft email: Liam O'Connor", lead: "Liam O'Connor", context: "Greenfield Energy", ago: 400, durationSec: 17 },
    { kind: "invite", title: "Send invite: Hannah Weiss", lead: "Hannah Weiss", context: "Sprout Labs", agent: "LinkedIn Agent", ago: 480, durationSec: 21 },
    { kind: "enrich", title: "Enrich company: Brightwave", lead: "Omar Haddad", context: "Brightwave Media", ago: 540, durationSec: 33 },
    { kind: "discover", title: "Find opportunities: SaaS founders", context: "Saved search", ago: 600, durationSec: 184 },
    { kind: "research", title: "Research lead: Chloe Martin", lead: "Chloe Martin", context: "Pinecrest Realty", ago: 780, durationSec: 47 },
    { kind: "draft", title: "Draft email: Ethan Brooks", lead: "Ethan Brooks", context: "Vector Robotics", ago: 840, durationSec: 12 },
    { kind: "followup", title: "Draft follow-up", lead: "Sarah Mitchell", context: "Follow-up Sequence #1", ago: 900, durationSec: 15 },
    { kind: "sync", title: "Sync LinkedIn Connections", context: "Global Sync Routine", agent: "LinkedIn Agent", ago: 1_080, durationSec: 128 },
    { kind: "analyze", title: "Analyze stack: Helix Freight", lead: "Rina Kapoor", context: "Helix Freight", ago: 1_200, durationSec: 41 },
    { kind: "research", title: "Research lead: Lucas Ferreira", lead: "Lucas Ferreira", context: "Solstice Solar", ago: 1_320, durationSec: 58 },
    { kind: "invite", title: "Send invite: Nora Lindqvist", lead: "Nora Lindqvist", context: "Nordic Pay", agent: "LinkedIn Agent", ago: 1_440, durationSec: 18 },
    { kind: "draft", title: "Draft email: Victor Chen", lead: "Victor Chen", context: "Atlas Cloud", ago: 1_560, durationSec: 16 },
    { kind: "enrich", title: "Enrich company: Marlow & Co", lead: "Grace Adeyemi", context: "Marlow & Co", ago: 1_800, durationSec: 36 },
    { kind: "research", title: "Research lead: Jonas Weber", lead: "Jonas Weber", context: "Kite Logistics", ago: 2_000, durationSec: 44 },
    { kind: "discover", title: "Check job portals", context: "Healthcare Segment", ago: 2_160, durationSec: 212 },
    { kind: "followup", title: "Draft follow-up", lead: "Tom Becker", context: "Follow-up Sequence #1", ago: 2_400, durationSec: 13 },
    { kind: "sync", title: "Sync LinkedIn Connections", context: "Global Sync Routine", agent: "LinkedIn Agent", ago: 2_880, durationSec: 141 },
  ];

  return [...first, ...older.map((s, i) => j(s, i + first.length))];
}
