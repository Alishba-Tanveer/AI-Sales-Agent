## Analytics & Integrations

### Analytics (`/analytics`)

Implemented an Analytics dashboard that calculates performance metrics using data from existing application endpoints.

**Features:**
- **Period filters:** Today, Last 7 Days, Last 30 Days, and All Time.
- **Lead metrics:** Leads added, contacted, interested, won, and lost.
- **Outreach metrics:** Emails sent, LinkedIn messages, replies, and reply rate.
- **Agent activity:** Tasks run, completed tasks, failed tasks, and success rate.
- **LinkedIn metrics:** Connection requests sent, new connections, posts published, and scripts awaiting approval.
- **Period comparisons:** Displays percentage changes against the previous equivalent period.
- **Charts:** Leads added over time and sales pipeline funnel.
- **CSV export:** Export the currently calculated analytics data.
- **Refresh:** Reload analytics data from the existing endpoints.
- **Loading and error handling:** Includes loading skeletons, error states, empty states, and partial-failure handling.

**Implementation notes:**
- Analytics calculations are performed on the frontend using existing API data.
- Changing the selected period recalculates metrics without refetching data.
- Metrics are based on leads added during the selected period, regardless of their current pipeline stage.
- No dedicated analytics backend endpoint is currently required by this implementation.
- Custom date-range filtering is not included.

### Integrations (`/integrations`)

Implemented an Integrations page to display the application's available services and their current integration approach.

**Integration categories:**
- **Gmail:** Manual integration.
- **LinkedIn:** Manual integration.
- **AI Provider:** Built-in functionality.
- **Web Research:** Built-in functionality.
- **Job Sources:** Built-in functionality.
- **Video Generation:** Planned functionality.

**Features:**
- Displays integration availability and implementation status.
- Gmail card displays the daily email sending limit and outreach strategy approval status.
- AI provider card displays monthly spending and request information for the Owner.
- Restricts sensitive integration information to Owner/Admin roles where applicable.
- Provides clear descriptions of manual, built-in, and planned integrations.

**Implementation notes:**
- Integration statuses are descriptive and do not represent live connection health.
- No dedicated integrations status API currently exists.
- Connect, Disconnect, and Test Connection actions are not included because backend functionality for these operations is not available.

### UI and Data Handling

- Both pages follow the existing dashboard layout, theme, and shared component styles.
- Analytics and Integrations use the existing frontend architecture.
- Loading, empty, error, and partial-data states are handled within the pages.
- Removed unused mock data files for Activity, Notifications, Opportunities, and Settings where they were no longer imported.
- The Overview mock data remains available because the Overview page still supports the `NEXT_PUBLIC_USE_MOCK_DASHBOARD` configuration.

### Future Improvements

- Add a dedicated Analytics API for server-side reporting.
- Add custom date-range filtering.
- Implement a backend Integrations status endpoint.
- Add real connection, disconnection, testing, and synchronization functionality for supported integrations.