import type { Lead, LeadCommunication } from "../leads/types";

export type InboxItem = LeadCommunication & { lead: Lead };
export type InboxThread = { message: InboxItem; thread: LeadCommunication[] };
