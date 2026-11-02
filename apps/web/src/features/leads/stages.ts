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

/** Stages a lead only reaches after you have reached out to them. Replies can only be logged for these. */
export const CONTACTED_STAGES: LeadStage[] = ["CONTACTED", "INTERESTED", "WON", "LOST"];
export const hasBeenContacted = (stage: LeadStage) => CONTACTED_STAGES.includes(stage);


export type ReplyChannel = "EMAIL" | "LINKEDIN";
/** Channels a lead has actually been messaged on, worked out from its conversation. */
export const sentChannelsOf = (communications: { channel: ReplyChannel; direction: string; status: string; subject: string | null }[] = []) =>
  [...new Set(communications.filter((m) => m.direction === "OUTBOUND" && m.status === "SENT").map((m) => m.channel))];
/** A reply can be logged on a channel you have messaged. Leads moved to Contacted by hand (nothing sent here) are accepted on either channel. */
export const canLogReplyOn = (stage: LeadStage, sentChannels: ReplyChannel[], channel: ReplyChannel) =>
  sentChannels.includes(channel) || (sentChannels.length === 0 && hasBeenContacted(stage));
export const notContactedMessage = (name: string, channel: ReplyChannel) =>
  channel === "LINKEDIN"
    ? { title: `You haven’t messaged ${name} on LinkedIn yet.`, text: "Open the lead page, connect with them on LinkedIn and mark them as connected, then draft and send a LinkedIn message. After that you can log their reply here." }
    : { title: `You haven’t emailed ${name} yet.`, text: "Open the lead page, draft an email and send it yourself, then click “I sent this”. After that you can log their reply here." };
