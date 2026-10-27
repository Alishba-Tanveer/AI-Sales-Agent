# LinkedIn integration setup

This implementation uses the documented free stack: Gemini REST API for grounded JSON generation, Tavily Search for current niche news and public buyer research, PostgreSQL/Prisma, and the official LinkedIn OAuth/API. It does not use paid avatar services. The content workflow ends with an approved script; a person records the video and publishes it in LinkedIn. Connection invitations and engagement imports are manual because standard self-serve LinkedIn permissions do not expose those actions.

## Required environment

Copy `.env.example` to `.env`, then set `GEMINI_API_KEY`, `TAVILY_API_KEY`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, and `ENCRYPTION_KEY`. `ENCRYPTION_KEY` must be exactly 64 hex characters (32 random bytes). Set `LINKEDIN_REDIRECT_URI` to the exact callback registered in the LinkedIn developer app: `https://YOUR_API_HOST/api/linkedin/account/callback`. The LinkedIn app needs OpenID Connect profile scopes and `w_member_social` for member authorization. Provider/app product availability is controlled by LinkedIn.

## Apply database changes

From the monorepo root, run `npm run db:generate --workspace=@ai-sales-agent/database` and `npm run db:migrate --workspace=@ai-sales-agent/database` (or deploy the checked-in migration through your normal migration pipeline). The migration resets legacy fake connected/default profile state and deletes only the known sample LinkedIn records; all other saved content is preserved.

## What works

- Profile recommendations compare user-provided profile text with the saved offer and buyer audience.
- Content creation uses Gemini; news refresh uses Tavily results relevant to both saved niche fields and stores source links. A daily worker refresh runs at 8:00 AM Pakistan time.
- LinkedIn account authorization uses OAuth state validation and AES-256-GCM encrypted tokens.
- Prospects are researched from public snippets and accepted only when the cited source contains the LinkedIn profile URL; connection notes are prepared for manual send and can be tracked after the user sends them.

The product does not claim automatic access to everyone who likes/comments, send invitations, or create AI avatar videos. Those are not available under the chosen free stack/standard API access.
