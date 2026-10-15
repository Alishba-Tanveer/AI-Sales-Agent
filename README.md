# AI Sales Agent

A web application that helps with sales outreach. It manages leads, finds
opportunities, writes personalized drafts, and asks a person to approve
important actions before anything is sent or changed.

## Features

- **Leads:** one shared lead list with stages (New, Reviewed, Contacted, Interested, Won, Lost)
- **Opportunity finder:** collects public job and company data to find possible leads
- **Email outreach:** AI-drafted emails that need approval before sending
- **LinkedIn agent:** profile suggestions, content and video scripts, connection suggestions (all approved by a person; manual sending where automation is not allowed)
- **Approvals:** profile changes, video scripts, outreach strategy and replies are approved by a person
- **Analytics:** simple number cards (for example leads added this week, emails sent, replies)
- **Light and dark mode:** one global theme file

## Technology stack (all free)

| Area | Technology |
| --- | --- |
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Table |
| Forms and validation | React Hook Form, Zod |
| Backend | Node.js, Express, TypeScript, separate worker process |
| Database | PostgreSQL, Prisma |
| Background jobs | Redis, BullMQ |
| AI | Gemini API (free tier) behind our own AI wrapper |
| Research and data | Tavily search (free tier), free job APIs (Jobicy, Arbeitnow, Remotive, Adzuna) |
| Email | Gmail API (OAuth) |
| Auth and security | Auth.js or JWT, bcrypt, Node crypto for token encryption |
| Tools | Docker, GitHub Actions, Vitest, Postman |

Notes:
- Free AI tiers may let the provider use your input. Use test data only.
- Free tiers have limits. Check them before heavy use.

## Project structure

```
ai-sales-agent/
├── apps/
│   ├── web/        Next.js dashboard
│   └── api/        Express API and background worker
├── packages/
│   ├── database/   Prisma schema and client
│   └── shared/     Shared Zod schemas and constants
├── docker-compose.yml
└── .env
```

Every database table has an `organizationId`, so each organization only sees its own data.

## Local development

1. Install Node.js, Git, and Docker Desktop.
2. Configure the root `.env` file for local PostgreSQL and Redis.
3. Start the services with `docker compose up -d`.
4. Install packages with `npm install`.
5. Generate Prisma Client with `npm run db:generate`.
6. Apply database migrations when needed with `npm run db:migrate`.
7. Start the application with `npm run dev`.

## Local service addresses

- Frontend: http://localhost:3000
- API health check: http://localhost:4000/api/health
- PostgreSQL: localhost:5433
- Redis: localhost:6379

## Theme (light and dark mode)

All colors for both modes are defined in one file:
`apps/web/src/styles/theme.css`.
Change colors there only. Do not hard-code colors in components.

## Optional cloud services

- Neon (free PostgreSQL) can replace local PostgreSQL. Use the pooled connection string for the app and the direct connection string for migrations.
- Vercel (free plan) can host the web app for non-commercial use.

## Security

Keep `.env` private and never commit credentials or API keys.

## Frontend Authentication and Onboarding

### Project overview

AI Sales Agent is a web application project intended to help users manage
sales leads and AI-assisted sales workflows. The application is being built
as a monorepo with separate web, API, worker, shared-package, and database
areas.

### Technology stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **UI components:** Reusable components under `apps/web/src/components`
- **Forms:** React Hook Form
- **Validation:** Zod and `@hookform/resolvers`
- **Icons:** Lucide React
- **Backend:** Node.js and Express
- **Database:** PostgreSQL and Prisma
- **Background jobs:** Redis and BullMQ
- **Repository:** Git and GitHub, using task-specific branches

### Frontend work completed

Authentication and onboarding work currently includes:

- Login page updates.
- Signup page updates.
- Forgot-password page.
- Shared authentication layout.
- Reusable authentication components.
- Authentication feature utilities.
- API helper at `apps/web/src/lib/api.ts`.
- Multi-step onboarding page.
- Onboarding form schema and field validation.
- Onboarding tag-input component.
- Company profile, services, ideal customer, and review steps.
- Previous/next navigation, optional skipping, and review edit actions.
- Dark theme styling consistent with the application's design system.
- Background backdrop and translucent onboarding card.
- Loading and error states for onboarding save actions.

### Relevant frontend folders

```text
apps/web/src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── signup/
│   │   ├── forgot-password/
│   │   └── layout.tsx
│   ├── (onboarding)/
│   │   └── onboarding/
│   └── page.tsx
├── components/
│   ├── auth/
│   └── ui/
├── features/
│   ├── auth/
│   └── onboarding/
└── lib/
    └── api.ts
```

### Onboarding details

The onboarding flow contains four steps:

1. **Company:** company name, website, industry, and optional description.
2. **Services:** services offered and optional differentiation.
3. **Customer:** target industries, job titles, locations, company size,
   and optional ideal-customer description.
4. **Review:** review entered information and return to earlier sections
   to edit it.

The onboarding schema validates form data, and the interface displays
field errors and save errors.

**Integration note:** The onboarding page currently calls
`saveOnboarding(...)`. Confirm the implementation in
`apps/web/src/features/onboarding/api.ts`; the current implementation may
still be a mock until the backend onboarding endpoint is available.
A successful TypeScript check does not confirm database persistence or
end-to-end authentication.

### Development and validation

Run these commands from the repository root in VS Code's Git Bash terminal:

```bash
npm install
npx tsc --project apps/web/tsconfig.json --noEmit
npm run dev:web
```

The web app normally runs at `http://localhost:3000`.

To run all services together, use:

```bash
npm run dev
```

This requires the relevant environment variables and supporting services
to be configured. Check the root `package.json` for available scripts.

### Git collaboration workflow

Long-lived branches:

- `main` — stable releases.
- `staging` — integration and testing.
- `Frontend` — frontend integration branch.
- `Backend` — backend integration branch.

Use a separate task branch for each feature. For example:

```text
Frontend
└── feature/auth-onboarding
```

Recommended workflow:

1. Start from the appropriate up-to-date base branch.
2. Create a descriptive task branch.
3. Implement and test the task.
4. Commit the task changes.
5. Push the task branch to GitHub.
6. Open a pull request into the appropriate integration branch.
7. Review and test before merging.
8. Promote tested integration work into `staging`, then `main`
   through pull requests.

Do not commit `.env` files, credentials, or API secrets. Use the project's
`.env.example` as a template for required environment variables.

### Current verification status

The web TypeScript check previously passed for the onboarding work, but a
later check found an unsupported `asChild` prop on the forgot-password page.
Re-run the TypeScript command after fixing it. Record the check as passed
only when the command exits without errors.
