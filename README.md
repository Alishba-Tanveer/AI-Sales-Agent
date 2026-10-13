# AI Sales Agent

A web application for managing sales leads, discovering opportunities,
drafting personalized outreach, and reviewing proposed actions before execution.

## Technology stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL, Prisma
- Background jobs: Redis, BullMQ
- Validation: Zod

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

Keep `.env` private and never commit credentials.
