# Next engagement — naming and where it lives

## One source of truth

- **Data:** `Contact.nextEngagementDate` (and `nextEngagementPurpose`). Written by cadence (send/response) and by remind-me / PATCH next-engagement.
- **Read path:** `getContactsWithNextEngagement(companyHQId)` in `lib/services/nextEngagementService.js` — one query. Returns list of contacts with next engagement set.

## One API for the list (hydrate only — no notifications yet)

- **GET /api/outreach/next-engagements?companyHQId=xxx&limit=500**
- Returns `{ success, nextEngagements }`. Each item: `contactId`, `firstName`, `lastName`, `email`, `goesBy`, `nextEngagementDate` (ISO), `nextEngagementPurpose`, `nextContactNote`, `lastContactedAt`, `lastRespondedAt`.
- No date filter in the API — consumer (web or future email) groups by date as needed.

**Deprecated:** GET /api/outreach/reminders (response key `reminders`). Use next-engagements.

## Web today

- **NextEngagementContainer** — React component on the outreach dashboard. Fetches next-engagements, shows all, grouped by date (Due today, Tomorrow, or date). No “alerts” / notifications; just the list. See **NEXT_ENGAGEMENT_UX_ROADMAP.md** for future (email, in-app “hey bro today is the day”).

## Other APIs that use the same source

- **GET /api/contacts/due-for-followup** — uses `getContactsWithNextEngagement`, optional `dueBy` filter.
- **GET /api/public/contacts/target-this-week** — uses `getContactsWithNextEngagement`, filters to current week, returns grouped by date.
