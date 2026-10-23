# Team, invitations and account recovery

How the backend behaves today (`/api/team`, `/api/users`, `/api/auth`) and what the frontend relies on.
Success responses use `{ message?, data }`. Errors use `{ message, code?, ...extra }`; the frontend reads `code` for the cases marked below.
Roles are `OWNER | ADMIN | MEMBER` on the user and `Owner | Admin | Member` in team lists.
The backend enforces every permission; the UI only hides things.

## Rules
- One Owner per workspace. Invites can only be `Admin` or `Member`. Ownership only moves through a transfer.
- A person belongs to one workspace. Accepting an invite for an email that owns a set-up workspace, or a workspace with a team, returns 409 `CANNOT_JOIN`.
- Removed and deleted accounts are soft-deleted (`deletedAt`) and kept for **30 days**. A background job in `worker.ts` then deletes them for good, and a workspace whose last account was purged goes with it.
- Why an account is soft-deleted (`removedReason`; old rows with no reason count as `SELF`):
  - `SELF` the person deleted their own account. Only they can restore it, by signing in.
  - `ADMIN` an Owner/Admin removed them. Only an Owner/Admin can restore them.
  - `WORKSPACE_DELETED` the Owner deleted the whole business. Only the Owner can restore it, by signing in.

| Action | Owner | Admin | Member |
|---|---|---|---|
| Business details, outreach strategy, approval rules, integrations | yes | yes | no |
| Invite / remove / change roles, restore removed accounts | yes | yes (never the Owner) | no |
| Usage limits, AI spend | yes | no | no |
| Transfer ownership | yes | no | no |
| Delete own account | must transfer ownership or delete the workspace | yes | yes |

## Team list
- `GET /api/team/members` -> `data`: active members first, then pending invitations (`members` and `invitations` are also returned separately).
  Members have `status: "Active"`. Invitations have `status: "Invited" | "Expired" | "Email failed"`, plus `reason`, `emailError`, `expiresAt`.
- `PATCH /api/team/members/:id {role}` (`Admin | Member`; also accepts a pending invitation id). The Owner's role can't be changed.
- `DELETE /api/team/members/:id` -> removes the person (reason `ADMIN`, 30 days to restore). You can't remove yourself or the Owner.
- `GET /api/team/members/removed` (Owner/Admin) -> `data: RemovedMember[]`:
  `{ id, name, email, role, reason: "ADMIN" | "SELF", canRestore, removedAt, removedBy, removedById, daysLeft, restoreDeadline }`.
  `canRestore` is true only for `ADMIN`. The Owner and people who went down with a deleted workspace are never listed.
- `POST /api/team/members/:id/restore` (Owner/Admin) -> back to `Active` with the old role. 404 if not in the list, 403 for `SELF` rows, 410 after 30 days.

## Invitations
- `POST /api/team/invitations {email, role}` -> `data` is the invitation row. 7-day expiry. 409 if a pending invite for that email exists, or if the email belongs to someone removed recently (restore them instead).
  The response says whether the email was sent (`emailSent`); a failed send still saves the invitation (`status: "Email failed"`).
- `POST /api/team/invitations/:id/resend` -> new token (the old link stops working) and a fresh 7 days.
- `DELETE /api/team/invitations/:id` -> revoke (the row is kept so the old link can say "cancelled").
- `GET /api/team/invitations/:token` or `GET /api/team/invitations/accept?token=` (public) -> `data: { state, message, email, name, role, organizationName, inviterName, accountExists, canJoin, blockedReason, expiresAt }`.
  `state` is `valid | expired | cancelled | accepted | not_found`.
- `POST /api/team/invitations/accept {token, password, name?}` (public) -> `data` like a login (`token`, `user`).
  New email: `name` and `password` are required and the account is created. Existing email: `password` must match.
  Errors by `code`: `INVITE_NOT_FOUND` 404, `INVITE_USED` / `INVITE_CANCELLED` / `INVITE_EXPIRED` 410, `PASSWORD_REQUIRED` and `WRONG_PASSWORD` 400, `CANNOT_JOIN` 409.
- Email link: `<WEB_URL>/accept-invite?token=<token>`.

## Ownership
- `POST /api/team/members/:id/transfer-ownership` (or `POST /api/team/transfer-ownership {memberId}`): Owner only, no password.
  The Owner becomes Admin and the chosen active member becomes Owner, in one transaction. Invited people can't receive it.
  The previous Owner is signed out everywhere (their `tokenVersion` goes up, so every old token gets a 401); the response has `signedOut: true`, and the app signs them out and sends them to the login page. They sign in again as an Admin. The new Owner has Owner rights on their next request (roles are read from the database); the app refreshes their role when the window regains focus.
  The new Owner can hand it back or to someone else the same way.

## Deleting your own account
`DELETE /api/users/me`: no password and no typed confirmation. The app has already asked "are you sure?" and the person is signed in.
The token is revoked, so the app signs the person out afterwards. Response: `{ message, scope: "account" | "workspace" | "transfer", restoreDeadline }`.

- **Admin / Member:** send `{}`. Only their own login is deleted (reason `SELF`).
- **Owner with other active people in the workspace** must choose, otherwise 409 `code: "OWNER_MUST_CHOOSE"`:
  - `{ transferToId }` the chosen active member becomes Owner, the caller becomes Admin and their own login is soft-deleted, in one transaction. 404 if the target isn't an active member, 400 if it's the caller.
    If the old Owner signs in again within 30 days they come back as an **Admin**; the new Owner stays Owner.
  - `{ deleteWorkspace: true }` every active account in the workspace is soft-deleted (reason `WORKSPACE_DELETED`) and pending invitations are cancelled.
- **Owner who is alone in the workspace:** deletes the workspace; no choice needed.

## Signing in to a deleted account
`POST /api/auth/login {email, password, remember?, restore?}`. After the password is verified, for a soft-deleted account:
- more than 30 days ago: 403 `ACCOUNT_EXPIRED`
- removed by an admin: 403 `REMOVED_BY_ADMIN`
- workspace deleted and the person isn't the Owner: 403 `WORKSPACE_DELETED`
- Admin/Member whose workspace has no active Owner any more: 403 `WORKSPACE_UNAVAILABLE`
- otherwise 409 `ACCOUNT_RESTORABLE` with `{ scope: "account" | "workspace", organizationName, restoreDeadline, daysLeft }`.
  The frontend asks "Restore?" and repeats the login with `restore: true` (or calls `POST /api/auth/restore-account` with the same body).
  Restoring a workspace brings back every account that went down with it; a restored account keeps the role it had.
