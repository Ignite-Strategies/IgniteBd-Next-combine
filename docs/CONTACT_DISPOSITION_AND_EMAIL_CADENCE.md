# Contact disposition and email cadence — separated concerns

## What drives the Outreach dashboard "Next email sends"

1. **UI:** The "Next email sends" card (e.g. "Due Feb 26 - Mar 5") calls **GET /api/outreach/reminders** with `companyHQId` and date range (`dateFrom`, `dateTo`).
2. **API:** That route calls **reminderService.getRemindersForDateRange(companyHQId, { dateFrom, dateTo })**.
3. **Reminder service:** For each contact it calls **emailCadenceService.calculateNextSendDate(contactId)** (and getLastSendDate) to see if their next send falls in the range. It does **not** query `nextEngagementDate` itself; the failure happened because **calculateNextSendDate** was selecting `nextEngagementDate` on Contact.
4. **Cadence service:** Returns next send date from: stored date (remindMeOn / nextContactedAt), or computed: no response → 7d, responded + connector/forwarded → 7d.

So the **date logic** is: reminder service (who’s due in this range) → cadence service (when is this contact’s next send). Pipeline + sequence order live in the cadence service.

**Pre-migration:** The DB doesn’t have `contacts.nextEngagementDate` (or `contactDisposition`) until you run the migration. The cadence service is written to **not** select those columns so the app works before migration. After you run the migration, you can add `nextEngagementDate` to the contact select and use `nextEngagementDate ?? remindMeOn ?? nextContactedAt` for stored date.

**To fix the Prisma error:** Either (1) run the migration (`prisma migrate deploy` in prod, or `prisma migrate dev` locally) so the new columns exist, or (2) keep the current code that avoids selecting them (already done). Regenerate Prisma client alone doesn’t create DB columns — you have to run the migration.

---

## 1. ContactDisposition (general attitude)

- **What:** General awareness of the contact — happy to receive a note vs doesn't care.
- **Where:** On **Contact** (`contactDisposition`). Manual for now; future state: AI reads email response and infers.
- **Values:** `HAPPY_TO_RECEIVE_NOTE` | `NEUTRAL` | `DOESNT_CARE`.
- **Not:** Pipeline or “where they landed.” That’s pipeline. This is just attitude.

---

## 2. Friend pipeline (new)

- **Pipeline:** `friend` (singular).
- **Stages:** `awaiting_next_job`, `navigating`.
- **Transition:** When they get a job → move to **connector** pipeline (e.g. they can forward intros).

---

## 3. Email cadence service (renamed from follow-up calculator; not the reminder service)

- **Renamed:** The **follow-up calculator** (`followUpCalculator.js`) was renamed to **email cadence service** (`emailCadenceService.js`). That’s the module that computes *when* the next send should be (sequence order + pipeline).
- **Unchanged:** The **reminder service** (`reminderService.js`) is still the “remind” layer: it answers “who’s due for follow-up?” and “reminders for this date range,” and it *uses* the cadence service under the hood. So: cadence = when to send; reminder = who’s due / list of reminders.

**Two-fold:**

**(a) Sequence order** — Contact must respond. We use sequence to know:
- Did they respond after our last send? (e.g. `hasResponded` on last send row, or response-as-row later.)

**(b) Pipeline = source of truth** — Next send is determined by pipeline (and stage), not by a separate “engagement disposition” enum.

**Rules we’re solving for:**

1. **If don’t respond** (after last send) → **auto 7 days**.
2. **If do respond** → Check where they landed: **connector + forwarded** (but not introduction-made) → **7 days**.

Other cases (responded but different pipeline/stage) → no auto next; manual or stored date if set.

**Cadence:** Hardcoded (e.g. 7 days) for now; we’ll add sequence tuner logic later and see where we land.

---

## Future: sequence tuner

In general we’ll want tunable cadence (e.g. per pipeline, stage, or sequence). For now cadence is hardcoded so we can validate behavior; tuner can plug in later (e.g. `getCadenceDays(pipeline, stage)` or sequence-level config).

---

## Summary

| Concern | Lives where | Purpose |
|--------|-------------|--------|
| ContactDisposition | Contact | General attitude (manual; future AI). |
| Where they landed | Pipeline + stage | Source of truth for cadence (connector/forwarded → 7d). |
| Sequence order | email_activities | Did contact respond after last send? |
| Next send | emailCadenceService | No response → 7d; responded + connector/forwarded → 7d. |
