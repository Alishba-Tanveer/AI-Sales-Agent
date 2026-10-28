import { api as baseApi } from "@/lib/api";
import type { LeadCommunication } from "../leads/types";
import type { InboxItem, InboxThread } from "./types";

const api = <T,>(path: string, init?: RequestInit) => baseApi<T>(path, { keepSessionOn401: true, ...init });
const json = (value: unknown) => JSON.stringify(value);

export const fetchInbox = async (q = "") => (await api<{ messages: InboxItem[] }>(`/api/inbox${q ? `?q=${encodeURIComponent(q)}` : ""}`)).messages;
export const fetchThread = (id: string) => api<InboxThread>(`/api/inbox/${id}`);
export const recordInbound = async (input: { leadId: string; channel: "EMAIL" | "LINKEDIN"; subject?: string; body: string }) =>
  (await api<{ message: LeadCommunication }>("/api/inbox", { method: "POST", body: json(input) })).message;
export const draftReply = async (id: string, instruction?: string) =>
  (await api<{ draft: LeadCommunication }>(`/api/inbox/${id}/draft-reply`, { method: "POST", body: json({ instruction }) })).draft;
export const markReplySent = async (id: string) =>
  (await api<{ message: LeadCommunication }>(`/api/inbox/drafts/${id}/mark-sent`, { method: "POST", body: json({}) })).message;
