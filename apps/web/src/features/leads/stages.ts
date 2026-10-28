import type { LeadStage } from "./types";

/**
 * Neighbouring stages never share a hue family (no purples, one red). Hues match the "Leads by stage" chart on the Overview page so a stage
 * has the same colour everywhere in the app.
 */
export const STAGE_META: Record<LeadStage, { label: string; color: string }> = {
  NEW: { label: "New", color: "#38BDF8" },
  CONTACTED: { label: "Contacted", color: "#FBBF24" },
  INTERESTED: { label: "Interested", color: "#F472B6" },
  WON: { label: "Won", color: "#4ADE80" },
  LOST: { label: "Lost", color: "#94A3B8" },
  DO_NOT_CONTACT: { label: "Do not contact", color: "#F87171" },
};

export const STAGE_ORDER: LeadStage[] = ["NEW", "CONTACTED", "INTERESTED", "WON", "LOST", "DO_NOT_CONTACT"];
export const stageLabel = (stage: LeadStage) => STAGE_META[stage].label;
