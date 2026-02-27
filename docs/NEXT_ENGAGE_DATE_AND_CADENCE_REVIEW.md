# Next Engage Date & Email Cadence — Review

**Goal:** Ensure reminder logic is simple, timezone-safe, and scoped for low-volume CRM usage (1–5 users, &lt;100 contacts, manual follow-up). No overengineering.

---

## 1. Architecture Summary

| Layer | What it does |
|-------|----------------|
| **Data** | `Contact.nextEngagementDate` (Prisma `DateTime?`), plus legacy `remindMeOn` / `nextContactedAt`. Single source of truth for “when to engage next.” |
| **Cadence** | `lib/services/emailCadenceService.js`: computes next send date from pipeline + last send/response; persists to `nextEngagementDate`. Auto +7 days for unresponsive or connector/forwarded. |
| **Read** | `lib/services/nextEngagementService.js`: `getContactsWithNextEngagement(companyHQId)` — one query, returns all contacts with `nextEngagementDate` set (no “due” filter at DB). |
| **APIs** | `GET /api/outreach/next-engagements`, `GET /api/outreach/reminders`, `GET /api/contacts/due-for-followup` (optional `dueBy`), `GET /api/outreach/next-engagement-alerts` — all use the same service. |
| **UI** | `NextEngagementContainer`: fetches full list, groups by **EST calendar date** (America/New_York), labels “Due today” / “Due tomorrow” / date. |
| **Cron / jobs** | **None.** No scheduled job, no daily digest, no background runner. Reminders are on-demand (user opens dashboard / tracker). |

---

## 2. Data Model

### How is NextEngageDate stored?

- **Type:** `DateTime?` in Prisma (DB: `TIMESTAMP(3)`). So it is a **timestamp**, not a calendar-only date.
- **Timezone:** No timezone column. Stored in DB as UTC (Prisma/Postgres convention). The code intentionally sets **noon UTC** when computing auto cadence so that “the date” is unambiguous in EST (see `emailCadenceService.js` around 143–144, 168).
- **Embedded TZ:** No. Interpretation is by convention: “calendar day” is in EST for display and grouping.

### Should this be a pure DATE (YYYY-MM-DD)?

- **Current:** DateTime at noon UTC is a reasonable stand-in for “this calendar day in EST” and keeps one column.
- **Pure DATE:** Would simplify “today” logic and avoid any timestamp-vs-date mismatch. For a low-volume CRM, switching to a `Date`-only column (if your stack supports it) or consistently treating the value as “date-only” (e.g. always store noon UTC and compare by date) would reduce timezone surface area. **Recommendation:** Not required for correctness today; consider only if you later normalize all “due date” logic to date-only (see §6).

---

## 3. Reminder Logic — “Today” and Timezone

### Where “today” is calculated

| Location | How “today” is computed | Effective timezone |
|----------|--------------------------|--------------------|
| **emailCadenceService.js** | `const today = new Date(); today.setHours(0, 0, 0, 0);` then `toDays(storedDate)` = `(date - today) / (24*60*60*1000)` | **Server local** (e.g. Node/Vercel server TZ). |
| **remind-me GET** | Same: `today.setHours(0, 0, 0, 0)`, then `remindDate <= today` | **Server local.** |
| **NextEngagementContainer** | `getTodayEST()` from `lib/dateEst.js`: `new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })` → YYYY-MM-DD | **EST.** |
| **dateEst.js** | All helpers use `America/New_York` for “today” and day-diff / labels | **EST.** |

So: **cadence “due” (daysUntilDue ≤ 0) and remind-me “isDue” use server local time.** The **UI** (Due today / Tomorrow) uses EST. If the server is not in Eastern, a contact can be “due” in the API but show as “Tomorrow” in the UI (or the reverse) around midnight.

### Are we comparing timestamps or normalized dates?

- **Cadence:** Compares **timestamps**. `today` is midnight server-local; stored/next send dates are full timestamps (often noon UTC). So the comparison is timestamp-to-timestamp; “same calendar day” is not normalized to one timezone.
- **due-for-followup:** When `dueBy` is used, it’s `new Date(nextEngagementDate) <= new Date(dueBy)` — again **timestamp** comparison. Caller must pass `dueBy` in a way that matches intent (e.g. end-of-day in a chosen TZ).
- **UI:** Normalizes to **date in EST** for grouping and labels (`toESTDateString`, `formatDateLabelEST`). So the list is correct for “what day in EST” the user cares about; the only risk is mismatch with server-side “due” checks that use server local.

---

## 4. Query Layer — Due Follow-ups

### How due follow-ups are retrieved

- **Primary path:** `getContactsWithNextEngagement(companyHQId, { limit })`.  
  - **Query:** `WHERE crmId = ? AND doNotContactAgain = false AND nextEngagementDate IS NOT NULL`  
  - **No** `WHERE nextEngagementDate <= today`. So it returns **every** contact with a next engagement date; “due” is not enforced in the DB.
- **Filtering “due”:**
  - **UI:** Client groups by EST date and labels “Due today” / “Due tomorrow.” So “due” is effectively “calendar day in EST ≤ today EST.”
  - **GET /api/contacts/due-for-followup:** If `dueBy` is provided, filters **in memory**: `new Date(c.nextEngagementDate) <= new Date(dueBy)`. So “due” is only applied when the client passes `dueBy`; no default “today.”

### Are we unintentionally excluding same-day records?

- **Main list (next-engagements / reminders / alerts):** No exclusion. You get all contacts with `nextEngagementDate` set; same-day is included.
- **due-for-followup without `dueBy`:** Same — full list, no date filter.
- **due-for-followup with `dueBy`:** Depends on how `dueBy` is built. If the client sends `dueBy` as end-of-day in one timezone and the DB stores noon UTC, same-day records are included for that timezone; no systematic same-day exclusion. If `dueBy` were “start of today” in a different TZ than the stored timestamps, edge cases could theoretically exclude same-day — but the current design (full list + EST grouping in UI) avoids relying on that.

**Conclusion:** The system does **not** implement “WHERE nextEngagementDate <= today” in the database. “Due” is either (1) implied by the UI grouping in EST, or (2) applied in-memory when `dueBy` is supplied. So there’s no DB-level timezone-offset exclusion; the only subtlety is the server-local vs EST mismatch in the few places that do a “due” check (cadence `daysUntilDue`, remind-me `isDue`).

---

## 5. Email Cadence Service — Cron and Scale

### Is there a cron, scheduled job, or background runner?

- **No.** There is no cron, no Vercel Cron route, and no background worker for next-engagement or reminders. Docs (e.g. `OFF_PLATFORM_EMAIL_TRACKING.md`, `EMAIL_SEND_TRACKING_AND_REMINDERS_DEEP_DIVE.md`) describe a possible future cron for a daily digest; it is not implemented.

### Is that necessary for this scale?

- **No.** For 1–5 users and &lt;100 contacts, loading the list when the user opens the dashboard or tracker is enough. A daily cron would add moving parts without clear benefit.

### Can this be simplified to on-demand only?

- **It already is.** The flow is: user opens app → GET next-engagements → server returns all with `nextEngagementDate` set → UI groups by EST and shows “Due today,” etc. No need for a separate “due” job.

---

## 6. Overengineering Check

### What assumes high-volume automation?

- **Limit 500:** `getContactsWithNextEngagement` and APIs cap at 500. For &lt;100 contacts this is more than enough; the limit is harmless.
- **Recalculate script/API:** Runs `computeAndPersistNextEngagement` for every contact (or per company). For small contact sets this is fine; no batching or queue is needed.
- **Multiple entrypoints:** Several APIs return the same conceptual list (next-engagements, reminders, next-engagement-alerts, due-for-followup). For low volume, one endpoint would be enough; the rest can stay as thin wrappers for backward compatibility.

### Simplification suggestions (minimal viable reminder system)

1. **Unify “today” to EST in code**  
   In `emailCadenceService.js` and in `remind-me/route.js`, replace “today = midnight server local” with “today = start of calendar day in America/New_York” (e.g. derive YYYY-MM-DD in EST and compare dates, or use a small helper from `dateEst.js`). That way “due” (daysUntilDue ≤ 0, isDue) matches the UI’s “Due today” and avoids server-TZ surprises.

2. **Optional: single “due” API**  
   For a minimal surface, you could treat `GET /api/outreach/next-engagements` as the single source and deprecate or alias the others to it. No change to DB or cadence logic.

3. **Keep on-demand only**  
   Do not add a cron or scheduled job for this scale. If you later add a “daily digest” email, that can be a single cron that calls the existing API and sends one email; no change to how next-engage date or cadence works.

4. **Optional: date-only semantics**  
   If you want to remove timestamp nuance entirely, you could: (a) keep storing DateTime but always at noon UTC and document “date-only”; or (b) add a DB migration to a date-only type if your stack supports it, and normalize all reads/writes to calendar date in EST. This is a “nice to have,” not required for correctness today.

---

## 7. Timezone Risks (Summary)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Server “today” (cadence / remind-me) ≠ EST “today” (UI) | Low | Use EST “today” in cadence and remind-me (see §6). |
| `dueBy` in due-for-followup is timestamp; caller must know TZ | Low | Document that `dueBy` should be “end of day” in EST (or same TZ as UI) if used. |
| Stored DateTime at noon UTC is correct for “date” in EST | None | Already chosen to avoid “yesterday” in EST; keep. |

---

## 8. Refactor Steps (Minimal, Non-Breaking)

1. **EST “today” in cadence and remind-me**  
   - In `emailCadenceService.js`, replace the `today` / `toDays` logic with an EST-based “today” (e.g. `getTodayEST()` or equivalent) and compute day-diff in EST (e.g. reuse or mirror `dayDiffEST` from `dateEst.js`).  
   - In `app/api/contacts/[contactId]/remind-me/route.js` GET, compute `isDue` using the same EST “today” (e.g. compare EST date of `remindMeOn` to EST today).  
   - No schema or API contract change; behavior only aligns with the UI.

2. **Document**  
   - In `emailCadenceService.js` and `nextEngagementService.js`, add a one-line comment that “today” / “due” is defined in America/New_York for display and consistency.

3. **Optional later**  
   - Add a shared `isDueTodayEST(isoOrDate)` (or reuse `dayDiffEST` ≤ 0) and use it from cadence, remind-me, and any future “due” filter so all “due” checks stay consistent.

---

## 9. Conclusion

- **Data model:** NextEngageDate is stored as DateTime (UTC); no timezone in DB. No need to change to a separate DATE type for current scale; optional later for clarity.
- **Reminder logic:** “Today” in the UI is EST; in cadence and remind-me it is server local. Unifying to EST in those two places removes the only meaningful timezone inconsistency.
- **Query layer:** Due follow-ups are “all contacts with nextEngagementDate set”; “due” is either UI grouping (EST) or optional in-memory filter via `dueBy`. No DB `nextEngagementDate <= today`; no unintended same-day exclusion from the query itself.
- **Cron:** None, and none needed for 1–5 users and &lt;100 contacts. On-demand list is sufficient.
- **Overengineering:** Limits and multiple APIs are benign. The only simplification that matters is aligning “today” with EST in code; the rest can stay as-is for a minimal viable reminder system.
