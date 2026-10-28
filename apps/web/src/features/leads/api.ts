import { api as baseApi } from "@/lib/api";
import type { Lead, LeadCommunication, LeadStage } from "./types";

const api = <T,>(path: string, init?: RequestInit) => baseApi<T>(path, { keepSessionOn401: true, ...init });
const json = (value: unknown) => JSON.stringify(value);

export type LeadInput = {
  name: string;
  email?: string;
  company?: string;
  jobTitle?: string;
  source?: string;
  notes?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  nextFollowUpAt?: string;
  stage?: LeadStage;
};
export const fetchLeads = (q = "", stage?: LeadStage) => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (stage) params.set("stage", stage);
  return api<{ leads: Lead[]; total: number; counts: Partial<Record<LeadStage, number>> }>(`/api/leads?${params}`);
};
export const createLead = async (input: LeadInput) => (await api<{ lead: Lead }>("/api/leads", { method: "POST", body: json(input) })).lead;
export const importLeads = (leads: LeadInput[]) => api<{ importedCount: number; leads: Lead[] }>("/api/leads/import", { method: "POST", body: json({ leads }) });
export const fetchLead = async (id: string) => (await api<{ lead: Lead }>(`/api/leads/${id}`)).lead;
export const updateLead = async (id: string, patch: Partial<LeadInput>) => (await api<{ lead: Lead }>(`/api/leads/${id}`, { method: "PATCH", body: json(patch) })).lead;
export const archiveLead = (id: string) => api<{ archived: boolean }>(`/api/leads/${id}`, { method: "DELETE" });
export const draftEmail = async (id: string, instruction?: string) => (await api<{ draft: LeadCommunication }>(`/api/leads/${id}/draft-email`, { method: "POST", body: json({ instruction }) })).draft;
