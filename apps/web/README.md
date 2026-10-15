# AI Sales Agent — Frontend

The frontend is the web dashboard for AI Sales Agent, built with Next.js,
React, TypeScript, and Tailwind CSS.

## Features Done

- Login, signup, forgot-password and 4-step onboarding screens
- Signup connected to the backend (`POST /api/auth/register`)
- Reusable auth components and a CSS-only gradient background
- Form validation with React Hook Form and Zod
- API helper for communicating with the backend

## Pending Backend Integration

- Login, forgot-password and onboarding save use mock functions
  (`features/auth/api.ts`, `features/onboarding/api.ts`) until the
  backend routes exist

## Tech Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- React Hook Form
- Zod and @hookform/resolvers
- Lucide React icons

## Project Structure

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
├── lib/
│   └── api.ts
└── styles/
    └── theme.css
```

## Getting Started

Run commands from the repository root, not from `apps/web`.

Install dependencies:

```bash
npm install
```

Start only the frontend:

```bash
npm run dev:web
```

Start all configured services:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

The complete application may also require environment variables, the backend
API, PostgreSQL, and Redis. See the root README for setup instructions.

## Validation

Check frontend TypeScript:

```bash
npx tsc --project apps/web/tsconfig.json --noEmit
```

## Authentication and Onboarding

The onboarding flow includes four steps:

1. Company profile
2. Services offered
3. Ideal customer
4. Review and edit

The interface includes validation, navigation, loading states, and error
handling. Verify backend integration and database persistence before treating
the flow as fully functional.

Password-reset behavior also depends on the available backend implementation.

## Theme

Shared theme variables are defined in:

`apps/web/src/styles/theme.css`

Use the existing design system when adding or updating frontend components.

## Development Workflow

Use a separate task branch for each feature. For example:

`feature/auth-onboarding`

Commit and push the task branch, then open a pull request into the `Frontend`
integration branch. Review and test changes before promoting them to `staging`
and then `main`.
