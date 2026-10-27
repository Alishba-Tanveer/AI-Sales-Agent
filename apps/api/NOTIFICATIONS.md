# Who sees which notification

Every notification goes through `src/utils/notify.ts`. It is saved once per recipient, so "read" and "dismiss" belong to one person.
Recipient is stored after an "@" in the existing `type` column (no database migration needed). Older rows without "@" keep the old role filter.

Audiences: **Owner** = Owner only, **Owner+Admin**, **All** = Owner, Admin and Member, **Person** = one named person.
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

## Still to wire when those backend modules exist
In the zip you sent, the leads, inbox, approvals, emails, opportunities and analytics service files are empty (0 bytes).
Add one `notify()` call where each event happens:

| Event | Audience |
|---|---|
| Reply received | All |
| Drafts waiting for approval | All |
| Lead became Interested / new leads found | All |
| Research failed for a lead | All |
| Gmail / integration needs attention | Owner+Admin |
| Daily send limit reached | Owner+Admin |
| AI spend limit reached (or close) | Owner |
| Weekly summary ready | Owner+Admin |
