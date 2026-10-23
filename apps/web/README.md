## Team Management, Account Recovery, Ownership Transfer & UI Improvements

### Overview

This task improves the AI Sales Agent's team management, account recovery, ownership management, role-based permissions, and user interface. It introduces invitation acceptance, recently removed accounts, account restoration, ownership transfer, and role-aware navigation.

### 1. Invitation Acceptance

- Added a new `/accept-invite` page for accepting team invitations.
- New users can set their name and password.
- Existing users can enter their password to join the invited company.
- Validate invitation tokens through the backend before allowing acceptance.
- Display the company name, inviter, invited role, and locked invited email.
- Handle expired, revoked, and already-used invitations with clear messages.
- Redirect successfully accepted users to `/overview` without requiring onboarding.
- Invitations use hashed tokens with a seven-day expiry.
- Resending an invitation generates a new token and invalidates the previous token.
- Reject users who are signed in with a different email or already belong to another company.

### 2. Invitation Statuses

The Team tab supports the following statuses:

- **Active:** The user is an active team member.
- **Invited:** The invitation is pending.
- **Expired:** The invitation has expired.
- **Email failed:** The invitation email could not be sent.

Expired and failed invitations display relevant details and provide a Resend option.

### 3. Recently Removed Accounts

- Added a Recently removed section to Settings → Team.
- Visible to Owners and Admins.
- Display removed users' names, emails, removal reasons, who removed them, removal timestamps, and remaining days in the 30-day recovery period.
- Added a Restore button for eligible accounts.
- Restored users retain their previous roles and must sign in again.
- Prevent restoration when an email has since been re-invited or re-registered.
- The active Owner does not appear in the Recently removed list.

**API endpoints:**

- `GET /api/team/members/removed`
- `POST /api/team/members/:id/restore`

A scheduled purge job permanently deletes eligible accounts after 30 days.

### 4. Account Deletion and Recovery

- Removed password confirmation and typed `DELETE` requirements from the account-deletion flow.
- Admins and Members receive a simple confirmation dialog with **No** and **Yes, delete** options.
- After confirming, the user is signed out and redirected to the login page.
- Users who delete their own accounts can restore them within 30 days by signing in and confirming restoration.
- Users removed by an administrator cannot restore themselves; an Owner or Admin must restore them.
- Updated deletion-dialog wording to distinguish personal account deletion from workspace deletion.

#### Owner Account Deletion

- Owners with active team members must choose between transferring ownership and deleting the entire business.
- The transfer-and-delete operation transfers ownership and soft-deletes the previous Owner in a single backend operation.
- The new Owner retains the workspace and full Owner permissions.
- The previous Owner becomes eligible to return as an Admin if their account is restored within 30 days.
- Owners without eligible team members can delete the entire business through a confirmation dialog.
- The backend rejects Owner deletion requests that do not specify a valid option.

### 5. Ownership Transfer

- Added ownership transfer functionality to the Team tab.
- Owners can transfer ownership using the Transfer Ownership button, the member's menu, or the role dropdown.
- Only active team members are eligible; pending invitations, expired invitations, and the current Owner are excluded.
- If no eligible members exist, the interface asks the Owner to invite someone first.
- Ownership transfer updates both users' roles in a single database operation.
- The selected member becomes Owner, and the previous Owner becomes Admin.
- The previous Owner is signed out across devices.
- Display a confirmation message before redirecting the previous Owner to the login page.
- Refresh the new Owner's permissions when the dashboard is revisited or reloaded.
- The new Owner can transfer ownership again when needed.

### 6. Role-Based Permissions

The application supports three roles: Owner, Admin, and Member.

| Permission | Owner | Admin | Member |
|---|---|---|---|
| View leads, inbox, activity, and analytics | Yes | Yes | Yes |
| Review and approve drafts and replies | Yes | Yes | Yes |
| Edit outreach strategy, approval rules, business, and ICP | Yes | Yes | No |
| Connect integrations | Yes | Yes | No |
| Invite or remove team members | Yes | Yes, except Owners | No |
| Restore removed accounts | Yes | Yes, eligible users | No |
| Access Usage and AI spending information | Yes | No | No |
| Transfer ownership and delete workspace | Yes | No | No |

Additional changes:

- Members see only Profile, Team, and Notifications settings tabs.
- Integrations are hidden from Members.
- Usage is restricted to Owners.
- The complete-your-profile popup appears only for Owners.
- The dashboard fetches the user's role from the server whenever it opens rather than relying solely on local storage.
- Backend authorization remains responsible for enforcing actual permissions.

### 7. UI Improvements

- Standardized theme colors across the application while reserving red for danger-related actions.
- Assigned stable colors to users based on their IDs.
- Applied consistent colors to avatars, Restore buttons, and Team table entries.
- Pending invitations retain yellow styling with a dashed border.
- Updated LinkedIn page action colors:
  - **How it works:** Yellow.
  - **Re-read profile:** Blue.
  - **Add person:** Blue.
  - **Edit strategy:** Purple.
- Moved the yellow icon in the complete-your-profile popup to the left of the heading on the same row.

### 8. Suggestions Dropdown

- Added a suggestions dropdown containing available pages and tabs.
- Filtered suggestions according to the current user's role.
- Implemented ranked matching and keyboard navigation.
- Updated search behavior so typing `settings` displays all relevant Settings tabs.
- Removed the misleading `outreach` keyword from the LinkedIn tab.