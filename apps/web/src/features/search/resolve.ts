import { fetchInbox } from "@/features/inbox/api";
import { fetchLeads } from "@/features/leads/api";

/**
 * Searches that are not a page or a tab: a person's name.
 *   "inbox alishba"  -> opens Inbox with Alishba's conversation selected
 *   "lead john"      -> Leads filtered by "john"
 *   "alishba"        -> Leads filtered by "alishba"
 * Pages and tabs themselves ("target buyers", "settings team"...) are matched in destinations.ts.
 * When nothing is found, the top bar stays on the current page and shows a "nothing found" notice.
 */
export type Lookup = { scope: "leads" | "inbox"; term: string };

const FILLER = new Set(["go", "to", "open", "show", "the", "page", "tab", "my", "and", "in", "of", "on", "for", "with", "from", "chat", "conversation", "conversations"]);
const INBOX_KEYS = ["inbox", "email", "emails", "message", "messages", "reply", "replies"];
const LEADS_KEYS = ["lead", "leads", "prospect", "prospects", "contact", "contacts"];
// Words that name another page: "analytics foo" is a wrong search, not a lead called "analytics foo".
const OTHER_PAGE_KEYS = new Set([
  "overview", "dashboard", "home", "activity", "analytics", "integrations", "integration", "settings", "setting",
  "linkedin", "opportunities", "opportunity", "find", "profile", "content", "connections", "connection", "team", "business",
]);

/** What a typed search means when it is not a page or tab: look a person up in Leads or in the Inbox. */
export function parseLookup(raw: string): Lookup | null {
  const parts = raw.replace(/[>/,]+/g, " ").trim().split(/\s+/).filter((w) => w && !FILLER.has(w.toLowerCase()));
  if (!parts.length) return null;
  const lower = parts.map((w) => w.toLowerCase());

  const inboxAt = lower.findIndex((w) => INBOX_KEYS.includes(w));
  const leadsAt = lower.findIndex((w) => LEADS_KEYS.includes(w));
  const at = inboxAt >= 0 ? inboxAt : leadsAt;
  if (at >= 0) {
    const term = parts.filter((_, i) => i !== at).join(" ").trim();
    return term ? { scope: inboxAt >= 0 ? "inbox" : "leads", term } : null;
  }
  if (lower.some((w) => OTHER_PAGE_KEYS.has(w))) return null;
  return { scope: "leads", term: parts.join(" ") };
}

/** Looks the person up. Returns the route to open, or null when nobody matches. Throws if the server cannot be reached. */
export async function resolveLookup({ scope, term }: Lookup): Promise<string | null> {
  if (scope === "leads") {
    const { leads } = await fetchLeads(term);
    return leads.length ? `/leads?search=${encodeURIComponent(term)}` : null;
  }
  const items = await fetchInbox(term);
  if (!items.length) return null;
  const wanted = term.toLowerCase().split(/\s+/);
  const byName = items.find((i) => wanted.every((w) => i.lead.name.toLowerCase().includes(w)));
  const hit = byName ?? items[0];
  // "r" makes every search a new URL, so searching the same person twice still re-opens the chat.
  return `/inbox?leadId=${hit.lead.id}&r=${Date.now()}`;
}
