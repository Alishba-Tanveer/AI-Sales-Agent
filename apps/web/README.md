# AI Sales Agent — Frontend

The frontend is the web dashboard for AI Sales Agent, built with Next.js, React, TypeScript, and Tailwind CSS.

## Work Completed Today

- Connected the login flow to the backend API.
- Connected the forgot-password flow to the backend.
- Added the reset-password page and backend integration.
- Implemented the dashboard overview page and its components.
- Created the shared dashboard layout with sidebar and top navigation.
- Added dashboard navigation and the activity page.
- Added theme switching and updated shared theme styling.
- Removed the main logo hover effect from the sidebar.
- Updated the Tailwind CSS source configuration.
- Verified frontend and backend TypeScript checks.
- Successfully ran the Next.js production build.

## Tech Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- React Hook Form
- Zod and `@hookform/resolvers`
- Lucide React icons

## Getting Started

Run commands from the repository root.

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev:web
```

Start all configured services:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The application may require environment variables, the backend API, PostgreSQL, and Redis. Refer to the root README for complete setup instructions.

## Validation

Check frontend TypeScript:

```bash
npx tsc --project apps/web/tsconfig.json --noEmit
```

Check backend TypeScript:

```bash
npx tsc --project apps/api/tsconfig.json --noEmit
```

Build the frontend:

```bash
npm run build -w apps/web
```

All three checks passed during today's development session.

## Notes

Some dashboard widgets still use mock data. Other dashboard features may require further backend integration and runtime testing.

## Git Workflow

Work on a separate feature branch, commit and push changes, and open a pull request into the agreed integration branch. Review and test changes before merging into `staging` and then `main`.
