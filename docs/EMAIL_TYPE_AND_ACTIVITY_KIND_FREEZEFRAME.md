# Freeze-frame: EmailType vs activity kind — where it lives, pros/cons, naming

**Update:** We now use **EmailSequenceOrder** (SENT, CONTACT_RESPONDED, OWNER_RESPONSE) for “step in thread”; see **EMAIL_ACTIVITY_SEQUENCE_AND_RESPONSE_DEEP_DIVE.md**.

## Where EmailType lives today

### 1. Database (Prisma schema + migrations)

- **Enum:** `EmailType` is defined in the schema and **already exists in the DB** (created in baseline migration `20240101000000_baseline`):
  - `CREATE TYPE "EmailType" AS ENUM ('FIRST_TIME', 'FOLLOWUP');`
- **Before our change:** No table had a column of type `EmailType`. The enum existed but was unused in the schema (no `model.x emailType EmailType`).
- **After our change:** We added `emailType EmailType?` on `email_activities` so the row can store FIRST_TIME vs FOLLOWUP when we send.

So: **EmailType the enum** lives in the schema and in the DB; **the value** did not live on any row until we added it to `email_activities`.

### 2. Application code (computed, not stored)

- **TypeScript type:** `lib/services/EmailTypeDeterminationService.ts` defines `EmailType = 'FIRST_TIME' | 'FOLLOWUP'` and **computes** it at runtime:
  - No prior sends for contact → `FIRST_TIME`
  - Has prior sends → `FOLLOWUP` (with extra logic for persona/relationship/time)
- **Used by:** `OutreachEmailBuilderService`, `build-email` API, public contact detail. They call `EmailTypeDeterminationService.determineEmailType(contactId, ...)` and get `emailType` in the result. **Nothing reads emailType from the database.**

So: **EmailType the concept** lives in code as a **computed** value; it was never stored anywhere before we added the column.

---

## What we added (and then reverted) — activity kind vs EmailType

- We first added a **new** enum `EmailActivityKind` (SENT_INITIAL, SENT_REPLY, RESPONSE) and column `activityKind` on `email_activities`.
- You pointed out we already had a “type” for first vs follow-up: **EmailType**.
- We removed `EmailActivityKind` and switched to the **existing** `EmailType` enum and added column `emailType` on `email_activities` (FIRST_TIME / FOLLOWUP only; we did not add a “RESPONSE” row type to EmailType).

So now:

- **Schema:** `email_activities` has optional `emailType` (EmailType enum). Same two values: FIRST_TIME, FOLLOWUP.
- **Code:** We are not yet writing `emailType` when we create a send (we had removed that to avoid 500s before migration). When we do write it, we’d set FIRST_TIME vs FOLLOWUP the same way `EmailTypeDeterminationService` would compute it (e.g. no prior sends → FIRST_TIME, else FOLLOWUP).

---

## Naming and collision

- **No naming collision:** There is one enum name `EmailType` and one column name `emailType`. The TS type in `EmailTypeDeterminationService` is the same two literals (`'FIRST_TIME' | 'FOLLOWUP'`), so same concept, same names.
- **Overlap in meaning:** “First send vs follow-up send” is exactly what EmailType was for. So using `EmailType` on the row is consistent; we’re not introducing a second concept.

What we *don’t* have in EmailType is a value for “this row is a contact response” (response as its own row with `inReplyToActivityId`). That’s a different axis (who sent: us vs them). So:

- **EmailType:** “Our send was first outreach (FIRST_TIME) or a follow-up (FOLLOWUP).”
- **Response-as-row:** Would be “this row is a reply from the contact” — not represented by EmailType; we have `inReplyToActivityId` and optional future use of a separate concept if we ever model response as its own row.

---

## Pros / cons

### Storing `emailType` on `email_activities`

| Pro | Con |
|-----|-----|
| One source of truth: the row says what it was at send time. | Must set it when we create the activity (send + off-platform send). |
| No need to recompute from history for that row. | If we ever “reclassify” (e.g. change rules), we’d need a backfill. |
| Reuses existing enum; no new type name. | EmailType has only FIRST_TIME/FOLLOWUP; no value for “contact response” row. |
| Matches existing semantics (first vs follow-up). | Service that *computes* EmailType still exists; we could use it to set the column or keep using it when we don’t have a row yet. |

### Keeping it computed only (no column)

| Pro | Con |
|-----|-----|
| No schema/migration; no sync on send. | Same “first vs follow-up” concept exists in two places: enum in DB (unused) and TS in code. |
| Logic lives in one place (EmailTypeDeterminationService). | Every time we need the type we query history and compute. |

---

## Summary

- **EmailType lives in:**  
  - **Schema/DB:** enum `EmailType` (FIRST_TIME, FOLLOWUP), and now optionally on `email_activities.emailType`.  
  - **Code:** computed in `EmailTypeDeterminationService` and used by outreach/build-email; previously not read from any table.
- **Naming:** One enum, one column name; no collision. We removed the duplicate “activity kind” enum and use EmailType instead.
- **Choice:** Either store `emailType` when we create a send (and optionally use it where we today call `determineEmailType`), or leave it computed and don’t add the column (revert `emailType` on `email_activities`). Current state: column added in schema; migration and send code not yet writing it so we don’t 500 before migration.
