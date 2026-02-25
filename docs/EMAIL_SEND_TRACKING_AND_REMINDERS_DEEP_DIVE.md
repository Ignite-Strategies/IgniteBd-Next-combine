# Email Send Tracking & Reminders — Deep Dive

**Purpose:** Single reference for how we track email sends, log/parse them, compute “who is due when,” and support manual vs automatic reminders.

**Related:** [OUTREACH_TRACKER_AND_CONTACT_DETAIL_INTEGRATION.md](./OUTREACH_TRACKER_AND_CONTACT_DETAIL_INTEGRATION.md), [OFF_PLATFORM_EMAIL_TRACKING.md](./OFF_PLATFORM_EMAIL_TRACKING.md), [CURRENT_LAST_SEND_TRACKING.md](./CURRENT_LAST_SEND_TRACKING.md)

---

## 1. How We Track Email Sends

We track sends in three places; the first two are the **source of truth for “last send” and due dates**, and the third is a **unified view** used by the Outreach Tracker and response tracking.

### 1.1 Platform sends (through Ignite)

**When:** User sends via the app (e.g. Outreach → Compose) and we call SendGrid.

**Flow:**

1. `POST /api/outreach/send` builds the SendGrid payload (with `custom_args`: `contactId`, `ownerId`, optional `emailId`, etc.), sends the email, then:
2. **`email_activities`** — one row per send:
   - `contact_id`, `owner_id`, `email`, `subject`, `body`, `messageId`, `event: 'sent'`, `createdAt`
3. **`emails`** — unified record:
   - If compose UX passed `emailId`: **update** that row with `messageId`, `emailActivityId`, `sendDate`.
   - Else if `contactId` present: **create** a row with `contactId`, `sendDate`, `subject`, `body`, `source: 'PLATFORM'`, `platform: 'sendgrid'`, `messageId`, `emailActivityId`, optional `campaignId`/`sequenceId`.

**Files:** `app/api/outreach/send/route.js` (creates both `email_activities` and `emails`).

So: **every platform send** is logged in both `email_activities` and `emails`.

### 1.2 Off-platform sends (manual entry)

**When:** User logs an email they sent outside Ignite (Gmail, Outlook, Apollo, etc.) or saves a draft.

**Flow:**

1. `POST /api/contacts/[contactId]/off-platform-send` with body:
   - `emailSent` (ISO date, optional — omit for draft)
   - `subject`, `platform`, `body`/`notes` (optional)
2. **`off_platform_email_sends`** — one row:
   - `contactId`, `emailSent` (null = draft), `subject`, `platform`, `notes`
3. **`emails`** — **not** created by this route today. So contacts with *only* off-platform sends have no `emails` row.

**Files:** `app/api/contacts/[contactId]/off-platform-send/route.js`.

**Implication:** “Last send” and “next follow-up” still work for off-platform-only contacts (see §2), but the **Outreach Tracker** list is built from contacts that have at least one `emails` row. So off-platform-only contacts do **not** appear in the tracker table unless we later add creation of an `emails` row from this API.

### 1.3 Unified `emails` model

**Role:** Single table for “all emails to this contact” with response state, used by:

- Outreach Tracker (who has sends, filters, “has responded”)
- Contact detail (email history when backed by `emails`)
- Response recording (`hasResponded`, `contactResponse`, `respondedAt`)

**Schema (relevant):** `contactId`, `sendDate`, `subject`, `body`, `source` (PLATFORM | OFF_PLATFORM), `platform`, `hasResponded`, `contactResponse`, `respondedAt`, `responseSubject`, `emailActivityId`, `offPlatformSendId`, `messageId`, `campaignId`, `sequenceId`.

**Populated by:**

- Platform: in `outreach/send` (create or update by `emailId`).
- Off-platform: currently **not** auto-created from `off-platform-send`; only platform sends and manual/other flows that write to `emails` get a row.

---

## 2. Parsing / Logging (Events & Responses)

### 2.1 SendGrid webhook (delivery events)

**Endpoint:** `POST /api/webhooks/sendgrid`

**What it does:** Receives SendGrid events (processed, delivered, opened, clicked, bounce, dropped, etc.). For each event:

- Finds **`email_activities`** by `messageId` (from `sg_message_id`).
- Updates that row’s **`event`** to the new event type (e.g. `delivered`, `opened`).
- If no activity exists but `ownerId` is in custom args, **creates** an `email_activities` row (fallback so we don’t drop events).

**What it does *not* do:** It does **not** update the unified **`emails`** table or set **`hasResponded`**. So delivery/open/click are only on `email_activities.event`.

**Files:** `app/api/webhooks/sendgrid/route.js`.

### 2.2 Recording a reply (response from contact)

**Endpoint:** `PUT /api/emails/[emailId]/response`

**Body:** `contactResponse` (required), optional `respondedAt`, `responseSubject`.

**What it does:**

- Updates the **`emails`** row for `emailId`: sets `hasResponded: true`, `contactResponse`, `respondedAt`, `responseSubject`.
- If the contact has a deal pipeline in `engaged-awaiting-response`, moves it to **interest**.

So **response state lives on `emails`** and is set **manually** via this API (no inbound-parse or webhook writing to `emails` in the current codebase).

**Files:** `app/api/emails/[emailId]/response/route.js`.

---

## 3. “Who Is Due When” — Logic and Data

### 3.1 Last send date

**Service:** `lib/services/followUpCalculator.js` → **`getLastSendDate(contactId)`**

**Logic:**

- **Platform:** latest `email_activities` with `contact_id = contactId` and `event = 'sent'`, ordered by `createdAt desc`.
- **Off-platform:** latest `off_platform_email_sends` for `contactId`, ordered by `emailSent desc`.
- **Result:** `max(platformLatest, offPlatformLatest)`; null if neither exists.

So both platform and off-platform sends are used for “last send,” regardless of whether an `emails` row exists.

### 3.2 Next follow-up date (cadence)

**Service:** `lib/services/followUpCalculator.js` → **`calculateNextSendDate(contactId, config?)`**

**Logic:**

1. Load contact’s **`prior_relationship`** (COLD, WARM, ESTABLISHED, DORMANT).
2. Get **last send date** via `getLastSendDate(contactId)`.
3. If no last send → return `nextSendDate: null`, `daysUntilDue: null`.
4. Cadence (days) by relationship (defaults):
   - COLD: 7  
   - WARM: 3  
   - ESTABLISHED: 14  
   - DORMANT: 30  
   Overridable via `config` (e.g. `coldFollowUpDays`, `warmFollowUpDays`, etc.).
5. **Next send date** = last send date + cadence days.
6. **Days until due** = calendar days from today to that date (negative = overdue).

**API:** `GET /api/contacts/[contactId]/next-send-date` — returns `nextSendDate`, `lastSendDate`, `daysUntilDue`, `relationship`, `cadenceDays`, `isDue`.

### 3.3 Manual reminder (`remindMeOn`)

**Field:** `Contact.remindMeOn` (DateTime, optional) — “remind me to contact this person on this date.”

**APIs:**

- **Set/clear:** `PUT /api/contacts/[contactId]/remind-me` — body `{ remindMeOn: ISO date string | null }`.
- **Read:** `GET /api/contacts/[contactId]/remind-me` — returns `remindMeOn`, `isDue`, `daysUntilReminder`.

**Priority:** When we need “the” next date for a contact, **manual reminder wins** if set and earlier than the cadence-based next send (see tracker and reminder service below).

---

## 4. Reminder Service — Who Is Due for Follow-Up

**Service:** `lib/services/reminderService.js` → **`getContactsDueForFollowUp(companyHQId, options)`**

**Options:** `daysOverdue`, `limit`, `includeManualReminders` (default true).

**Logic:**

1. Load contacts for the company (`crmId = companyHQId`), including `remindMeOn`.
2. For each contact:
   - **Manual:** If `includeManualReminders` and `remindMeOn` is set and due (or overdue) by at least `daysOverdue` days → include with `reminderType: 'manual'`.
   - **Automatic:** Else use **`calculateNextSendDate`** and **`getLastSendDate`**; if there is a next send date and the contact is due/overdue by at least `daysOverdue` → include with `reminderType: 'automatic'`.
3. Sort by most overdue first; apply `limit`.

**API:** `GET /api/contacts/due-for-followup?companyHQId=xxx&daysOverdue=0&limit=100&includeManualReminders=true`  
Returns list of contacts with `reminderType`, `lastSendDate`, `nextSendDate`, `daysOverdue`, `relationship`, `cadenceDays`, `remindMeOn` (if manual).

**Used by:**

- **Due-for-followup API** (above).
- **Target-this-week:** `GET /api/public/contacts/target-this-week?companyHQId=xxx` — uses `getContactsDueForFollowUp` with `daysOverdue: -7` then filters to the current week and groups by date (“who is due when” by day).

---

## 5. Outreach Tracker — “Who Is Due When” in the UI

**Page:** `/outreach/tracker?companyHQId=xxx`  
**File:** `app/(authenticated)/outreach/tracker/page.jsx`

**API:** `GET /api/outreach/tracker`  
**File:** `app/api/outreach/tracker/route.js`

### 5.1 Who appears in the list

- Contacts that have **at least one row in `emails`** for the company and matching filters (send date range, follow-up date range, `hasResponded`).
- So: **platform-sent contacts** are always eligible. **Off-platform-only** contacts (no `emails` row) are **not** in this list today.

### 5.2 Per-contact data

For each contact in the list the API:

1. Loads **email history** from **`emails`** (for table and filters).
2. Gets **last send date** via **`getLastSendDate(contact.id)`** (from `email_activities` + `off_platform_email_sends`).
3. Gets **next send date** via **`calculateNextSendDate(contact.id)`**.
4. If contact has **`remindMeOn`** and it’s earlier than the cadence-based next send, uses **`remindMeOn`** as the effective “next follow-up” date.
5. Optionally filters by follow-up date range.
6. Returns: contact fields, `lastSendDate`, `nextSendDate`, `daysUntilDue`, `emailCount`, `hasResponded` (from `emails`), list of `emails` (id, sendDate, subject, source, platform, hasResponded, respondedAt), `remindMeOn`.

### 5.3 Status badges (UI)

- **Responded** — any of the contact’s `emails` has `hasResponded`.
- **Overdue (Xd)** — `daysUntilDue < 0`.
- **Due today** — `daysUntilDue === 0`.
- **Due in Xd** — `daysUntilDue > 0`.
- **No follow-up** — no next send date.

Next follow-up column shows “(Manual)” when the effective date comes from `remindMeOn`.

---

## 6. Contact-Level Email History (Display)

**API:** `GET /api/contacts/[contactId]/email-history`  
**File:** `app/api/contacts/[contactId]/email-history/route.js`

**What it returns:** A combined timeline for the contact:

- **Platform:** from **`email_activities`** (`event = 'sent'`) — date, subject, email, event, campaignId.
- **Off-platform:** from **`off_platform_email_sends`** — split into drafts (`emailSent` null) and sent (`emailSent` set); date from `emailSent` or `createdAt` for drafts.
- Sorted with drafts first, then by date descending.  
So this “last email” / history view does **not** depend on the `emails` table; it uses the two source tables directly.

---

## 7. Auto Reminders (What Exists vs What’s Not Built)

### 7.1 What “auto” means today

- **Automatic *calculation* of “who is due when”:**
  - **Cadence-based:** last send + relationship-based days → next send date.
  - **Manual override:** `remindMeOn` overrides when earlier.
- **Surfacing:** Tracker page, `due-for-followup` API, and `target-this-week` API all use the same services to show “who is due when.” There is **no automated email or in-app notification** that pushes a daily digest to the user.

### 7.2 What’s not implemented

- **Cron / daily reminder digest:** Design in [OFF_PLATFORM_EMAIL_TRACKING.md](./OFF_PLATFORM_EMAIL_TRACKING.md) (e.g. `app/api/cron/daily-followup-reminders/route.ts`) is **not** present in the repo. So no scheduled job runs to “remind the user” by email or notification.
- **Inbound parse → `hasResponded`:** Replies are not parsed from an inbound webhook into `emails`; responses are recorded only via `PUT /api/emails/[emailId]/response`.
- **SendGrid webhook → `emails`:** Webhook updates only `email_activities.event`, not `emails.hasResponded`.

So “auto reminder” today = **automatic due-date calculation and listing** (tracker + due-for-followup + target-this-week). Pushing reminders to the user (email digest, in-app) is not implemented.

---

## 8. Quick Reference — Key Files & APIs

| What | Where |
|------|--------|
| Platform send logging | `app/api/outreach/send/route.js` → `email_activities` + `emails` |
| Off-platform send logging | `app/api/contacts/[contactId]/off-platform-send/route.js` → `off_platform_email_sends` only |
| Last send / next send (cadence) | `lib/services/followUpCalculator.js` (`getLastSendDate`, `calculateNextSendDate`) |
| Who is due (manual + cadence) | `lib/services/reminderService.js` (`getContactsDueForFollowUp`) |
| SendGrid events (delivered, opened, etc.) | `app/api/webhooks/sendgrid/route.js` → `email_activities.event` only |
| Record contact reply | `PUT /api/emails/[emailId]/response` → `emails.hasResponded`, etc. |
| Tracker list + “who is due when” | `GET /api/outreach/tracker`, `app/(authenticated)/outreach/tracker/page.jsx` |
| Due-for-followup list | `GET /api/contacts/due-for-followup` |
| Who to target this week | `GET /api/public/contacts/target-this-week` |
| Next send date for one contact | `GET /api/contacts/[contactId]/next-send-date` |
| Manual reminder set/get | `PUT/GET /api/contacts/[contactId]/remind-me` |
| Contact email history (display) | `GET /api/contacts/[contactId]/email-history` |

---

## 9. Summary

- **Sends:** Platform → `email_activities` + `emails`. Off-platform → `off_platform_email_sends` only (no `emails` row from that API).
- **Parsing/logging:** SendGrid webhook updates `email_activities.event`; response state is set only via `PUT /api/emails/[emailId]/response` on the unified `emails` table.
- **Who is due when:** `followUpCalculator` (last send from both sources + cadence by `prior_relationship`) and `reminderService` (manual `remindMeOn` first, then cadence). Displayed in the **Outreach Tracker** and in **due-for-followup** / **target-this-week** APIs.
- **Auto reminder:** Today = automatic due-date calculation and lists only. No cron, no digest email, no automated push to the user.
