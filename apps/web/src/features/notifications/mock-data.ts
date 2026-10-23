import type { AppNotification, NotificationType } from "./types";

const MIN = 60_000;

type Seed = [type: NotificationType, title: string, body: string, minutesAgo: number, read: boolean, href: string | null];

const SEEDS: Seed[] = [
  ["reply", "Sarah Mitchell replied", "“Thanks for reaching out. Thursday works for a quick call, can you send a few times?”", 5, false, "/inbox"],
  ["approval", "12 drafts are waiting for approval", "AI-written emails for your Healthcare segment need a review before they are sent.", 22, false, "/approvals"],
  ["failure", "Research failed for Tom Becker", "The company website blocked automated access. 2 of 3 retries were used.", 45, false, "/activity"],
  ["lead", "9 new leads found", "Discovery finished for the E-commerce segment. They were added as New.", 70, false, "/leads"],
  ["reply", "Marcus Brody accepted your invite", "You are now connected on LinkedIn. A follow-up message is ready to review.", 190, true, "/linkedin?tab=connections"],
  ["team", "Ahmed Khan joined your workspace", "He accepted the invitation and joined as a Member.", 26 * 60, true, "/settings?tab=team"],
  ["approval", "Follow-up sequence #2 was approved", "3 messages are scheduled to go out between 9:00 and 11:00 AM tomorrow.", 29 * 60, true, "/follow-ups"],
  ["system", "Your weekly summary is ready", "42 emails sent, 13.7% reply rate and 5 meetings booked.", 32 * 60, true, "/analytics"],
  ["failure", "Gmail connection needs attention", "Reconnect your Gmail account so approved drafts can be sent.", 3 * 24 * 60, true, "/integrations"],
  ["lead", "Hyperion Logistics is now Interested", "Daniel Hughes asked for pricing. Open the lead to see the conversation.", 3 * 24 * 60 + 240, true, "/leads"],
  ["system", "Daily send limit reached", "Sending resumes tomorrow at 9:00 AM. You can raise the limit in Usage and Limits.", 4 * 24 * 60, true, "/settings?tab=usage"],
  ["team", "An invitation expired", "The invite for jane@brightcart.com was not accepted in 7 days. Resend it from Team.", 5 * 24 * 60, true, "/settings?tab=team"],
  ["system", "Welcome to AI Sales Agent", "Finish your workspace details so the AI can find the right leads and write better drafts.", 8 * 24 * 60, true, "/settings"],
];

/** Mock feed, newest first. Times are relative to `now` so the panel always looks live. */
export function buildMockNotifications(now = Date.now()): AppNotification[] {
  return SEEDS.map(([type, title, body, ago, read, href], i) => ({
    id: `ntf-${String(i + 1).padStart(3, "0")}`,
    type,
    title,
    body,
    at: new Date(now - ago * MIN).toISOString(),
    read,
    href,
  }));
}
