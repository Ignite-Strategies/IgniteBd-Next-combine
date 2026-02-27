# Next Engagement: Date-Only (YYYY-MM-DD) Refactor

## Why This Removes Timezone Bugs

Previously, `nextEngagementDate` was stored as a **DateTime** (timestamp). That caused:

- **`new Date("YYYY-MM-DD")`** in JavaScript is interpreted as **UTC midnight**, so in EST the same value displays as the **previous** calendar day (e.g. user picks Feb 26 → stored as Feb 26 00:00 UTC → in EST shows Feb 25).
- Server “today” (e.g. `setHours(0,0,0,0)`) and browser “today” could differ by timezone.
- Any comparison or display that mixed UTC midnight with local “today” produced “yesterday” / “today” mismatches.

By making `nextEngagementDate` a **date-only** value (`"YYYY-MM-DD"` string):

1. **No timestamp** → no midnight UTC vs local conversion. The value *is* the calendar day.
2. **Comparisons** are string comparison: `nextEngagementDate <= todayString`. Same semantics everywhere.
3. **Display** formats the stored string (e.g. via `formatDateEST`) without re-interpreting a timestamp.
4. **Derivation** adds days in **calendar-day space** (add days to YYYY-MM-DD), not in timestamp space, so the intended day is preserved.

So we eliminate timezone drift entirely for this field.

---

## What Changed

### 1. Data model

- **Schema:** `nextEngagementDate` is now `String?` (ISO date only `"YYYY-MM-DD"`). No DateTime.
- **Migration:** Existing `TIMESTAMP(3)` values are converted to `VARCHAR(10)` using UTC calendar date: `to_char("nextEngagementDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD')`.

### 2. Derivation (cadence)

- **Input:** Start from the original timestamp (e.g. `sentAt`, `respondedAt`).
- **Step:** Convert to **calendar date** (UTC): `toDateOnlyString(d)` → `d.toISOString().slice(0, 10)`.
- **Step:** Add cadence days in **calendar-day space**: `addDaysToDateString(dateStr, 7)` (no `setUTCDate` on a DateTime that we then store).
- **Output:** Store the result as `"YYYY-MM-DD"` only.

### 3. Comparison logic

- **Due / today:** `nextEngagementDate <= todayString` where `todayString = new Date().toISOString().slice(0, 10)` (or, on frontend, local/EST YYYY-MM-DD).
- **No** `new Date(nextEngagementDate) <= new Date(...)` for this field.
- **due-for-followup:** `dueBy` is normalized to YYYY-MM-DD; filter with string comparison.
- **target-this-week:** Week range is YYYY-MM-DD strings; filter with `d >= weekStartStr && d <= weekEndStr`.

### 4. Today calculation

- **Frontend:** Can use `getTodayEST()` (EST) or `new Date().toLocaleDateString('en-CA')` (local) for “Due today” / “Due tomorrow” labels.
- **Backend:** Uses `new Date().toISOString().slice(0, 10)` for consistent server-side “today” when needed.
- No `setHours(0,0,0,0)` for next-engagement logic.

### 5. Rendering

- **UI** displays the stored date via formatting (e.g. `formatDateEST(contact.nextEngagementDate, { month: 'short', day: 'numeric', year: 'numeric' })`).
- Does **not** pass `nextEngagementDate` through `new Date(...)` except when formatting for display (and then we use a noon UTC or date-only parse to avoid shifting the day).
- **NextEngagementContainer** groups by `r.nextEngagementDate` (the string) directly; labels use EST “today” for “Due today” / “Due tomorrow”.

### 6. Migration

- **File:** `prisma/migrations/20260226120000_next_engagement_date_only/migration.sql`
- Converts existing `nextEngagementDate` DateTime values to `"YYYY-MM-DD"` in UTC, then alters column type to `VARCHAR(10)`.

---

## Files Touched

| Area | Files |
|------|--------|
| Schema | `prisma/schema.prisma` |
| Migration | `prisma/migrations/20260226120000_next_engagement_date_only/migration.sql` |
| Cadence | `lib/services/emailCadenceService.js` |
| Service / API | `lib/services/nextEngagementService.js`, `app/api/contacts/[contactId]/next-engagement/route.js`, `app/api/contacts/[contactId]/remind-me/route.js`, `app/api/contacts/due-for-followup/route.js`, `app/api/public/contacts/target-this-week/route.js` |
| UI | `components/outreach/NextEngagementContainer.jsx`, `app/(authenticated)/contacts/[contactId]/page.jsx` |

---

## Running the migration

```bash
npx prisma migrate deploy
# or for dev:
npx prisma migrate dev --name next_engagement_date_only
```

Then run recalculate if you want to recompute next engagement dates from cadence (optional):

```bash
node scripts/recalculate-next-engagement.js [companyHQId]
```
