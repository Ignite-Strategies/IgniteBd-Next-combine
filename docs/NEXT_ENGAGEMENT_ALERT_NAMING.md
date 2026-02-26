# Next engagement alert — unified naming and where it lives

## One source of truth

- **Data:** `Contact.nextEngagementDate` (and `nextEngagementPurpose`). Written by cadence (send/response) and by remind-me / PATCH next-engagement.
- **Read path:** `getContactsWithNextEngagement(companyHQId)` in `lib/services/nextEngagementService.js` — one query, no per-contact compute. Returns list of contacts with next engagement set.

## One API for “list to show or send”

- **GET /api/outreach/next-engagement-alerts?companyHQId=xxx&limit=500**
- Returns `{ success, alerts }`. Each item: `contactId`, `firstName`, `lastName`, `email`, `goesBy`, `nextEngagementDate` (ISO), `nextEngagementPurpose`, `nextContactNote`, `lastContactedAt`, `lastRespondedAt`.
- No date filter in the API — the consumer (web or email) filters and buckets by date.

**Deprecated:** GET /api/outreach/reminders — same data, response key `reminders`. Use next-engagement-alerts.

## Two presentations (same data)

| Channel | What it is | Same container? |
|--------|------------|------------------|
| **Web** | NextEngagementAlertContainer — React component on the outreach dashboard. Fetches alerts, filters to a date window (e.g. today → +7 days), groups by date, renders clickable rows and “See all” to tracker. | Yes, conceptually: same **data contract** (the `alerts` list). The “container” is the React UI. |
| **Email to client** | Future: a job or cron calls the same API, gets the same `alerts` list, and **packages** it into an email (e.g. “You have N next engagements this week”). Not a React component — it’s a **template** or **email body builder** that takes the list and returns HTML or plain text. No click-through in the email body (optional links to app). | Same **payload** (alerts), different **presentation**. So not the same “container” in code (web = component, email = template), but the same **next engagement alert** concept and API. |

So: **one API, one payload shape (“alerts”), two ways to present it** — web container (interactive) and email template (static list, optional links). Naming is unified: “next engagement alert” everywhere; no “reminder” in this flow.

## Other APIs that use the same source

- **GET /api/contacts/due-for-followup** — uses `getContactsWithNextEngagement`, optional `dueBy` filter.
- **GET /api/public/contacts/target-this-week** — uses `getContactsWithNextEngagement`, filters to current week, returns grouped by date.

Same service, same source of truth; different filters/use case.
