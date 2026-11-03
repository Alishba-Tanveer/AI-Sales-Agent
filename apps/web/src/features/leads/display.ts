import type { Lead } from "./types";

/**
 * Leads saved from Find Opportunities have no named contact yet, so the company name is stored as the lead's name AND as
 * its company. Showing both would print the same text twice, so the company is left out whenever it only repeats the name.
 */
export const sameText = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** "Role · Company" line under a lead's name, without repeating the name. */
export function leadSubtitle(lead: Pick<Lead, "name" | "jobTitle" | "company">): string {
  const company = sameText(lead.name, lead.company) ? null : lead.company;
  const text = [lead.jobTitle, company].filter(Boolean).join(" · ");
  if (text) return text;
  // a company-only lead (name = company): say what it is instead of repeating it
  return sameText(lead.name, lead.company) ? "Company lead · contact person not added yet" : "Role and company not added";
}
