/**
 * LinkedIn link helpers shared by the Profile, Content and Connections pages.
 *
 * LinkedIn does not let apps edit a profile or publish a post, so everything here is about
 * getting the person to the right LinkedIn screen quickly and tidily.
 */
import type { ContentScript, ProfileSuggestion } from "./types";

const PROFILE_RE = /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)?linkedin\.com\/(?:in|pub)\/([^/?#\s]+)/i;

/**
 * Accepts every way people paste a profile link:
 *   https://www.linkedin.com/in/jane   linkedin.com/in/jane/   www.linkedin.com/in/jane?utm=x
 *   http://uk.linkedin.com/in/jane     https://www.linkedin.com/in/jane/details/experience/
 * and returns the clean form `https://www.linkedin.com/in/jane`, or null if it is not a profile link.
 */
export function normalizeLinkedInProfileUrl(value: string): string | null {
  const m = value.trim().match(PROFILE_RE);
  return m ? `https://www.linkedin.com/in/${m[1]}` : null;
}

export const isLinkedInProfileUrl = (value: string) => normalizeLinkedInProfileUrl(value) !== null;

/** Any web link, with or without https://. Returns the full https link, or null when it is not a link. */
export function normalizeWebUrl(value: string): string | null {
  const v = value.trim();
  if (!v || /\s/.test(v)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/* ---------- Profile edit links ---------- */

type Section = ProfileSuggestion["section"];

export type EditTarget = {
  /** Best page to land on for this change */
  url: string;
  /** Always-safe fallback: the profile itself */
  profileUrl: string;
  /** Short instructions shown in the popup, so it works even if LinkedIn changes a page */
  steps: string[];
};

/**
 * LinkedIn only publishes one real "edit" deep link (/edit/intro/ for the headline).
 * The other sections land on the closest real page and the steps say where to click.
 * If you find a better link for a section, change it here only.
 */
export function editTarget(profileUrl: string, section: Section): EditTarget {
  const base = normalizeLinkedInProfileUrl(profileUrl) ?? "https://www.linkedin.com/in/me";
  const profile = `${base}/`;

  const map: Record<Section, { url: string; steps: string[] }> = {
    intro: {
      url: `${base}/edit/intro/`,
      steps: ["LinkedIn opens your intro editor.", "Click into the Headline box and select the old text.", "Paste the new headline, then press Save."],
    },
    about: {
      // Opens the "Edit about" popup (About text + top skills) straight on top of your profile.
      url: `${base}/edit/forms/summary/new/`,
      steps: ["LinkedIn opens the “Edit about” popup.", "Click into the text box and select the old summary.", "Paste the new summary, then press Save."],
    },
    experience: {
      url: `${base}/details/experience/`,
      steps: ["LinkedIn opens your Experience list.", "Click the pencil next to the role you want to change.", "Replace the description with the new wording, then press Save."],
    },
    skills: {
      url: `${base}/details/skills/`,
      steps: ["LinkedIn opens your Skills list.", "Click the + button at the top to add each new skill (or the pencil to remove old ones).", "Add the skills one by one, then press Save."],
    },
    featured: {
      url: profile,
      steps: ["On your profile, click Add profile section under your name.", "Open Recommended, then choose Add featured.", "Click +, pick Add a link or Add media, and paste your demo and booking link."],
    },
  };

  return { ...map[section], profileUrl: profile };
}

/* ---------- Posting ---------- */

/** Your own post list on LinkedIn (the Posts tab of All activity). Works for whoever is logged in. */
export const ACTIVITY_URL = "https://www.linkedin.com/in/me/recent-activity/shares/";

/** The caption a person pastes under their video. */
export function scriptCaption(s: Pick<ContentScript, "hook" | "points" | "cta">) {
  return `${s.hook}\n\n${s.points.map((p) => `• ${p}`).join("\n")}\n\n${s.cta}`;
}

/** Opens LinkedIn's own "Start a post" box. The text is pre-filled when it is short enough for a link. */
export function composeUrl(text?: string) {
  const base = "https://www.linkedin.com/feed/?shareActive=true";
  return text && text.length < 1200 ? `${base}&text=${encodeURIComponent(text)}` : base;
}

/** Search link used when we do not hold someone's profile link. */
export const personSearchUrl = (name: string, company?: string) =>
  `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent([name, company].filter((x) => x && x !== "—").join(" "))}`;

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
