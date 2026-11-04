## Email Automation

- Added optional Gmail mailbox connection through IMAP and SMTP.
- Added mailbox connection management to the Integrations page.
- Added encrypted mailbox credential storage using AES-256-GCM.
- Added email review and editing before approval and sending.
- Added **Approve & Send** functionality from Lead Details and Inbox.
- Added test mode using `MAIL_SEND_OVERRIDE_TO` to redirect outgoing emails to a test address.
- Added duplicate-send protection and configurable daily email limits (default: 40).
- Added Do Not Contact and archived-lead sending restrictions.
- Added automatic reply synchronization through the background worker (every two minutes by default).
- Added manual **Sync Now** functionality in Inbox.
- Added email thread matching and duplicate reply detection.
- Added AI reply-intent classification using the configured AI provider.
- Added automatic Do Not Contact handling for unsubscribe requests.
- Added AI-generated reply drafts that always require user approval before sending.
- Added notification handling for relevant replies and bounced emails.
- Preserved manual email sending and reply logging workflows.

## Inbox and Leads

- Integrated mailbox automation into Inbox and Lead Details.
- Added email approval and sending dialogs.
- Added AI intent badges to incoming messages.
- Added mailbox synchronization and automatic Inbox refresh.
- Extended frontend communication types to support mailbox reply information.

## Technical Changes

- Added the mailbox API module and frontend mailbox feature components.
- Registered mailbox routes in the API.
- Added background mailbox polling to the worker.
- Added `imapflow`, `mailparser`, and `@types/mailparser` dependencies.
- Added `ENCRYPTION_KEY`, `MAIL_SEND_OVERRIDE_TO`, and `MAIL_POLL_CRON` environment configuration.
- Added mailbox setup instructions in `apps/api/MAILBOX_AUTOMATION.md`.

## Configuration

Required environment variables:

- `ENCRYPTION_KEY`: 64-character hexadecimal encryption key.
- `AI_PROVIDER`: Set to `groq` when using Groq for AI classification and reply drafts.
- `MAIL_SEND_OVERRIDE_TO`: Optional test recipient that overrides lead email addresses.
- `MAIL_POLL_CRON`: Optional mailbox polling schedule; defaults to every two minutes.

Mailbox automation is optional and activates only after a mailbox is connected. AI-generated replies are never sent without approval.

**Security:** Never commit `.env` files, encryption keys, Gmail App Passwords, or API keys.
