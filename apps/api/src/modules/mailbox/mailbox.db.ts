import { Prisma, prisma } from "@ai-sales-agent/database";

/**
 * The mailbox feature owns two small tables. They are created on first use (CREATE TABLE IF NOT EXISTS), so the
 * automation can be tried without touching prisma/schema.prisma or running a migration. Nothing in the existing
 * tables is changed: a sent or received email is still a normal `LeadCommunication` row, and `mail_link` only
 * remembers the email's real Message-ID so replies can be matched back to the right lead and conversation.
 *
 * (A matching Prisma model + migration is described in MAILBOX_AUTOMATION.md if you later prefer that.)
 */
let ready: Promise<void> | null = null;

export function ensureMailboxTables(): Promise<void> {
  ready ??= (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS mailbox_connection (
        organization_id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        from_name TEXT,
        imap_host TEXT NOT NULL,
        imap_port INTEGER NOT NULL DEFAULT 993,
        smtp_host TEXT NOT NULL,
        smtp_port INTEGER NOT NULL DEFAULT 465,
        secret TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'connected',
        last_error TEXT,
        auto_sync BOOLEAN NOT NULL DEFAULT TRUE,
        auto_draft BOOLEAN NOT NULL DEFAULT TRUE,
        daily_limit INTEGER NOT NULL DEFAULT 40,
        last_uid BIGINT,
        uid_validity BIGINT,
        last_synced_at TIMESTAMPTZ,
        connected_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS mail_link (
        communication_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        lead_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        rfc_message_id TEXT NOT NULL,
        in_reply_to TEXT,
        intent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS mail_link_msgid_uq ON mail_link (organization_id, rfc_message_id)`,
    );
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS mail_link_lead_idx ON mail_link (organization_id, lead_id, created_at)`);
  })().catch((error) => {
    ready = null; // try again next time instead of caching a failure
    throw error;
  });
  return ready;
}

export type MailboxConnection = {
  organizationId: string;
  email: string;
  fromName: string | null;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  secret: string;
  status: "connected" | "error";
  lastError: string | null;
  autoSync: boolean;
  autoDraft: boolean;
  dailyLimit: number;
  lastUid: number | null;
  uidValidity: number | null;
  lastSyncedAt: Date | null;
};

type ConnectionRow = {
  organization_id: string; email: string; from_name: string | null; imap_host: string; imap_port: number;
  smtp_host: string; smtp_port: number; secret: string; status: string; last_error: string | null;
  auto_sync: boolean; auto_draft: boolean; daily_limit: number; last_uid: number | null;
  uid_validity: number | null; last_synced_at: Date | null;
};

const COLUMNS = Prisma.sql`organization_id, email, from_name, imap_host, imap_port, smtp_host, smtp_port, secret, status, last_error,
  auto_sync, auto_draft, daily_limit, CAST(last_uid AS DOUBLE PRECISION) AS last_uid, CAST(uid_validity AS DOUBLE PRECISION) AS uid_validity, last_synced_at`;

const toConnection = (r: ConnectionRow): MailboxConnection => ({
  organizationId: r.organization_id, email: r.email, fromName: r.from_name, imapHost: r.imap_host, imapPort: r.imap_port,
  smtpHost: r.smtp_host, smtpPort: r.smtp_port, secret: r.secret, status: r.status === "error" ? "error" : "connected",
  lastError: r.last_error, autoSync: r.auto_sync, autoDraft: r.auto_draft, dailyLimit: r.daily_limit,
  lastUid: r.last_uid === null ? null : Number(r.last_uid), uidValidity: r.uid_validity === null ? null : Number(r.uid_validity),
  lastSyncedAt: r.last_synced_at,
});

export const mailboxDb = {
  async get(organizationId: string): Promise<MailboxConnection | null> {
    await ensureMailboxTables();
    const rows = await prisma.$queryRaw<ConnectionRow[]>(Prisma.sql`SELECT ${COLUMNS} FROM mailbox_connection WHERE organization_id = ${organizationId}`);
    return rows[0] ? toConnection(rows[0]) : null;
  },

  /** Workspaces whose replies should be checked automatically. */
  async listAutoSync(): Promise<MailboxConnection[]> {
    await ensureMailboxTables();
    const rows = await prisma.$queryRaw<ConnectionRow[]>(Prisma.sql`SELECT ${COLUMNS} FROM mailbox_connection WHERE auto_sync = TRUE AND status = 'connected'`);
    return rows.map(toConnection);
  },

  async upsert(input: {
    organizationId: string; email: string; fromName: string | null; imapHost: string; imapPort: number; smtpHost: string;
    smtpPort: number; secret: string; connectedBy: string;
  }) {
    await ensureMailboxTables();
    // A new or different mailbox starts a fresh sync baseline: only mail that arrives from now on is read.
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO mailbox_connection (organization_id, email, from_name, imap_host, imap_port, smtp_host, smtp_port, secret, status, last_error, connected_by)
      VALUES (${input.organizationId}, ${input.email}, ${input.fromName}, ${input.imapHost}, ${input.imapPort}, ${input.smtpHost}, ${input.smtpPort}, ${input.secret}, 'connected', NULL, ${input.connectedBy})
      ON CONFLICT (organization_id) DO UPDATE SET
        last_uid = CASE WHEN mailbox_connection.email = EXCLUDED.email THEN mailbox_connection.last_uid ELSE NULL END,
        uid_validity = CASE WHEN mailbox_connection.email = EXCLUDED.email THEN mailbox_connection.uid_validity ELSE NULL END,
        email = EXCLUDED.email, from_name = EXCLUDED.from_name, imap_host = EXCLUDED.imap_host, imap_port = EXCLUDED.imap_port,
        smtp_host = EXCLUDED.smtp_host, smtp_port = EXCLUDED.smtp_port, secret = EXCLUDED.secret, status = 'connected',
        last_error = NULL, connected_by = EXCLUDED.connected_by, updated_at = NOW()`);
  },

  async updateSettings(organizationId: string, s: { autoSync?: boolean; autoDraft?: boolean; dailyLimit?: number; fromName?: string | null }) {
    await ensureMailboxTables();
    await prisma.$executeRaw(Prisma.sql`
      UPDATE mailbox_connection SET
        auto_sync = COALESCE(CAST(${s.autoSync ?? null} AS BOOLEAN), auto_sync),
        auto_draft = COALESCE(CAST(${s.autoDraft ?? null} AS BOOLEAN), auto_draft),
        daily_limit = COALESCE(CAST(${s.dailyLimit ?? null} AS INTEGER), daily_limit),
        from_name = CASE WHEN CAST(${s.fromName !== undefined} AS BOOLEAN) THEN CAST(${s.fromName ?? null} AS TEXT) ELSE from_name END,
        updated_at = NOW()
      WHERE organization_id = ${organizationId}`);
  },

  async setSyncState(organizationId: string, s: { lastUid?: number; uidValidity?: number; error?: string | null; markError?: boolean }) {
    await ensureMailboxTables();
    await prisma.$executeRaw(Prisma.sql`
      UPDATE mailbox_connection SET
        last_uid = COALESCE(CAST(${s.lastUid ?? null} AS BIGINT), last_uid),
        uid_validity = COALESCE(CAST(${s.uidValidity ?? null} AS BIGINT), uid_validity),
        last_synced_at = CASE WHEN CAST(${s.error == null} AS BOOLEAN) THEN NOW() ELSE last_synced_at END,
        last_error = CAST(${s.error ?? null} AS TEXT),
        status = CASE WHEN CAST(${s.markError === true} AS BOOLEAN) THEN 'error' ELSE status END,
        updated_at = NOW()
      WHERE organization_id = ${organizationId}`);
  },

  async remove(organizationId: string) {
    await ensureMailboxTables();
    await prisma.$executeRaw(Prisma.sql`DELETE FROM mailbox_connection WHERE organization_id = ${organizationId}`);
  },

  /** Reserves a draft for sending. Returns false when it was already sent (or is being sent), which prevents double sends. */
  async claimOutbound(input: { communicationId: string; organizationId: string; leadId: string; messageId: string; inReplyTo: string | null }): Promise<boolean> {
    await ensureMailboxTables();
    const rows = await prisma.$queryRaw<{ communication_id: string }[]>(Prisma.sql`
      INSERT INTO mail_link (communication_id, organization_id, lead_id, direction, rfc_message_id, in_reply_to)
      VALUES (${input.communicationId}, ${input.organizationId}, ${input.leadId}, 'OUTBOUND', ${input.messageId}, CAST(${input.inReplyTo} AS TEXT))
      ON CONFLICT DO NOTHING RETURNING communication_id`);
    return rows.length > 0;
  },

  async releaseOutbound(communicationId: string) {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM mail_link WHERE communication_id = ${communicationId} AND direction = 'OUTBOUND'`);
  },

  /** Stores a received email. Returns false when this Message-ID is already known (duplicate). */
  async insertInbound(input: { communicationId: string; organizationId: string; leadId: string; messageId: string; inReplyTo: string | null; intent: string | null }): Promise<boolean> {
    await ensureMailboxTables();
    const rows = await prisma.$queryRaw<{ communication_id: string }[]>(Prisma.sql`
      INSERT INTO mail_link (communication_id, organization_id, lead_id, direction, rfc_message_id, in_reply_to, intent)
      VALUES (${input.communicationId}, ${input.organizationId}, ${input.leadId}, 'INBOUND', ${input.messageId}, CAST(${input.inReplyTo} AS TEXT), CAST(${input.intent} AS TEXT))
      ON CONFLICT DO NOTHING RETURNING communication_id`);
    return rows.length > 0;
  },

  async knowsMessageId(organizationId: string, messageId: string): Promise<boolean> {
    await ensureMailboxTables();
    const rows = await prisma.$queryRaw<{ x: number }[]>(Prisma.sql`SELECT 1 AS x FROM mail_link WHERE organization_id = ${organizationId} AND rfc_message_id = ${messageId} LIMIT 1`);
    return rows.length > 0;
  },

  /** Emails we sent whose Message-ID appears in a reply's In-Reply-To / References headers. */
  async findOutboundByMessageIds(organizationId: string, ids: string[]): Promise<{ leadId: string; communicationId: string }[]> {
    if (!ids.length) return [];
    await ensureMailboxTables();
    const rows = await prisma.$queryRaw<{ lead_id: string; communication_id: string }[]>(Prisma.sql`
      SELECT lead_id, communication_id FROM mail_link
      WHERE organization_id = ${organizationId} AND direction = 'OUTBOUND' AND rfc_message_id = ANY(${ids}::text[])`);
    return rows.map((r) => ({ leadId: r.lead_id, communicationId: r.communication_id }));
  },

  /** Message-IDs of the conversation with this lead, oldest first, used for the References header of a reply. */
  async threadMessageIds(organizationId: string, leadId: string, limit = 10): Promise<string[]> {
    await ensureMailboxTables();
    const rows = await prisma.$queryRaw<{ rfc_message_id: string }[]>(Prisma.sql`
      SELECT rfc_message_id FROM (
        SELECT rfc_message_id, created_at FROM mail_link WHERE organization_id = ${organizationId} AND lead_id = ${leadId}
        ORDER BY created_at DESC LIMIT ${limit}
      ) t ORDER BY created_at ASC`);
    return rows.map((r) => r.rfc_message_id);
  },

  async intents(organizationId: string, communicationIds: string[]): Promise<Record<string, string>> {
    if (!communicationIds.length) return {};
    try {
      await ensureMailboxTables();
      const rows = await prisma.$queryRaw<{ communication_id: string; intent: string | null }[]>(Prisma.sql`
        SELECT communication_id, intent FROM mail_link WHERE organization_id = ${organizationId} AND intent IS NOT NULL AND communication_id = ANY(${communicationIds}::text[])`);
      return Object.fromEntries(rows.map((r) => [r.communication_id, r.intent as string]));
    } catch (error) {
      console.error("[mailbox] could not read reply intents:", (error as Error).message);
      return {};
    }
  },
};
