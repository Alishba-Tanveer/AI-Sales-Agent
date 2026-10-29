# AI Sales Agent — LinkedIn, Content & Activity Improvements

## Overview

This update improves the LinkedIn Connections and Engagement workflow, LinkedIn content research, inbox navigation, activity tracking, and dashboard UI. It also includes backend API changes, AI provider integration updates, and removal of unused or duplicate code.

## 1. LinkedIn Connections & Engagement

### CSV Import Improvements

- Fixed LinkedIn CSV import handling, including LinkedIn message exports such as `messages.csv`.
- Updated message import logic to identify people from conversations instead of treating conversation IDs as names.
- Import one person per conversation where possible, using available names and profile URLs.
- Exclude the current user's own entry and skip entries with hidden or unavailable names, such as `LinkedIn Member`.
- Increased the supported CSV upload size limit from 5 MB to 25 MB.
- Aligned the People Who Engaged workflow with the Target Buyers workflow.

### Search & Filtering

- Added a search bar above the Connections tabs.
- Search the currently selected tab by name, company, and job title.
- Improved the search bar's spacing, width, focus behaviour, and styling.

### Connection Management

- Added individual delete controls for connection rows and bulk deletion for selected rows.
- Added corresponding backend delete API support.
- Prevent deletion of people who have already been added to Leads.
- Positioned and resized the bulk-delete control alongside the search bar.
- Styled the delete icon as a simple red icon without a border or background.

### Button & Empty-State Improvements

- Removed redundant LinkedIn profile links, Open Profile buttons, and Skip buttons.
- Removed the copy button from pending rows.
- Added a Check Reply / Follow action to help users navigate to a person's inbox.
- Restricted Add to Leads to the Connected tab.
- Standardised button icons, outline colours, labels, and interaction styling.
- Simplified empty states on the Pending and Connected tabs by removing unnecessary action buttons.
- Retained relevant actions on People Who Engaged and Target Buyers.

## 2. LinkedIn Inbox Improvements

- Improved inbox-related navigation from the Connections workflow.
- Added an action to open the relevant person's inbox so users can review replies and follow-up messages.
- Updated inbox UI and types to support the improved workflow.

## 3. LinkedIn Content Engine & Content Search

- Improved content search and business-news research handling.
- Updated the Tavily integration used for web and news research.
- Refined LinkedIn content UI and related API integration.
- Added support for managing searched news scripts, including individual deletion controls.
- Added `post-assets.ts` to support LinkedIn post asset handling and content previews.
- Improved the content workflow for preparing posts and media assets.

**Content publishing note:** Content generation and asset preparation are separate from publishing. Direct LinkedIn publishing depends on the available LinkedIn API permissions and integration capabilities.

## 4. AI Provider & Email Improvements

- Updated the AI integration configuration and provider handling.
- Added Groq support alongside the existing Gemini integration.
- Fixed issues encountered with Gemini during content generation and email generation.
- Updated related configuration and service code to support the revised AI workflow.

Provider availability, fallback behaviour, and generated output quality depend on the configured API credentials and implementation.

## 5. Overview & Recent Activity

- Improved the Overview page and its metric cards, recent activity, and loading/empty/error states.
- Updated the analytics backend to return task kind and status information needed by the Overview.
- Added activity-specific icons and theme colours based on the activity type.
- Improved visual differentiation for activities such as video generation, news research, replies, emails, imports, and lead-related tasks.
- Improved the Related Lead display to provide more useful text instead of an empty dash where possible.

## 6. Activity Page & Job Details

- Updated activity rows, job UI, and job details dialogs.
- Improved task status and activity presentation.
- Refined the display of related information and removed unnecessary placeholder dashes.
- Improved consistency between activity types, their icons, and their visual styling.

## 7. Leads, Inbox & Settings UI

- Updated the Lead Detail page.
- Refined Inbox components and supporting types.
- Improved Settings UI styling.
- Updated LinkedIn frontend API calls and types to support the revised workflows.

## 8. Backend Changes & Code Cleanup

- Updated API environment configuration and AI integration code.
- Updated the LinkedIn controller, routes, schema, service, and repository.
- Updated inbox service behaviour.
- Updated analytics service behaviour.
- Added or revised backend support for connection deletion and related UI actions.
- Removed unused bulk-approval functionality from the frontend API and corresponding backend routes, controller, service, schema, and repository.
- Removed the stale nested `apps/api/src/src` source tree to avoid duplicate backend files.
- Removed the obsolete `apps/api/NOTIFICATIONS.md` file as part of cleanup.

The active backend source is maintained under `apps/api/src/`.

## Summary

This update focuses on making LinkedIn engagement management more practical, fixing CSV import behaviour, improving content research and AI provider integration, making activity information easier to understand, refining dashboard UI, and removing obsolete backend code.