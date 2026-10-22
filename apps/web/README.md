## Settings and LinkedIn Backend Integration

### Overview

The Settings pages and three LinkedIn pages have been connected to the existing backend APIs, replacing their previous mock data implementations. This work improves data persistence, session handling, validation, and error reporting.

The Overview dashboard remains outside this integration and continues to use mock data because the `/api/analytics` endpoint is not yet available.

### Settings

The Settings feature uses a dedicated API layer in `apps/web/src/features/settings/api.ts`.

- **Profile:** Load and update profile information, including name, email, role title, timezone, and avatar.
- **Password and sessions:** Change the password using the backend's password-strength requirements, sign out other sessions while keeping the current session active, and delete the account after password confirmation.
- **Team management:** Load team members and invitations; invite members, resend or revoke invitations, change roles, and remove members.
- **Role permissions:** Restrict team-management controls according to user roles. Only Owners can assign the Owner role.
- **Outreach:** Load and save outreach tone, follow-up settings, interval, and daily sending cap. Approve the outreach strategy through the backend.
- **Approval Rules and Notifications:** Load and save preferences through the API.
- **Usage and test mode:** Display backend-provided usage statistics and synchronize test mode with the server. The daily-limit state is derived from sent messages and the configured daily cap.
- **User experience:** Include loading, retry, and save-in-progress states.

The previous Settings mock data implementation and the Usage preview toggle have been removed.

### LinkedIn

The LinkedIn feature uses a dedicated API layer in `apps/web/src/features/linkedin/api.ts`.

#### Profile Optimizer

- Analyze a LinkedIn profile through the backend.
- Restore the previous profile analysis and selected changes when returning to the page.
- Save changes to the backend when selected or deselected.
- Roll back the selection if an update fails.

#### Content Engine

- Load scripts and posting settings from the backend.
- Support editing, approving, redoing, dismissing, and cancelling scripts.
- Add topics, mark posts as published, and manage post links through the API.
- Check whether posts still exist through the backend.
- Derive the news-found indicator from available scripts.

Video-generation status depends on the HeyGen worker or webhook updating the script status.

#### Connections

- Load connection strategies and people from the backend.
- Support adding people, sending requests, bulk approval, skipping, withdrawing requests, and editing notes.
- Enforce the daily connection limit on the backend and display relevant errors.

The previous LinkedIn mock data implementation has been removed.

### Backend Changes

#### Authentication

Updated `apps/api/src/middleware/auth.ts` to distinguish between authentication failures and unexpected server errors.

- Invalid or expired JWTs return HTTP `401`.
- Unexpected errors, including Prisma and database errors, are logged with the `[requireAuth] unexpected error` prefix and return HTTP `500`.

This prevents unexpected backend failures from being incorrectly reported as expired sessions.

#### Validation

Updated `apps/api/src/middleware/error-handler.ts` to handle Zod validation errors as HTTP `400` responses with validation messages, instead of treating them as generic server errors.

#### Session handling

Settings and LinkedIn API requests use `keepSessionOn401` so the client can display the server's error message without automatically logging the user out. The application's `AuthGuard` continues to handle expired sessions.

### API Integration

The frontend connects to the existing API route groups:

- `/api/users`
- `/api/team`
- `/api/settings`
- `/api/linkedin`

The backend remains responsible for persistence, authorization, validation, and applicable daily limits.

### Database Setup

The Prisma schema is located at `packages/database/prisma/schema.prisma`.

The local PostgreSQL database must be synchronized with the current schema before testing protected Settings and LinkedIn endpoints. The `User` model includes fields such as `roleTitle`, `timezone`, `avatarUrl`, `passwordChangedAt`, `tokenVersion`, and `deletedAt`, which may be absent from an older database.

Before testing:

1. Inspect `packages/database/prisma/migrations` to identify the existing migration history.
2. Apply the appropriate migrations if the required migration files exist.
3. If the necessary migrations do not exist, determine the correct local-development schema update strategy before changing the database.
4. Regenerate Prisma Client using the project's current schema.
5. Restart the API and verify authentication.

Do not reset the database or use destructive schema changes to resolve migration issues without confirming the impact on existing data.