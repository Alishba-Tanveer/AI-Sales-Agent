## Find Opportunities – Frontend Implementation

**Status:** Frontend implemented and browser testing completed
**Backend:** Pending implementation by the backend team

### Overview

Implemented the Find Opportunities page frontend to help users discover relevant job openings, business opportunities and potential leads from external sources.

The page follows the existing project architecture, component patterns and theme styling.

### Features Implemented

- **Search Filters**
  - Keyword-based search
  - Multiple source selection
  - Opportunity type filtering
  - Minimum match score
  - Posted date range

- **Opportunity Results**
  - Opportunity cards with match scores
  - Extracted intent signals
  - Budget information
  - Company and source information
  - Top Match indicator for opportunities scoring 85 or higher

- **Opportunity Actions**
  - Save as Lead using the existing Leads API
  - Dismiss opportunities
  - Restore dismissed opportunities
  - Open original opportunity sources

- **Additional Functionality**
  - Opportunity sorting
  - CSV export
  - Live results count
  - Loading state
  - Error state with retry
  - Empty results state
  - Partial source failure notification and retry option

### UI and Design Improvements

- Improved spacing between the filter panel and results section.
- Made filter panels and opportunity cards more compact.
- Removed the header banner and decorative icon.
- Removed gradients throughout the page.
- Standardized buttons using the existing Button component.
- Replaced heavily colored source pills with a simple checkbox list.
- Applied alternating theme colors to opportunity cards.
- Used neutral styling for opportunity types and source labels.
- Kept match scores visually consistent.
- Added a Top Match label for opportunities scoring 85 or above.

### Technical Implementation

Created the Opportunities feature following the existing frontend architecture.

Location:

`apps/web/src/features/opportunities/`

Main files include:

- `api.ts` – API service and mock-mode configuration.
- `types.ts` – TypeScript types and interfaces.
- `hooks.ts` – Opportunities feature hooks.
- `constants.ts` – Feature constants and configuration.
- `format.ts` – Formatting utilities.
- `mock-data.ts` – Mock opportunity records.
- `components/` – Opportunities page components.

Page:

`apps/web/src/app/(dashboard)/find-opportunities/page.tsx`

### Testing and Verification

The following checks were completed:

| Check | Result |
|---|---|
| Prisma Client generation | Passed |
| Frontend TypeScript check | Passed |
| Next.js production build | Passed |
| Find Opportunities page loading | Tested |
| Filters and source selection | Tested |
| Opportunity search using mock data | Tested |
| Sorting | Tested |
| Save as Lead | Tested |
| Dismiss and Restore | Tested |
| CSV export | Tested |

**Commands used:**

```bash
npm run db:generate

npx tsc --project apps/web/tsconfig.json --noEmit

npm run build -w apps/web

npm run dev
```

### Mock Data and Backend Integration

The Opportunities frontend currently uses mock data for search results.
Real backend integration is pending and will be handled by the backend team.
The frontend API service includes comments documenting the expected backend endpoints.
The mock configuration should remain enabled until the backend endpoints are implemented and verified.

### Pending Work

- Integrate the frontend with the real Opportunities backend.
- Connect external opportunity sources.
- Implement real opportunity search and filtering.
- Connect backend match scoring and intent extraction.
- Implement persistent dismiss and restore functionality.
- Test real search results and source failure handling.
- Verify end-to-end integration with the existing Leads module.

**Current Status:** Find Opportunities frontend implementation and initial browser testing completed. Awaiting backend integration.
