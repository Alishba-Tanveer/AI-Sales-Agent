/* ---------- Profile Optimizer ---------- */
export type SuggestionKey = "headline" | "about" | "experience" | "skills" | "featured";

export type ProfileSuggestion = {
  key: SuggestionKey;
  /** set by the backend once the person marked this change as done */
  done?: boolean;
  title: string;
  current: string;
  suggested: string;
  why: string;
  /** LinkedIn edit section used to build the "Open on LinkedIn" link */
  section: "intro" | "about" | "experience" | "skills" | "featured";
};

export type ProfileAnalysis = {
  readAt: string; // ISO date
  suggestions: ProfileSuggestion[];
  /** keys of the suggestions already marked as done */
  doneKeys: string[];
};

/** What the backend remembers from the last time the profile was read. */
export type SavedAudit = {
  profileUrl: string;
  offer: string;
  audience: string;
  analysis: ProfileAnalysis;
};

export type NicheInput = { offer: string; audience: string };

/* ---------- Content Engine ---------- */
export type ScriptStatus = "needs_approval" | "creating_video" | "ready" | "posted";

export type ContentScript = {
  id: string;
  status: ScriptStatus;
  draftNo: number;
  source: string;
  sourceUrl: string;
  date: string;
  title: string;
  hook: string;
  points: string[];
  cta: string;
  seconds: number;
  words: number;
  /** when a scheduled post goes out / when a post went live */
  scheduledFor?: string;
  postedAt?: string;
  postUrl?: string;
  /** set when we find the post was removed from LinkedIn */
  postDeleted?: boolean;
};

export type NewTopic = { topic: string };

/** Posting settings shown at the top of the Content Engine. */
export type ContentSettings = { remindAt: string; avatar: string; heygenConnected: boolean };

/* ---------- Engagement & Connections ---------- */
export type LeadSource = "engaged" | "buyer";
export type LeadStatus = "suggested" | "approved" | "pending" | "connected" | "skipped";

export type Lead = {
  id: string;
  name: string;
  role: string;
  company: string;
  source: LeadSource;
  status: LeadStatus;
  /** why they are in the list */
  reason: string;
  reasonKind: "like" | "comment" | "view" | "fit";
  note: string;
  /** their LinkedIn profile, when we have it */
  url?: string;
  sentAt?: string;
  connectedAt?: string;
};

export type OutreachStrategy = {
  agreedOn: string;
  who: string;
  perDay: number;
  message: string;
  followUpDays: number;
};
