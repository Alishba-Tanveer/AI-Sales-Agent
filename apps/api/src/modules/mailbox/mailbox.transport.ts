import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { AppError } from "../../utils/app-error";

export type MailboxCredentials = {
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
};

export const GMAIL_DEFAULTS = { imapHost: "imap.gmail.com", imapPort: 993, smtpHost: "smtp.gmail.com", smtpPort: 465 } as const;

export function createImapClient(c: MailboxCredentials) {
  const client = new ImapFlow({
    host: c.imapHost,
    port: c.imapPort,
    secure: c.imapPort === 993,
    auth: { user: c.email, pass: c.password },
    logger: false,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 90_000,
  });
  // imapflow emits "error" for dropped sockets; without a listener Node would crash the whole process.
  client.on("error", (error: Error) => console.warn("[mailbox] IMAP connection error:", error.message));
  return client;
}

export function createSmtpTransport(c: MailboxCredentials) {
  return nodemailer.createTransport({
    host: c.smtpHost,
    port: c.smtpPort,
    secure: c.smtpPort === 465,
    auth: { user: c.email, pass: c.password },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 40_000,
  });
}

/** Turns a low-level mail error into something a person can act on. */
export function friendlyMailError(error: unknown, action: "login" | "send" | "read"): string {
  const e = error as { message?: string; code?: string; responseText?: string; authenticationFailed?: boolean; responseCode?: number };
  const text = `${e?.responseText ?? ""} ${e?.message ?? ""}`;
  if (e?.authenticationFailed || e?.code === "EAUTH" || /invalid credentials|authentication failed|AUTHENTICATIONFAILED|username and password not accepted/i.test(text)) {
    return "The mailbox rejected the login. For Gmail, turn on 2-Step Verification and use a 16-character App Password (not your normal password).";
  }
  if (e?.code === "ENOTFOUND" || e?.code === "EAI_AGAIN") return "Could not find the mail server. Check the server address and the internet connection.";
  if (e?.code === "ETIMEDOUT" || e?.code === "ESOCKET" || e?.code === "ECONNECTION" || e?.code === "ECONNREFUSED" || /timed? ?out/i.test(text)) {
    return "Could not reach the mail server (timed out or refused). Check the server and port, and that your network allows mail traffic.";
  }
  if (action === "send" && (e?.responseCode === 550 || e?.responseCode === 552 || e?.responseCode === 554)) return `The mail server refused the message: ${(e.responseText ?? e.message ?? "").toString().slice(0, 200)}`;
  return `${action === "login" ? "Could not log in" : action === "send" ? "Could not send the email" : "Could not read the mailbox"}: ${(e?.message ?? "unknown error").slice(0, 200)}`;
}

/** Logs in over IMAP and SMTP once, so a wrong password or server is reported before anything is saved. */
export async function verifyMailbox(c: MailboxCredentials): Promise<void> {
  const imap = createImapClient(c);
  try {
    await imap.connect();
    await imap.logout();
  } catch (error) {
    try { imap.close(); } catch { /* already closed */ }
    throw new AppError(`Reading mail (IMAP): ${friendlyMailError(error, "login")}`, 422, { code: "MAILBOX_IMAP" });
  }
  try {
    await createSmtpTransport(c).verify();
  } catch (error) {
    throw new AppError(`Sending mail (SMTP): ${friendlyMailError(error, "login")}`, 422, { code: "MAILBOX_SMTP" });
  }
}

export async function sendEmail(input: {
  creds: MailboxCredentials;
  fromName?: string | null;
  to: string;
  subject: string;
  text: string;
  messageId: string;
  inReplyTo?: string | null;
  references?: string[];
}): Promise<void> {
  const transport = createSmtpTransport(input.creds);
  try {
    await transport.sendMail({
      from: input.fromName ? { name: input.fromName, address: input.creds.email } : input.creds.email,
      to: input.to,
      subject: input.subject,
      text: input.text,
      messageId: input.messageId,
      ...(input.inReplyTo ? { inReplyTo: input.inReplyTo } : {}),
      ...(input.references?.length ? { references: input.references } : {}),
    });
  } finally {
    transport.close();
  }
}
