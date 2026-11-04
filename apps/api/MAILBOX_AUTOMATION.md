# Email automation (send after approval + automatic replies)

Everything manual still works. The automation only switches on after you connect a mailbox
(Integrations -> Mailbox automation). Until then the app behaves exactly as before.

## 1. Install (API package, once)

    npm install imapflow mailparser
    npm install -D @types/mailparser

(`nodemailer` is already installed.)

## 2. .env (project root, next to your other keys)

    ENCRYPTION_KEY=<64 hex characters>      # required. Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    AI_PROVIDER=groq                        # use Groq first (GROQ_API_KEY must be set)
    MAIL_SEND_OVERRIDE_TO=you@your-other-address.com   # TEST MODE: every email goes here instead of the lead. Remove for real sending.
    # MAIL_POLL_CRON=*/2 * * * *            # optional, how often replies are checked

Restart the API **and** the worker (the worker does the background reply checking).

## 3. Connect the mailbox

1. Google account -> turn on 2-Step Verification -> https://myaccount.google.com/apppasswords -> create an app password.
2. Integrations -> Mailbox automation -> Connect mailbox -> email + app password -> "Test and connect".
   The login is tested over IMAP and SMTP before anything is saved. The password is stored encrypted (AES-256-GCM).

## 4. Safe end-to-end test (with MAIL_SEND_OVERRIDE_TO set)

1. Create a lead with any email, move on: lead page -> Draft email -> **Approve & send** (review / edit, then approve).
   The email arrives in your override inbox with "[TEST for lead@x]" in the subject. The lead becomes Contacted.
2. Reply to that email from your override inbox.
3. Within ~2 minutes (or press **Sync now** in the Inbox): the reply appears in the Inbox, the lead becomes Interested,
   you get a notification, the AI labels the reply (Interested / Question / ...) and writes a reply draft.
4. Open the draft in the Inbox -> **Approve & send**. It is sent in the same email thread.
5. Remove MAIL_SEND_OVERRIDE_TO and restart when you want real sending.

"Import last 7 days" (Integrations) also picks up replies to emails you sent by hand earlier.

## How it behaves

- Sending: only the "Approve & send" button sends. One draft can never be sent twice (claimed before sending).
  Daily limit per workspace (default 40, editable, max 150). Do-not-contact and archived leads are blocked.
- Replies: only headers are downloaded for new mail. A full message is read only if it answers an email this app sent
  or comes from a lead's address. Other mail is ignored. Mail is never marked read, moved or deleted.
- Matching: by the real email thread (In-Reply-To / References), then by the lead's email address.
- Out-of-office and auto-replies are skipped. Bounces create a notification for the lead.
- A reply you already pasted by hand is not added twice.
- "Please stop emailing me" moves the lead to Do not contact automatically. A polite "no" changes nothing.
- AI reply drafts are never sent without approval. Turn them off in the Mailbox card if you prefer.

## Database

Two small tables (`mailbox_connection`, `mail_link`) are created automatically on first use. No change to your
existing tables. If you use `prisma migrate dev`, it can report drift because of these two tables. In that case add
the models below to schema.prisma (they match the tables exactly), then create/baseline a migration.

    model MailboxConnection {
      organizationId String   @id @map("organization_id")
      email          String
      fromName       String?  @map("from_name")
      imapHost       String   @map("imap_host")
      imapPort       Int      @default(993) @map("imap_port")
      smtpHost       String   @map("smtp_host")
      smtpPort       Int      @default(465) @map("smtp_port")
      secret         String
      status         String   @default("connected")
      lastError      String?  @map("last_error")
      autoSync       Boolean  @default(true) @map("auto_sync")
      autoDraft      Boolean  @default(true) @map("auto_draft")
      dailyLimit     Int      @default(40) @map("daily_limit")
      lastUid        BigInt?  @map("last_uid")
      uidValidity    BigInt?  @map("uid_validity")
      lastSyncedAt   DateTime? @map("last_synced_at") @db.Timestamptz(6)
      connectedBy    String?  @map("connected_by")
      createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
      updatedAt      DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)
      @@map("mailbox_connection")
    }

    model MailLink {
      communicationId String   @id @map("communication_id")
      organizationId  String   @map("organization_id")
      leadId          String   @map("lead_id")
      direction       String
      rfcMessageId    String   @map("rfc_message_id")
      inReplyTo       String?  @map("in_reply_to")
      intent          String?
      createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
      @@unique([organizationId, rfcMessageId], map: "mail_link_msgid_uq")
      @@index([organizationId, leadId, createdAt], map: "mail_link_lead_idx")
      @@map("mail_link")
    }

## Files

Backend (new): src/modules/mailbox/* (db, parse, transport, sync, service, controller, routes, schema)
Backend (edited): app.ts (route), worker.ts (2-minute reply job), config/env.ts (2 vars), modules/inbox/inbox.service.ts (reply labels)
Frontend (new): src/features/mailbox/* (api, hook, send dialog, mailbox card, intent badge)
Frontend (edited): integrations page + ui (new card/status), lead detail page and inbox page (Approve & send, Sync now, auto-refresh), leads/types.ts
