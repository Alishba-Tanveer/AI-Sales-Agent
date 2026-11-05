# Development Update — November 5, 2026

## Project Overview

AI Sales Agent is a multi-user sales assistance platform designed to help teams discover opportunities, manage leads, prepare personalized outreach, and create LinkedIn content.

The application combines AI-powered research and content generation with human approval workflows. LinkedIn activities such as profile updates, publishing, connection requests, and messaging remain user-controlled because of LinkedIn API access and platform restrictions.

## Work Completed

### 1. Topic Video Generation Improvements

- Improved the video layout by reducing the size of video titles, spoken captions, and flowchart labels to fit the video canvas more cleanly.
- Removed unnecessary scene-heading and "Visual Breakdown" labels from video overlays.
- Repositioned spoken captions as a smaller, centered single line between the video title and diagram.
- Reduced flowchart box dimensions to improve label visibility and overall layout.
- Kept failed video-generation tasks visible in the **Needs Approval** section.
- Added failure messages and a **Retry Video** action for failed video tasks.
- Added in-app notifications when video generation fails.
- Added Activity entries to record video-generation failures.

### 2. Analytics Chart Improvements

- Added individual date labels for daily chart periods.
- Added centered month and year labels beneath the corresponding dates.
- Introduced light visual dividers between months.
- Made lead counts visible above chart bars by default.
- Retained hover details for additional chart information.
- Vertically centered chart content within the chart card.

### 3. Settings Improvements

- Combined the Notifications and Usage sections into a single Settings tab.
- Removed the AI spending meter.
- Removed monthly AI spending limit controls.
- Removed the Free tier badge and monthly reset countdown.
- Retained email-sending and AI-request usage information.
- Preserved the existing Owner-only access restriction for usage information.

## Current Feature Status

### 1. LinkedIn Agent

The LinkedIn Agent supports a user-controlled workflow for profile optimization, content creation, and connection management.

**Profile Optimizer**
- Reviews profile information against the user's niche and services.
- Generates recommendations for profile improvements.
- Allows users to review and manually apply suggested changes.
- Does not directly modify LinkedIn profiles.

**Content Engine**
- Researches recent niche-related news.
- Generates content ideas and video scripts.
- Supports content review and approval.
- Generates narrated topic videos using stock footage and on-screen graphics.
- Supports AI avatar video generation where the integration is available.
- Allows users to review and manually publish approved content.

**Connections and Engagement**
- Supports LinkedIn connection CSV export and import workflows.
- Organizes imported connections and potential buyers.
- Supports public web searches to find and verify some LinkedIn profile links.
- Helps prepare personalized outreach messages.
- Users copy generated messages and send them manually through LinkedIn.
- Conversation and relationship statuses can be managed in the application.

**Platform Limitation:** LinkedIn restricts third-party applications from accessing and automating certain personal account activities. Therefore, profile changes, publishing, connection requests, engagement tracking, and personal messaging remain user-controlled rather than being performed automatically.

### 2. General Sales Agent

**Opportunity Finder**
- Searches five job and project portals:
  - Jobicy
  - Arbeitnow
  - Remotive
  - RemoteOK
  - We Work Remotely
- Supports public web searches for company opportunities.
- Supports SAM.gov searches when configured.
- Provides keyword, source, opportunity type, posting-date, and match-score filters.
- Scores opportunities based on relevance to the team's services.
- Allows suitable opportunities to be saved as CRM leads.

**AI Email Outreach**
- Generates personalized first-contact email drafts.
- Generates suggested replies to incoming messages.
- Requires human review and approval before sending.
- Supports sending through a connected Gmail mailbox.
- Retains manual email workflows where mailbox automation is not configured.

**Mailbox Automation**
- Connects Gmail through IMAP and SMTP.
- Synchronizes relevant incoming replies.
- Classifies reply intent using AI.
- Supports lead-stage updates based on incoming replies.
- Provides in-app notifications for relevant mailbox events.
- Maintains protection against duplicate sends and Do Not Contact restrictions.
- AI-generated reply drafts require human approval and are not automatically sent.


### 3. Shared Workspace and CRM

- Shared lead management across the workspace.
- Lead pipeline and status tracking.
- Notes and communication history.
- Activity tracking and notifications.
- Organization, team, and role-based access foundations.
- Owner, Admin, and Member permission structure.

## Technology Stack

| Technology | Purpose |
|---|---|
| Next.js and React | Frontend application |
| Tailwind CSS and Base UI | Styling and UI components |
| Node.js, Express and TypeScript | Backend API |
| PostgreSQL and Prisma | Database and ORM |
| Redis and BullMQ | Background jobs and scheduling |
| Groq and Gemini | AI text and content generation |
| Tavily | Web search and niche-news research |
| D-ID | AI avatar video generation |
| FFmpeg | Video processing and composition |
| Edge TTS | Text-to-speech narration |
| Pixabay API | Stock video footage |
| IMAP and SMTP | Email synchronization and sending |
| JWT and bcrypt | Authentication and password security |
| Helmet and CORS | API security |

## Video Environment Configuration

Topic video generation uses FFmpeg, Edge TTS, Pixabay stock footage, and a publicly accessible API base URL for generated files.

Configure the following variables in the API `.env` file:

```dotenv
PIXABAY_API_KEY=your_pixabay_api_key
FFMPEG_PATH=path/to/ffmpeg.exe
EDGE_TTS_PATH=path/to/edge-tts.exe
VIDEO_TTS_VOICE=en-US-JennyNeural
API_PUBLIC_URL=http://localhost:4000
```

cmd:  py -m pip install edge-tts

Use machine-specific executable paths and keep API keys, credentials, and other secrets out of version control.

## Important Implementation Notes

- LinkedIn profile updates, publishing, connection requests, and personal messaging remain manual by design.
- LinkedIn CSV import/export and AI-assisted message generation support the user-controlled workflow.
- Video generation depends on the availability of FFmpeg, Edge TTS, Pixabay credentials, and the configured API URL.
- AI and external integrations depend on valid credentials, available service access, and provider limits.
- Mailbox automation requires a supported Gmail account configuration and valid IMAP/SMTP credentials.
- Human approval remains required for outgoing email and LinkedIn content actions.
