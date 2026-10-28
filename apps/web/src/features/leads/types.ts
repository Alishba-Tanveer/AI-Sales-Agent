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
  stage: LeadStage;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  linkedinLead?: { id: string } | null;
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
};
