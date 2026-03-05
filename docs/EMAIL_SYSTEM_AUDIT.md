# Email System Audit

**Date:** 2026-03-05 (updated)  
**Scope:** Universal engagement model, simplified cadence, AI summary

---

## Executive Summary

The email system was refactored from a fragmented model (separate `lastContactedAt`, `lastRespondedAt`, `remindMeOn`, threading logic) into a **universal engagement model**:

- **One date**: `lastEngagementDate` — most recent interaction, regardless of direction
- **One type**: `lastEngagementType` — OUTBOUND_EMAIL, CONTACT_RESPONSE, MEETING, MANUAL
- **One summary**: `summary` on `email_activities` — AI-generated, used for future smart compute
- **Two actions**: Parse (dumb ingest) and Calculate Engagement (smart compute) are separate

---

## Architecture: Before vs After

### Before (fragile)
```
Contact had: lastContactedAt, lastRespondedAt, remindMeOn, nextContactedAt, nextEngagementDate
Cadence logic: "did they respond after our last contact?" → pipeline branching → 6+ rules
Writers: each path set different fields (some set lastContactedAt, some lastRespondedAt)
Result: ping-pong on dates, inconsistent state
```

### After (clean)
```
Contact has: lastEngagementDate, lastEngagementType, nextEngagementDate
Cadence logic: lastEngagementDate + 7 days (if no nextEngagementDate already set)
Writers: all paths call stampLastEngagement(contactId, date, type)
Result: one field, one stamp function, no ping-pong
```

---

## The Flow

### Ingest (Parse → Record Activity)
```
1. AI Parse → extract contact, subject, body, summary, nextEngagementDate
2. Contact Lookup → find matching contact
3. Log email_activities → with summary, emailRawText
4. stampLastEngagement(contactId, date, type) → updates lastEngagementDate
5. Set nextEngagementDate → only if AI parsed one or user overrode
6. Pipeline shift → prospect/need-to-engage → engaged-awaiting-response
7. Mark InboundEmail as PROMOTED
```

### Calculate Engagement (separate button)
```
POST /api/contacts/[contactId]/compute-engagement
1. Read lastEngagementDate from Contact
2. If nextEngagementDate already set → keep it
3. If doNotContactAgain → null
4. If no lastEngagementDate → null
5. Default: lastEngagementDate + 7 days → persist as nextEngagementDate
```

### Future: AI-Informed Compute
```
Read latest email_activities.summary for the contact
Use AI to determine: should cadence be 7 days? 30 days? never?
Example: summary says "deferred, follow up in 3-6 months" → set 4.5 months
```

---

## Schema Changes

### Contact Model (new fields)
```prisma
lastEngagementDate   DateTime?        // Universal: most recent interaction
lastEngagementType   EngagementType?  // OUTBOUND_EMAIL | CONTACT_RESPONSE | MEETING | MANUAL
```

### Contact Model (deprecated fields)
```prisma
lastContactedAt   DateTime?  // DEPRECATED: replaced by lastEngagementDate
lastRespondedAt   DateTime?  // DEPRECATED: replaced by lastEngagementDate
remindMeOn        DateTime?  // DEPRECATED: replaced by nextEngagementDate
```

### email_activities (new field)
```prisma
summary   String?  @db.Text  // AI-generated 1-2 sentence summary of the interaction
```

### EngagementType enum (new)
```prisma
enum EngagementType {
  OUTBOUND_EMAIL
  CONTACT_RESPONSE
  MEETING
  MANUAL
}
```

---

## All Writers — Unified

| Path | Endpoint | Engagement Type |
|------|----------|----------------|
| Platform send | `POST /api/outreach/send` | `OUTBOUND_EMAIL` |
| Off-platform send | `POST /api/contacts/[id]/off-platform-send` | `OUTBOUND_EMAIL` |
| Off-platform conversation | `POST /api/contacts/[id]/off-platform-conversation` | Last message type |
| Record response | `PUT /api/emails/[id]/response` | `CONTACT_RESPONSE` |
| Inbound parse record | `POST /api/inbound-parse/push-to-ai` | `CONTACT_RESPONSE` or `OUTBOUND_EMAIL` |
| Email draft/create | `POST /api/emails` | `OUTBOUND_EMAIL` |

All call `stampLastEngagement(contactId, date, type)` which:
- Only moves `lastEngagementDate` forward (never overwrites a newer date)
- Updates `lastEngagementType` to the type of the latest engagement

---

## Cadence Service — Simplified

### `stampLastEngagement(contactId, date, type)`
Replaces `snapContactLastContactedAt`. Universal stamp for any engagement.

### `calculateNextSendDate(contactId)`
1. `doNotContactAgain` → null
2. `nextEngagementDate` already set → return it
3. No `lastEngagementDate` → null
4. Default: `lastEngagementDate + 7 days`

### `computeAndPersistNextEngagement(contactId)`
Calls `calculateNextSendDate` → persists result to `nextEngagementDate`.

### Removed
- All `lastContactedAt` / `lastRespondedAt` logic
- Pipeline branching (connector/forwarded special case)
- `remindMeOn` fallback
- Activity-scanning for "last send date"

---

## UI Changes

### Inbound Parse Page (`/inbound-parse`)
- **Parse & Preview** → 4-step read-only pipeline with AI summary display
- **Record Activity** → dumb ingest (log + stamp + pipeline shift)
- **Calculate Engagement** → new button, calls compute endpoint, shown after record or when contact is matched
- AI summary displayed prominently in Step 1

---

## Backfill Migration (run once)

```sql
-- Backfill lastEngagementDate from the newer of lastContactedAt/lastRespondedAt
UPDATE contacts
SET "lastEngagementDate" = GREATEST("lastContactedAt", "lastRespondedAt"),
    "lastEngagementType" = CASE
      WHEN "lastRespondedAt" IS NOT NULL AND ("lastContactedAt" IS NULL OR "lastRespondedAt" >= "lastContactedAt")
      THEN 'CONTACT_RESPONSE'
      ELSE 'OUTBOUND_EMAIL'
    END
WHERE "lastEngagementDate" IS NULL
  AND ("lastContactedAt" IS NOT NULL OR "lastRespondedAt" IS NOT NULL);

-- Backfill remindMeOn → nextEngagementDate (if not done already)
UPDATE contacts
SET "nextEngagementDate" = to_char("remindMeOn"::date, 'YYYY-MM-DD')
WHERE "nextEngagementDate" IS NULL AND "remindMeOn" IS NOT NULL;
```

After backfill, the deprecated columns can be dropped.

---

## File Reference

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Schema: lastEngagementDate, lastEngagementType, summary, EngagementType enum |
| `lib/services/emailCadenceService.js` | stampLastEngagement, calculateNextSendDate, computeAndPersistNextEngagement |
| `lib/services/takeCrmClientEmailAndParseAiService.ts` | AI parse with summary extraction |
| `lib/services/nextEngagementService.js` | Read contacts with nextEngagementDate |
| `app/api/inbound-parse/parse/route.ts` | 4-step parse pipeline (read-only) |
| `app/api/inbound-parse/push-to-ai/route.ts` | Record InboundEmail → email_activities |
| `app/api/contacts/[contactId]/compute-engagement/route.js` | Calculate + persist nextEngagementDate |
| `app/api/contacts/[contactId]/off-platform-send/route.js` | Record off-platform send |
| `app/api/contacts/[contactId]/off-platform-conversation/route.js` | Record off-platform conversation |
| `app/api/outreach/send/route.js` | Platform send via SendGrid |
| `app/api/emails/[emailId]/response/route.js` | Record response to outbound |
| `app/api/emails/route.js` | Create email draft/activity |
| `app/(authenticated)/inbound-parse/page.jsx` | Inbound parse UI with Calculate Engagement |
