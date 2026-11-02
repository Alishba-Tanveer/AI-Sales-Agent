## Lead Management, Outreach & LinkedIn Integration Improvements

This update improves lead discovery, contact management, email and LinkedIn outreach, reply tracking, and user experience across the AI Sales Agent platform.

### 1. Sidebar Profile Photo
- Added support for displaying the user's profile photo in the application sidebar.
- Profile photo updates immediately after saving or removing it from Settings.
- Sidebar reflects the latest saved profile image.

### 2. Find Opportunities & Lead Discovery
- Improved the Save as Lead functionality in Find Opportunities.
- Backend attempts to discover contact information from job postings and company websites.
- Searches for an email address or LinkedIn profile.
- Added Tavily web-search fallback when `TAVILY_API_KEY` is configured.
- Prevents lead creation when no usable contact information is found.
- Displays an error when the company cannot be contacted.

### 3. Find Contact Improvements
- Improved contact discovery and LinkedIn profile validation.
- Prevents LinkedIn search-result URLs from being incorrectly saved as actual personal profiles.

### 4. Email Outreach & Gmail Integration
- Added validation for leads without email addresses.
- Displays an appropriate message when a lead cannot be contacted through email.
- Gmail compose actions now open the inbox's New Message interface.
- Copies the lead's email address or prepared reply to the clipboard.
- Supports manual completion of email composition in Gmail.

### 5. Job Search Persistence
- Saves the most recently completed job search and its selected filters in browser storage.
- Restores the previous search results and filters when returning to the page.
- A new search replaces the previously saved search state.

### 6. Reply Gating & Contact History
- Added channel-specific reply validation.
- Email replies require a previously sent email.
- LinkedIn replies require a previously sent LinkedIn message.
- Prevents users from logging replies on channels that have not been used to contact the lead.
- Backend enforces the same validation rules.
- Leads manually moved to the Contacted stage can log replies through either channel.
- Fixed detection of LinkedIn messages that do not contain a subject line.

### 7. LinkedIn Outreach Workflow
Introduced a guided LinkedIn outreach process:

1. Connect on LinkedIn.
2. Mark as connected.
3. Draft a LinkedIn message.
4. Copy the drafted message and open LinkedIn messaging.
5. Confirm that the message was sent using the "I sent this" action.

Additional improvements:
- Updates the lead's stage to Contacted after confirming that a LinkedIn message was sent.
- Refreshes the stage badge immediately.
- Uses a hidden timeline entry to record the connection action without introducing a database migration.
- Updates LinkedIn chat links to open the person's messaging conversation rather than their profile.

### 8. Lead Details Page
- Separated Email Outreach and LinkedIn Outreach into independent cards.
- Displays each outreach card only when the corresponding contact information is available.
- Displays a "No way to contact yet" message when neither contact method is available.
- Added independent loading states for email and LinkedIn message drafting.
- Removed Next Follow-up from the lead details interface.

### 9. Leads Table & Import Preview
- Displays "Company not set" when company information is unavailable.
- Applied consistent missing-company handling in the Leads table and import preview.
- Removed the Next Follow-up column from the Leads table.

### 10. Settings UI Improvements
- Added distinct icon colors for individual Settings tabs:
- Repositioned the daily email limit field to the right side of the Sending Cadence heading.
- Moved Save Strategy to the bottom-right corner.
- Simplified the divider layout above the Save Strategy action.

### 11. Approvals & Follow-ups
- Removed Approvals and Follow-ups from the frontend interface.
- Related backend functionality was also partially removed.
- The remaining backend modules, API routes, and references should be reviewed to confirm complete removal where intended.