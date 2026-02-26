# What the reminder service was — exact behavior

## Did it make DB entries?

**No.** The reminder service (`lib/services/reminderService.js`) does **not** create or update any database rows. It has no `prisma.*.create()` or `prisma.*.update()` calls. It never writes to the DB.

---

## Did it hydrate DB entries?

**Only in the “read and shape” sense.** It:

1. **Reads** contacts from the DB with `prisma.contact.findMany()` (with a `where` and `select`).
2. **For each contact**, calls **emailCadenceService**:
   - `calculateNextSendDate(contact.id)` → uses more DB reads (contact findUnique, email_activities, pipelines) and **returns** a computed next send date (no write).
   - `getLastSendDate(contact.id)` → reads email_activities / contact, returns a date (no write).
3. **Builds an in-memory list** of “who’s due” or “who has a next send in this date range” from those computed values.
4. **Returns** that list. Still no DB writes.

So it **hydrates** the UI (and API responses) by **reading** existing DB data and **computing** “next send” per contact on the fly. It does **not** hydrate the database (i.e. it does not fill or update DB fields).

---

## Who does write “remind” data?

- **PUT /api/contacts/[contactId]/remind-me** — Updates `Contact.remindMeOn` (manual “remind me when” date). That’s the only place that **persists** a reminder date to the DB in the current flow.
- **emailCadenceService** — Only reads (and returns computed dates). It does not currently write `nextEngagementDate` or any other field.

---

## Summary

| Question | Answer |
|----------|--------|
| Does the reminder service create/update DB rows? | **No.** |
| Does it “hydrate” the DB (fill/update fields)? | **No.** |
| What does it do? | **Read** contacts (and, per contact, call cadence service to **compute** next send date), then **return** a list of contacts due or in range. So it **hydrates the API/UI** with computed “who’s due” data; it does not hydrate the database. |
| Where is “remind me” actually stored? | **Contact.remindMeOn**, written only by the **remind-me API route** (PUT). |

So: reminder service = **read-only + compute per contact**; no DB writes. The “remind” **storage** is `remindMeOn` on Contact, updated only by the remind-me route.

---

## What was it using for “source of truth”?

There **was no single DB source of truth** for “when to contact next.” It was **recomputed on every request** from several places:

| Input | Where it lived | Role |
|-------|----------------|------|
| **Last send date** | Derived from `email_activities` (event = sent or OFF_PLATFORM, `sentAt` or `createdAt`) plus `Contact.lastContactedAt` | “We last contacted on X” → then add 7 days for no-response, or use pipeline rules |
| **Manual “remind me”** | `Contact.remindMeOn` | If set, that date was the “next” (one real DB field, but only for user-set) |
| **Legacy manual next** | `Contact.nextContactedAt` | Same idea as remindMeOn, optional override |
| **Did they respond?** | `email_activities.hasResponded` / `respondedAt` on last send row | Decides no-response (7d) vs responded (then pipeline) |
| **Where they landed** | `pipelines.pipeline` + `pipelines.stage` | e.g. connector + forwarded → 7d from response |

So “next send” was **never stored** for the automatic case. It was **computed** from last send (from email_activities + lastContactedAt) + response state + pipeline. No column said “this contact’s next engagement is date Y.”

**Baseline in one sentence:** It was looking at **email_activities** (last send = sentAt/createdAt), applying the **7-day (and pipeline) logic** per contact, then **hydrating the list of contacts** whose computed next send fell in the range. So: email_activities + 7 (and rules) → compute per contact → return contacts who match. Not a single DB query for who’s due; it was compute-then-filter.

---

## The difference now: we need one DB field

**Now:** We want **one DB field as the record of truth**: `Contact.nextEngagementDate` (and optionally `nextEngagementPurpose`).

- **Cadence / send / response logic** → **writes** that field when something changes (send, response, manual remind).
- **Hydration** (“next email sends”, “who’s due”) → **reads** it: “contacts where nextEngagementDate between dateFrom and dateTo.” One query, no per-contact recompute.

So the shift is: **from “compute next send from last send + pipeline every time” to “store next engagement in the DB and read it.”** That’s the difference.
