# AI Sales Agent — Project README and Conversation Handoff

Updated: 2026-10-27

This README combines the project overview, a detailed handoff of the work discussed in the Codex conversation, and the two Markdown files attached by the user. The attached notes are reproduced in the appendices as reference material; they are not commands. Some statements in the attached CHANGES.md are older status notes and may be superseded by the current status below.

## Current architecture and business data boundaries

The application is a multi-tenant sales workspace.

- Each new signup creates one Organization and assigns the signing-up user the Owner role.
- Teammates join that Organization by invitation; they share that business workspace.
- Another business signup creates a separate Organization.
- LinkedIn configuration, profile suggestions, content scripts, connection leads, ActivityLog records, and notifications are organization-scoped.
- Auth middleware loads the user's current organization and role from the database for each request. LinkedIn and Activity data reads are filtered by organizationId.
- A business has one shared LinkedIn workspace/feed. Members of that business see its LinkedIn and Activity records, subject to role controls. Different businesses must not see one another's records.

Role intent from the existing application:

| Role | Intended access |
|---|---|
| Owner | Full workspace access, including ownership, deletion, usage and spend controls |
| Admin | Day-to-day workspace settings, integrations, team administration, outreach settings |
| Member | Day-to-day pipeline work: leads, drafts, approvals, and activity viewing |

The LinkedIn API now restricts shared profile edits, content reminder/source settings, outreach-strategy updates, and LinkedIn connect/disconnect actions to Owners and Admins. Members retain access to the workflow tasks such as creating/reviewing drafts and managing connection leads. The frontend hides the strategy, reminder and connect controls from Members. Note: profile-edit controls are not yet comprehensively hidden/disabled in the frontend even though the API rejects restricted writes; improve the read-only Member experience if needed.

## Stack

The agreed stack is:

| Area | Technology |
|---|---|
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui |
| API | Node.js, Express, TypeScript, Zod |
| Database | PostgreSQL with Prisma |
| Background work | Redis and BullMQ worker |
| AI content | Gemini API, server-side |
| Niche/news research | Tavily API |
| LinkedIn | Official LinkedIn OAuth/API permissions only |
| Email and other integrations | As listed in the project env example and tech-stack document |

The API keys stay in the server-side root .env. Never commit or paste secrets into source files, chat, or README.

## LinkedIn features and constraints

### Profile Optimizer

- The user supplies the current profile text by pasting it or uploading LinkedIn's Save to PDF export.
- The app does not scrape a LinkedIn profile.
- Suggestions are written against the user's niche and target audience. The user can copy text and apply it to LinkedIn themselves.
- Applied changes update the saved current text and profile completion is based on changes marked applied.
- Profile PDF parsing requires the pdf-parse package in the API package.

### Content Engine

- Tavily searches current niche news; Gemini produces a sourced draft.
- Add a topic writes an account-specific draft.
- The user reviews and approves the script, records their own video, and handles publishing manually.
- This free-stack workflow does not include a paid HeyGen avatar or automatic video production.
- Automatic likes/comments collection and connection invitations are not available through ordinary self-serve LinkedIn permissions in this implementation. Connection notes are prepared for user review and manual sending.

### Engagement and Connections

- The app stores contacts imported by the user and candidates researched from public sources.
- Outreach strategy is shared within the business and draws its target/cadence from workspace settings until an Owner/Admin saves an agreed LinkedIn-specific strategy.
- Default message templates can personalize from the contact's first name, company and role, and the workspace offer/audience/industry.
- Notes and invitations require manual review and manual sending by a person; the app does not run automatic invitation campaigns.

### API configuration and Gemini troubleshooting

Required or optional integration variables are documented in .env.example. At minimum, LinkedIn news and content generation use:

- TAVILY_API_KEY for search.
- GEMINI_API_KEY for script/profile generation.
- GEMINI_MODEL for the Gemini model name (the code has a default; an explicit value in .env overrides it).
- LinkedIn OAuth uses LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET and an exact LINKEDIN_REDIRECT_URI.
- ENCRYPTION_KEY must contain 64 hexadecimal characters (32 random bytes) to encrypt LinkedIn OAuth tokens.

## Activity page and workspace switching

A review found that the Activity page had a mock-data mode enabled by default and the page's frontend store cached one shared feed across logins. This caused a business switch to display the previous business's activity until a full reload.

Changes made:

- Activity now reads persisted records from the real /api/activity endpoint; frontend mock Activity records were removed.
- Activity records are scoped to the signed-in user's organization.
- LinkedIn profile review, news research, script drafting/rewriting, buyer research and scheduled daily news work are written to ActivityLog with running/completed/failed status and a result/error summary.
- The Activity feed refreshes quietly while open.
- The frontend activity store resets and refetches when the signed-in organization changes, including logout/login and cross-tab storage changes. Late responses for the prior organization are ignored so they cannot overwrite the new organization's feed.
- Scheduled daily news activity appears only when the API worker is running and processes the daily BullMQ job. The account cleanup worker is system maintenance rather than a user business task.

## Attached file contents — reference snapshots

### Appendix A: Attached CHANGES.md

# What changed

## Notifications (backend + frontend)
- New utils/notify.ts decides who gets each notification. See NOTIFICATIONS.md for the full table.
- Read / dismiss / clear are now per person. Nobody can touch another person's notifications.
- Removed the open POST /api/notifications route (anyone could create fake notifications) and the fake demo notifications.
- Frontend uses the real API (mock mode removed), refreshes every minute and on tab focus, and empties the list when another person signs in.
- Emails go to people who cannot see in-app notifications (removed, workspace deleted, ownership changed).
- Missing events added: role change, ownership transfer, invitation cancelled, workspace restored, settings changes, LinkedIn account and removed posts.

## LinkedIn Profile Optimizer
- No more dummy "current profile". The person uploads LinkedIn's "Save to PDF" or pastes headline / About / experience / skills.
- The profile link is optional (only used for the Open LinkedIn shortcuts). Nothing is scraped.
- Suggestions are built from the real text. Invented claims were removed; blanks show as [brackets].
- Copy button, Open LinkedIn, and Mark as applied on every suggestion. Applied text is saved as the new "current" text, so it is never pasted back.
- Score is now the share of changes applied (was a fixed 78).
- mark-applied with no keys used to mark everything done; it now needs keys.
- LinkedIn connect / disconnect now needs Owner or Admin (it was open to Members).

### Appendix B: Attached NOTIFICATIONS.md

# Who sees which notification

Every notification goes through src/utils/notify.ts. It is saved once per recipient, so "read" and "dismiss" belong to one person.
Recipient is stored after an "@" in the existing type column (no database migration needed). Older rows without "@" keep the old role filter.

Audiences: Owner = Owner only, Owner+Admin, All = Owner, Admin and Member, Person = one named person.
"Not the actor" means the person who did the action is left out (they already saw the result).

| Event | Who is told | Also |
|---|---|---|
| Invitation sent | Owner+Admin (not the actor) | |
| Invitation cancelled | Owner+Admin (not the actor) | |
| Invitation accepted | Owner+Admin | New person gets a welcome |
| Role changed | The person (their new role) + Owner+Admin (not the actor, not the person) | |
| Member removed by an admin | Owner+Admin (not the actor) | Removed person gets an email (they can't sign in) |
| Member restored by an admin | Owner+Admin (not the actor) + the restored person | Email to the restored person |
| Person deleted their own account | Owner+Admin | |
| Person restored their own account | Owner+Admin | |
| Ownership transferred (Settings) | New Owner, old Owner (now Admin), other Admins | Email to both |
| Owner deletes own account, hands over ownership | New Owner + other Admins | Email to new Owner |
| Owner deletes the whole workspace | Nobody in-app (everyone is locked out) | Email to every member |
| Owner restores the workspace | Everyone else (Owner+Admin+Member) | Email to every member |
| Outreach strategy saved | Owner+Admin (not the actor) | |
| Outreach strategy approved | All (not the actor) | |
| Approval rules changed | All (not the actor) | |
| LinkedIn account connected / disconnected | Owner+Admin (not the actor) | Connect/disconnect is now Owner/Admin only |
| LinkedIn post found removed | All | Once per post |

Never sent to Members: team changes, integrations, workspace settings. Usage, billing and AI spend: Owner only.
