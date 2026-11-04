export type LeadStage = "NEW" | "CONTACTED" | "INTERESTED" | "WON" | "LOST" | "DO_NOT_CONTACT";
export type Lead = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  jobTitle: string | null;
  source: string | null;
  notes: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  nextFollowUpAt: string | null;
  linkedinConnectedAt: string | null;
  stage: LeadStage;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  linkedinLead?: { id: string } | null;
  /** channels this lead has been messaged on (only set by the leads list) */
  sentChannels?: ("EMAIL" | "LINKEDIN")[];
  communications?: LeadCommunication[];
};

export type LeadCommunication = {
  id: string;
  leadId: string;
  channel: "EMAIL" | "LINKEDIN";
  direction: "INBOUND" | "OUTBOUND";
  status: "DRAFT" | "SENT" | "RECEIVED";
  subject: string | null;
  body: string;
  occurredAt: string;
  createdAt: string;
  /** what the AI understood an automatically received reply to mean (only set for synced replies) */
  intent?: string | null;
};
