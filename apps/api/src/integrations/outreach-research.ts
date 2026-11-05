import { env } from "../config/env";
import { tavilySearch } from "./tavily";

type RecipientContext = { name: string; company: string | null; jobTitle: string | null };
export type OutreachResearch = Array<{ title: string; url: string; content: string }>;

/** Gather a small, grounded set of public facts for personalized outreach when search is configured. */
export async function researchRecipient(recipient: RecipientContext): Promise<OutreachResearch> {
  if (!env.TAVILY_API_KEY) return [];
  const query = [
    recipient.name.trim().toLowerCase() !== recipient.company?.trim().toLowerCase() ? recipient.name : null,
    recipient.company,
    recipient.jobTitle,
    "recent products projects priorities customer challenges",
  ].filter(Boolean).join(" ");

  try {
    return (await tavilySearch({ query, maxResults: 5 }))
      .filter((result) => result.score >= 0.35)
      .map(({ title, url, content }) => ({ title, url, content: content.slice(0, 1_200) }));
  } catch (error) {
    console.warn(`[outreach] public research unavailable for ${recipient.company || recipient.name}:`, (error as Error).message);
    return [];
  }
}

export function outreachGreeting(name: string, company: string | null): string {
  const recipient = company?.trim().toLowerCase() === name.trim().toLowerCase()
    ? `${company || name} team`
    : name.trim().split(/\s+/)[0] || "there";
  return `Hi ${recipient},`;
}

/** Keep a consistent, personalized salutation even if a model omits or changes the requested greeting. */
export function ensureOutreachGreeting(body: string, greeting: string): string {
  const withoutGreeting = body.trim().replace(/^(?:hi|hello|dear)\s+[^,\n]+,?\s*/i, "");
  return `${greeting}\n\n${withoutGreeting}`;
}
