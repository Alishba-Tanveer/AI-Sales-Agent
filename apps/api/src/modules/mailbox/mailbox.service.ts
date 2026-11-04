import { randomUUID } from "node:crypto";
import { LeadStage, prisma } from "@ai-sales-agent/database";
import { z } from "zod";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { sealSecret } from "../../utils/secret-box";
import { trackActivity } from "../activity/activity-logger";
import { mailboxDb } from "./mailbox.db";
import { credentialsOf, syncMailbox } from "./mailbox.sync";
import { GMAIL_DEFAULTS, friendlyMailError, sendEmail, verifyMailbox } from "./mailbox.transport";

const emailCheck = z.string().email();
const lastSyncRequest = new Map<string, number>();
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

export class MailboxService {
  async status(organizationId: string) {
    const conn = await mailboxDb.get(organizationId);
    const override = env.MAIL_SEND_OVERRIDE_TO ?? null;
    if (!conn) return { connected: false as const, testRedirectTo: override };
    const sentToday = await prisma.leadCommunication.count({ where: { organizationId, channel: "EMAIL", direction: "OUTBOUND", status: "SENT", occurredAt: { gte: startOfToday() } } });
    return {
      connected: true as const,
      email: conn.email,
      fromName: conn.fromName,
      status: conn.status,
      lastError: conn.lastError,
      lastSyncedAt: conn.lastSyncedAt,
      autoSync: conn.autoSync,
      autoDraft: conn.autoDraft,
      dailyLimit: conn.dailyLimit,
      sentToday,
      testRedirectTo: override,
    };
  }

  async connect(organizationId: string, userId: string, input: { email: string; password: string; fromName?: string; imapHost?: string; imapPort?: number; smtpHost?: string; smtpPort?: number }) {
    if (!/^[0-9a-f]{64}$/i.test(env.ENCRYPTION_KEY ?? "")) {
      throw new AppError("Set ENCRYPTION_KEY (64 hexadecimal characters) in the project .env file and restart the API. The mailbox password is stored encrypted with it.", 500, { code: "ENCRYPTION_KEY_MISSING" });
    }
    const creds = {
      email: input.email,
      // Google shows App Passwords in groups of four with spaces; they only work without them.
      password: input.password.replace(/\s+/g, ""),
      imapHost: input.imapHost ?? GMAIL_DEFAULTS.imapHost,
      imapPort: input.imapPort ?? GMAIL_DEFAULTS.imapPort,
      smtpHost: input.smtpHost ?? GMAIL_DEFAULTS.smtpHost,
      smtpPort: input.smtpPort ?? GMAIL_DEFAULTS.smtpPort,
    };
    await verifyMailbox(creds);
    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
    await mailboxDb.upsert({
      organizationId, email: creds.email, fromName: input.fromName?.trim() || organization?.name || null,
      imapHost: creds.imapHost, imapPort: creds.imapPort, smtpHost: creds.smtpHost, smtpPort: creds.smtpPort,
      secret: sealSecret(creds.password), connectedBy: userId,
    });
    return this.status(organizationId);
  }

  async updateSettings(organizationId: string, input: { autoSync?: boolean; autoDraft?: boolean; dailyLimit?: number; fromName?: string }) {
    if (!(await mailboxDb.get(organizationId))) throw new AppError("No mailbox is connected yet.", 409);
    await mailboxDb.updateSettings(organizationId, { ...input, fromName: input.fromName === undefined ? undefined : input.fromName.trim() || null });
    return this.status(organizationId);
  }

  async disconnect(organizationId: string) {
    await mailboxDb.remove(organizationId);
    return { connected: false };
  }

  async syncNow(organizationId: string, lookbackDays?: number) {
    const last = lastSyncRequest.get(organizationId) ?? 0;
    if (Date.now() - last < 8_000) throw new AppError("Just synced. Wait a few seconds and try again.", 429);
    lastSyncRequest.set(organizationId, Date.now());
    return syncMailbox(organizationId, { lookbackDays });
  }

  /**
   * Sends one approved email draft from the connected mailbox.
   * The person has reviewed the text (and may have edited it) and pressed "Approve & send". Nothing else sends mail.
   */
  async sendDraft(organizationId: string, communicationId: string, edits: { subject?: string; body?: string }) {
    const conn = await mailboxDb.get(organizationId);
    if (!conn) throw new AppError("Connect your mailbox on the Integrations page first, or send this draft yourself and click “I sent this”.", 409, { code: "MAILBOX_NOT_CONNECTED" });
    if (conn.status === "error") throw new AppError("The mailbox login stopped working. Reconnect it on the Integrations page.", 409, { code: "MAILBOX_ERROR" });

    const draft = await prisma.leadCommunication.findFirst({ where: { id: communicationId, organizationId, direction: "OUTBOUND", status: "DRAFT", channel: "EMAIL" }, include: { lead: true } });
    if (!draft) throw new AppError("This draft was not found, or it was already sent.", 404);
    const lead = draft.lead;
    if (lead.archivedAt) throw new AppError("This lead is archived.", 409);
    if (lead.stage === LeadStage.DO_NOT_CONTACT) throw new AppError("This lead is marked Do not contact. Nothing was sent.", 409);
    const leadEmail = lead.email?.trim();
    if (!leadEmail || !emailCheck.safeParse(leadEmail).success) throw new AppError("This lead has no valid email address. Add one on the lead page first.", 422);

    const subject = (edits.subject ?? draft.subject ?? "").trim();
    const body = (edits.body ?? draft.body).trim();
    if (!subject) throw new AppError("The email needs a subject.", 422);
    if (!body) throw new AppError("The email needs a message.", 422);

    const sentToday = await prisma.leadCommunication.count({ where: { organizationId, channel: "EMAIL", direction: "OUTBOUND", status: "SENT", occurredAt: { gte: startOfToday() } } });
    if (sentToday >= conn.dailyLimit) throw new AppError(`Daily sending limit reached (${conn.dailyLimit}). It keeps your mailbox safe from being flagged as spam. Raise it on the Integrations page, or try tomorrow.`, 429, { code: "DAILY_LIMIT" });

    // Reply in the same email thread when there is one.
    const thread = await mailboxDb.threadMessageIds(organizationId, lead.id);
    const inReplyTo = thread.length ? thread[thread.length - 1] : null;
    const domain = conn.email.split("@")[1] || "localhost";
    const messageId = `<${randomUUID()}@${domain}>`;

    const claimed = await mailboxDb.claimOutbound({ communicationId, organizationId, leadId: lead.id, messageId, inReplyTo });
    if (!claimed) throw new AppError("This draft was already sent or is being sent. Check your Sent folder before trying again.", 409);

    // Safe testing: with MAIL_SEND_OVERRIDE_TO set, every email goes to that address instead of the lead.
    const redirect = env.MAIL_SEND_OVERRIDE_TO ?? null;
    const to = redirect ?? leadEmail;
    const outSubject = redirect ? `[TEST for ${leadEmail}] ${subject}` : subject;

    return trackActivity({
      organizationId, agent: "General Agent", kind: "followup", title: `Send email: ${lead.name}`, leadName: lead.name, context: lead.company ?? "",
      run: async () => {
        try {
          await sendEmail({ creds: credentialsOf(conn), fromName: conn.fromName, to, subject: outSubject, text: body, messageId, inReplyTo, references: thread });
        } catch (error) {
          await mailboxDb.releaseOutbound(communicationId).catch(() => {});
          throw new AppError(friendlyMailError(error, "send"), 502, { code: "MAILBOX_SEND" });
        }
        // The email is out. From here on a failure must never allow a second send, so the claim stays.
        const sent = await prisma.$transaction(async (tx) => {
          const row = await tx.leadCommunication.update({ where: { id: communicationId }, data: { status: "SENT", occurredAt: new Date(), subject, body } });
          const current = await tx.lead.findFirst({ where: { id: lead.id, organizationId } });
          if (current && current.stage === LeadStage.NEW) await tx.lead.update({ where: { id: current.id }, data: { stage: LeadStage.CONTACTED } });
          return row;
        });
        return { message: sent, redirectedTo: redirect };
      },
      output: (r) => `Email sent to ${r.redirectedTo ? `${r.redirectedTo} (test redirect for ${leadEmail})` : leadEmail} after approval.`,
    });
  }
}

export const mailboxService = new MailboxService();
