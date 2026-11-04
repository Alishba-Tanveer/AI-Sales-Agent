/** Small, dependency-free helpers for reading email headers and cleaning reply text. */

/** Parses a raw header block (as returned by IMAP) into lowercase-name -> value. */
export function parseHeaderBlock(raw: Buffer | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  const unfolded = raw.toString("utf8").replace(/\r?\n[ \t]+/g, " ");
  for (const line of unfolded.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const name = line.slice(0, i).trim().toLowerCase();
    if (!out[name]) out[name] = line.slice(i + 1).trim();
  }
  return out;
}

/** Every <message-id> in an In-Reply-To / References header. */
export function extractMessageIds(value?: string | null): string[] {
  if (!value) return [];
  return [...new Set(value.match(/<[^<>\s]+>/g) ?? [])];
}

export type AutoKind = "bounce" | "auto" | null;

/** Delivery-failure notices and out-of-office / automatic replies are not real replies from a person. */
export function classifyAutomatic(input: { headers: Record<string, string>; from: string; subject: string }): AutoKind {
  const from = input.from.toLowerCase();
  const subject = input.subject.toLowerCase();
  if (/^(mailer-daemon|postmaster)@/.test(from) || /^(undeliverable|delivery status notification|mail delivery (failed|subsystem)|returned mail)/.test(subject)) return "bounce";
  const auto = input.headers["auto-submitted"]?.toLowerCase();
  if (auto && auto !== "no") return "auto";
  if (/^(bulk|junk|auto_reply|list)$/i.test(input.headers["precedence"] ?? "")) return "auto";
  if (input.headers["x-autoreply"] || input.headers["x-autorespond"] || input.headers["x-auto-response-suppress"]) return "auto";
  if (/^(automatic reply|auto(matic)?[- ]?reply|out of office|autoreply)/.test(subject)) return "auto";
  return null;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n")
    .trim();
}

const WROTE = /^(on|le|el|am|il)\s[\s\S]{5,300}?(wrote|a écrit|escribió|schrieb|ha scritto)\s*:?\s*$/i;

/**
 * Keeps only what the person newly wrote: cuts the quoted history that mail apps append
 * ("On Tue, ... wrote:", "-----Original Message-----", Outlook "From: / Sent:" blocks, lines starting with ">").
 * If cutting would leave nothing, the whole text is returned unchanged.
 */
export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let cut = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const joined = [line, lines[i + 1]?.trim() ?? "", lines[i + 2]?.trim() ?? ""].join(" ").trim();
    if (
      (/^(on|le|el|am|il)\s/i.test(line) && WROTE.test(joined.slice(0, 400))) ||
      /^-{2,}\s*(original message|forwarded message)\s*-{2,}$/i.test(line) ||
      /^_{10,}$/.test(line) ||
      (/^from:\s.+/i.test(line) && lines.slice(i + 1, i + 5).some((l) => /^(sent|date):/i.test(l.trim()))) ||
      (line.startsWith(">") && i > 0)
    ) { cut = i; break; }
  }
  const kept = lines.slice(0, cut).join("\n").trim();
  return kept || text.trim();
}

/** Lowercase letters/digits only: used to notice when a reply was already pasted into the app by hand. */
export const normalizeForCompare = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 400);
