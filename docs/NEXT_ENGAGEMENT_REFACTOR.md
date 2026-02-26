# Next engagement refactor — summary

## Source of truth

- **Contact.nextEngagementDate** (and **nextEngagementPurpose**) is the single DB source of truth for "when to engage this contact next."
- **Contact.lastContactedAt** / **lastRespondedAt** remain for snaps; **last engagement** context is still derived from email_activities + these snaps where needed.

## What changed

1. **Reminder service removed** — No more per-contact compute in a "reminder" layer. Replaced by **nextEngagementService**: one query by `nextEngagementDate` (return all; frontend can bucket: "Happening today", "In 7 days", "Next month").

2. **emailCadenceService** — Still uses hardcoded 7-day (and pipeline) rules. Now:
   - **Reads** stored date from **nextEngagementDate** first (then remindMeOn, nextContactedAt).
   - **Writes** via **computeAndPersistNextEngagement(contactId)**: computes next send and updates `Contact.nextEngagementDate` (and purpose). Called after send, after response, and by recalculate.

3. **Hydration** — GET `/api/outreach/reminders?companyHQId=xxx` returns **all contacts with nextEngagementDate set** (single query). No date range filter; frontend parses and groups by date.

4. **Recalculate** — To backfill / refresh next engagement for existing contacts:
   - **Script:** `node scripts/recalculate-next-engagement.js [companyHQId]` (omit companyHQId for all contacts).
   - **UX/API:** POST `/api/outreach/recalculate-next-engagement?companyHQId=xxx` (auth required). Use for a "Recalculate" button on the dashboard.

5. **Contact detail** — Shows **next engagement** date and purpose; **edit** (inline date + purpose, Save) via PATCH `/api/contacts/[contactId]/next-engagement`.

6. **Remind-me** — PUT `/api/contacts/[contactId]/remind-me` still accepts `remindMeOn`; it now also sets **nextEngagementDate** and **nextEngagementPurpose = 'manual'** so the universal field is updated.

7. **Schema** — Already has `nextEngagementDate`, `nextEngagementPurpose`, `contactDisposition`. Run **prisma generate** (done). Run **migration** so the columns exist in the DB (`prisma migrate deploy` or `prisma migrate dev`).

## Checklist

- [ ] Run migration so `nextEngagementDate` / `nextEngagementPurpose` (and `contactDisposition`, `emailSequenceOrder`, etc.) exist in the DB.
- [ ] Run recalculate (script or POST recalculate API) once to backfill next engagement for existing contacts.
- [ ] Frontend: update "Next email sends" to consume new reminders response (list of contacts with `nextEngagementDate`; bucket into "Happening today", "In 7 days", "Next month" as desired).
- [ ] Optional: add "Recalculate" button on outreach dashboard that calls POST `/api/outreach/recalculate-next-engagement`.
