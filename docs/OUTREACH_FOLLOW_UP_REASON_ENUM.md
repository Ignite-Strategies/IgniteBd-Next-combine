# Outreach follow-up reason: enum and display

## Summary

**Client:** Connector (forwarded) follow-up in **7 days**. Detection: (1) easier — “responded since” = no response after last send (response string / hasResponded not there); (2) when we move person to “forwarded” stage, then Y days (e.g. 7) — first is easier than the second.

We have two distinct **business cases** that both use a **1-week** follow-up today:

1. **Non-response** — We sent to the contact; no reply yet. Follow up in 1 week.
2. **Forward, nothing heard back** — Contact (connector) said they’d forward or pass along; no update yet. Follow up in 1 week.

Right now the system does **not** differentiate these: both are “automatic” cadence (e.g. COLD = 7 days). This doc proposes adding a **follow-up reason** enum so we can **display** them differently and, later, apply different cadences or filters if needed.

---

## Current state

### How the next send date is set

- **`lib/services/followUpCalculator.js`**
  - Inputs: `contactId` → Contact’s `prior_relationship` (COLD, WARM, ESTABLISHED, DORMANT), `lastSendDate` (from `email_activities`: sent or OFF_PLATFORM with sentAt).
  - Overrides: `doNotContactAgain` → no next; `nextContactedAt` → manual “when to contact next.”
  - Otherwise: **cadence by relationship** only (e.g. COLD = 7, WARM = 3, ESTABLISHED = 14, DORMANT = 30).
  - Does **not** look at: `hasResponded`, pipeline, or stage.

- **`lib/services/reminderService.js`**
  - Adds **manual** reminders from `Contact.remindMeOn`.
  - For automatic: uses `calculateNextSendDate()` and exposes:
    - `reminderType`: `'manual'` | `'automatic'`
    - `cadenceDays` (e.g. 7)
  - No “reason” for the follow-up (no-response vs forward-no-reply).

### What we already have in the DB

- **`email_activities.hasResponded`** — Per activity: did the contact reply?
- **`Contact` → `pipelines`** (1:1) — `pipeline` (e.g. `'connector'`, `'prospect'`), `stage` (e.g. `'forwarded'`, `'engaged-awaiting-response'`).
- When someone records “they said they’d forward,” the response flow can set pipeline to **connector** + stage **forwarded** (see `app/api/emails/[emailId]/response/route.js`).

So we can **derive** “no response” vs “forwarded, no update” without new columns: last send + no subsequent response, and pipeline/stage for “connector / forwarded.”

---

## Proposed: follow-up reason enum

### Values (for display and future logic)

| Value | Meaning | Typical cadence today | Display idea |
|-------|---------|------------------------|--------------|
| `MANUAL` | User-set “remind me on” date | N/A | “Manual reminder” (already used) |
| `NO_RESPONSE` | We sent; contact has not replied | 1 week (e.g. COLD) | “Follow-up (no response)” |
| `FORWARDED_AWAITING` | Connector said they’d forward; no update yet | 1 week | “Follow-up (forwarded, no update)” |
| `CADENCE` | Other automatic (e.g. WARM/ESTABLISHED cadence) | 3–14+ days | “Follow-up” or “Follow-up (cadence)” |

So we’d **differentiate** the two 1-week cases in the UI and in the API, even if cadence is the same today.

### When each applies

- **MANUAL** — `Contact.remindMeOn` is set; reminder uses that date. (Existing.)
- **NO_RESPONSE** — Last send (from `email_activities`) has no **later** activity with `hasResponded: true` for that contact. I.e. “we sent, they haven’t replied.” Use relationship-based cadence (e.g. COLD 7 days).
- **FORWARDED_AWAITING** — Contact has `pipelines.pipeline === 'connector'` and `pipelines.stage === 'forwarded'`, and again no response after last send. Same 1-week logic, but we **tag** it as “forwarded, no update.”
- **CADENCE** — Automatic follow-up that doesn’t fit the above (e.g. WARM 3-day, ESTABLISHED 14-day). Could be a catch-all or we could add more reasons later (e.g. “meeting follow-up”).

Edge cases to define clearly:

- Contact has **both** a manual `remindMeOn` and an automatic next date → we already prefer manual; that stays, and reason = `MANUAL`.
- Connector who **has** responded since we set “forwarded” → treat as normal cadence or a different reason (e.g. still `FORWARDED_AWAITING` until we have a “forward completed” or “introduction-made” concept).

---

## Implications in code

### 1. `lib/services/followUpCalculator.js`

- **Option A (minimal):** Add an optional return field, e.g. `followUpReason: 'NO_RESPONSE' | 'FORWARDED_AWAITING' | 'CADENCE' | null`.
  - After computing `nextSendDate` from cadence, do:
    - Load last send activity and check if any **later** activity has `hasResponded`.
    - If no response → `NO_RESPONSE` or `FORWARDED_AWAITING` depending on pipeline/stage; else `CADENCE`.
  - Requires: `contactId` → need to load `pipelines` (or pass in) and last N `email_activities` for that contact to see “any response after last send.”
- **Option B:** New helper, e.g. `getFollowUpReason(contactId, lastSendDate, nextSendDate)` that takes lastSendDate and returns reason, and call it from `calculateNextSendDate` or from reminderService after the fact.

Recommendation: **Option A** inside `calculateNextSendDate` (one place, one contract). Load pipeline and “has any response after last send” only when we’re computing automatic next date.

### 2. `lib/services/reminderService.js`

- For each reminder, pass through `followUpReason` from `calculateNextSendDate` (or from a small helper that calls it).
- Manual reminders: set `followUpReason: 'MANUAL'` (or keep `reminderType: 'manual'` and set reason only for automatic).
- Response shape: add `followUpReason` to each reminder object (e.g. `'manual' | 'no_response' | 'forwarded_awaiting' | 'cadence'` — can use snake_case in API even if we use UPPER in code).

### 3. API: `GET /api/outreach/reminders` and tracker

- **Reminders API:** Add to each reminder item, e.g. `followUpReason: 'no_response' | 'forwarded_awaiting' | 'cadence' | 'manual'.`
- **Tracker API** (`GET /api/outreach/tracker`): Same field on each contact/row so the list can show the reason.

### 4. UI: dashboard and tracker

- **Next email sends (dashboard):** Today we show “Manual reminder” vs “Follow-up.” We can show:
  - Manual reminder
  - Follow-up (no response)
  - Follow-up (forwarded, no update)
  - Follow-up
- **Tracker:** Same labels in the “type” or “status” column (or a small badge). Optional: filter by `followUpReason`.

### 5. Schema

- **No DB migration required** for the enum itself: it’s derived from existing data (last send, `hasResponded`, `pipelines.pipeline` / `stage`). If we ever want to **store** the reason (e.g. for reporting or overrides), we could add a column later; for now, compute on read.

### 6. Config / cadence

- Today both NO_RESPONSE and FORWARDED_AWAITING use the same 1-week (e.g. COLD). If we later want different cadences (e.g. 5 days for “forwarded,” 7 for “no response”), we could:
  - Add a small config or constants (e.g. `CADENCE_DAYS_FORWARDED_AWAITING = 7`) and use it in `followUpCalculator` when we detect connector/forwarded; or
  - Keep one cadence and only use the enum for display/filtering.

---

## Implementation checklist (for when you implement)

- [ ] **followUpCalculator**
  - Load Contact’s `pipelines` (pipeline, stage).
  - For last send: determine “has any `email_activities` for this contact after lastSendDate with `hasResponded: true`.”
  - Return `followUpReason`: `NO_RESPONSE` | `FORWARDED_AWAITING` | `CADENCE` (and keep manual path separate in reminderService).
- [ ] **reminderService**
  - When building automatic reminders, include `followUpReason` from calculator.
  - When building manual reminders, set `followUpReason: 'MANUAL'`.
  - Ensure date-range reminder and “due for follow-up” list both expose it.
- [ ] **API**
  - Reminders: add `followUpReason` to each item (snake_case in JSON).
  - Tracker: add `followUpReason` per contact row.
- [ ] **UI**
  - Dashboard “Next email sends”: map reason to label (Manual reminder / Follow-up (no response) / Follow-up (forwarded, no update) / Follow-up).
  - Tracker: show same labels; optional filter by reason.
- [ ] **Tests**
  - Unit test: contact with no response after last send → NO_RESPONSE.
  - Unit test: connector/forwarded, no response → FORWARDED_AWAITING.
  - Unit test: contact with response after last send → CADENCE (or no reminder if we change logic).

---

## References

- `lib/services/followUpCalculator.js` — next send date from relationship + last send.
- `lib/services/reminderService.js` — reminders for dashboard and alerts; `reminderType` manual vs automatic.
- `lib/config/pipelineConfig.js` — connector stages: `forwarded`, `introduction-made`.
- `app/api/emails/[emailId]/response/route.js` — sets connector/forwarded when recording “said they’d forward.”
- `docs/OUTREACH_EMAIL_REMINDER_ALERT.md` — reminders API and dashboard/tracker UX.
