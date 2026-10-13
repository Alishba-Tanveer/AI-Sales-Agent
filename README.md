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