import type { Lead, LeadCommunication } from "../leads/types";

export type InboxItem = LeadCommunication & { lead: Lead; /** how many replies this person has sent (one conversation per person) */ threadReplyCount?: number };
export type InboxThread = { message: InboxItem; thread: LeadCommunication[] };
