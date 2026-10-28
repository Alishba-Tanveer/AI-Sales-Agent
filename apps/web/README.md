
## Latest Updates — LinkedIn Connections, Leads, Inbox & UI Polish

### LinkedIn Connections
- Removed the Research buyers action because contacts can now be imported or added manually.
- Updated Connections help text to explain the import and manual-entry workflow.
- Added LinkedIn profile and messaging shortcuts. Message notes are copied to the clipboard for manual pasting and sending in LinkedIn.
- Hid the copy/message action for contacts marked as Connected.
- Replaced separate Mark connected and Mark withdrawn buttons with a single Update status menu.
- Removed Add to Leads from the Target buyers tab.
- Aligned connection-row actions for consistent spacing.

### Leads and Inbox
- Replaced Archive with Do not contact. Leads remain in the pipeline, their follow-up date is cleared, and AI email drafts are prevented.
- Replaced native browser confirmation popups with the application's styled confirmation dialog.
- Removed the Reviewed stage and migrated existing Reviewed records to New.
- Added a stage dropdown to each Leads table row.
- Updated Overview and Analytics to use the simplified lead stages.
- Logged AI reply and email-draft attempts in Activity, including failed attempts.
- Added role-based notifications for manually added, imported, and LinkedIn-promoted leads.
- Added a LinkedIn messages shortcut to the Log a reply dialog.
- Aligned dropdown arrows and Activity pagination buttons.

### UI Polish and Theming
- Replaced the native stage selector with the themed `option-select.tsx` dropdown.
- Styled the dropdown trigger as a rounded pill, with a menu matching its width.
- Added coloured option indicators and a checkmark for the selected stage.
- Kept Do not contact out of the normal stage options, except when the lead is already in that stage.
- Standardized stage colours across the app: blue, amber, pink, green, grey, and red. Removed purple stage colours and avoided neighbouring stages sharing a colour family.
- Updated the Overview Leads by stage chart to match the stage colours.
- Reused the themed dropdown on the Lead detail page and in the Lead and Channel selectors in Log a reply.
- Updated Leads stat cards to place the label and value on the same row.
- Standardized hover and colour styles across Leads filters, table rows, and Overview.
- Widened the Leads search field to prevent its placeholder from being cut off.
- Added theme-coloured initials avatars through `LeadAvatar` in the Leads table, Lead detail, and Inbox, with different colours for neighbouring rows.
- Limited Inbox message previews to two lines.
- Replaced hardcoded Inbox colours with theme tokens. Email uses green and LinkedIn uses blue.
- Added an Email shortcut to Log a reply that opens Gmail for the selected lead. It uses the Google account currently signed in first and requires no backend change.
- Fixed the squeezed avatar on Lead detail.
- Coloured the top three Lead detail actions: Edit (indigo), LinkedIn (blue), and Do not contact (red).
- Added spacing beneath the Pipeline stage label.
- Limited Overview recent activity to the six newest items to balance the layout.
- Moved toast notifications to the top-right, below the app bar.
