import { api as baseApi } from "@/lib/api";
import type { LeadCommunication } from "../leads/types";
import type { ConnectInput, MailboxStatus, SyncResult } from "./types";

const api = <T,>(path: string, init?: RequestInit) => baseApi<T>(path, { keepSessionOn401: true, ...init });
const json = (value: unknown) => JSON.stringify(value);

export const fetchMailbox = async () => (await api<{ mailbox: MailboxStatus }>("/api/mailbox")).mailbox;
export const connectMailbox = async (input: ConnectInput) => (await api<{ mailbox: MailboxStatus }>("/api/mailbox/connect", { method: "POST", body: json(input) })).mailbox;
export const saveMailboxSettings = async (patch: { autoSync?: boolean; autoDraft?: boolean; dailyLimit?: number; fromName?: string }) =>
  (await api<{ mailbox: MailboxStatus }>("/api/mailbox/settings", { method: "PATCH", body: json(patch) })).mailbox;
export const disconnectMailbox = () => api<{ connected: false }>("/api/mailbox", { method: "DELETE" });
export const syncMailboxNow = (lookbackDays?: number) =>
  api<{ result: SyncResult; mailbox: MailboxStatus }>("/api/mailbox/sync", { method: "POST", body: json({ lookbackDays }) });
/** Approve & send: the backend sends the (optionally edited) draft from the connected mailbox. */
export const approveAndSend = (id: string, edits: { subject?: string; body?: string }) =>
  api<{ message: LeadCommunication; redirectedTo: string | null }>(`/api/mailbox/drafts/${id}/send`, { method: "POST", body: json(edits) });
