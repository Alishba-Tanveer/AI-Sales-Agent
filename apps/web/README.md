# Frontend: Authentication, Onboarding, Dashboard & Settings

## Overview

This branch improves the frontend authentication and onboarding experience, connects onboarding data with Settings, adds a setup reminder to the dashboard, and introduces smarter global search routing.

## Changes Implemented

### 1. Authentication
- Added password validation requiring uppercase and lowercase letters, a number, and a symbol.
- Added a live password requirements checklist on signup.
- Implemented persistent sign-in using `localStorage` when "Keep me signed in" is checked and `sessionStorage` otherwise.
- Added `hasValidSession()` to check whether a valid session exists.
- Redirected authenticated users visiting `/` or `/login` to `/overview`.

### 2. Onboarding
- Made the company website URL optional while retaining URL validation when provided.
- Added clearer review information, displaying "Not provided" for empty fields.
- Enabled editing individual onboarding steps from the review page.
- Added a "Save and review" action when editing a previously completed step.
- Removed the skip and finish-later options.
- Added validation before advancing through required onboarding steps.
- Saved onboarding progress when moving to the next step.
- Added a shared options file for industries and company sizes.
- Redirected users to `/overview` after completing setup.

### 3. Dashboard Setup Reminder
- Added a setup reminder popup for incomplete onboarding information.
- Grouped missing fields by their corresponding Settings tabs.
- Added links that navigate directly to the relevant Settings tab.
- Designed the reminder to appear once per login when setup information is incomplete.

### 4. Settings Synchronization
- Added Business settings for company information and services.
- Added Outreach Strategy settings for target industries, job titles, locations, company size, and ideal customer description.
- Connected onboarding and Settings to the same client-side profile data.
- Added supporting components for profile, team, notifications, approval rules, usage, and account deletion.
- Improved Settings layouts, themed icon tiles, card accents, and popup sizing.
- Removed unnecessary tab-bar scroll arrows and expanded the Usage and Limits page width.

### 5. Global Search
- Added search query routing through `features/search/resolve.ts`.
- Added destination matching for queries such as `lead`, `settings team`, and `linkedin content`.
- Preserved the existing Leads search as the fallback for unmatched queries.

### 6. Theme Toggle
- Updated `ThemeToggle` to accept an optional `className` prop.
- Preserved the existing dark/light theme-switching behavior.
- Fixed the TypeScript error caused by passing `className` from the dashboard topbar.

## Implementation Notes
- Onboarding and Settings profile data currently use `localStorage` per user.
- A backend onboarding API is not yet implemented; the profile persistence layer can be updated when that API becomes available.
- Some Settings features still use mock data or placeholder handlers.

## Validation
- Frontend TypeScript check passed:
  `npx tsc --project apps/web/tsconfig.json --noEmit`
- Production frontend build passed:
  `npm run build -w apps/web`

## Files and Areas Updated
- Authentication pages and validation
- Onboarding pages, schemas, options, and profile status
- Dashboard shell, sidebar, topbar, and setup reminder
- Settings page and supporting components
- Global search routing
- Theme toggle component