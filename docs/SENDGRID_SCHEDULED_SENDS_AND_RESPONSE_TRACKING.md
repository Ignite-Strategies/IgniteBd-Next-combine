# SendGrid: Scheduled Sends, Response Tracking, and Email Activity

## Summary

- **Scheduled sends:** Campaign has `scheduled_for` (app-level only). SendGrid’s native `send_at` is **not** used anywhere.
- **Response tracking:** SendGrid Event Webhook updates `email_activities.event` (delivered, opened, clicked, etc.). There is no “replied” event from SendGrid; replies are handled by **manual “Add Response”** or **Inbound Parse** (which does not yet link to a prior send).
- **“Responded and log it”:** Yes. Use **Add Response** on an email activity → `PUT /api/emails/[emailId]/response` creates a CONTACT_SEND row and sets the parent’s `responseFromEmail`.
- **Outbound vs email_activity:** There is no separate “outbound” table. **All** email (platform SendGrid, off-platform manual, record-off-platform, inbound) lives in **`email_activities`**, distinguished by `source`, `platform`, and `emailSequenceOrder`.

---

## 1. Scheduled sends

### Campaign `scheduled_for`

- **Where:** `campaigns.scheduled_for` (DB), `lib/services/campaignInference.js`, `app/api/campaigns/route.js`.
- **What it does:** Used only for **app-level** state:
  - `inferCampaignState()`: `hasScheduledTime`, `canSendNow` (false when `scheduled_for` is set).
  - `inferStatus()`: if `scheduled_for` is in the future → status `SCHEDULED`.
- **What it does *not* do:** Nothing in the codebase calls SendGrid with a **future send time**. There is no `send_at` / `sendAt` in the SendGrid payload.

So: “scheduled send” today means “we know when the campaign is *scheduled*”; the actual sending of campaign emails is not implemented via SendGrid scheduled send. To get real scheduled sends you’d need either:

- A job/cron that runs at `scheduled_for` and calls the existing send flow (e.g. outreach send) per contact, or  
- SendGrid’s [Single Send API](https://docs.sendgrid.com/api-reference/mail-send/send-email) with `send_at` (and then map those back to `email_activities` when they send).

---

## 2. Tracking responses with SendGrid

### Event webhook (what you have)

- **Endpoint:** `POST /api/webhooks/sendgrid`
- **Behavior:** For each event (processed, delivered, opened, clicked, bounce, dropped, etc.):
  - Finds or creates `email_activities` by `messageId` (from `sg_message_id`).
  - Updates that row’s `event` and `updatedAt`; uses `custom_arg_*` (e.g. `owner_id`, `contact_id`, `campaign_id`, `sequence_id`, `sequence_step_id`) when creating from webhook.
- **Limitation:** SendGrid does **not** send a “replied” event. So delivery/open/click are tracked; **reply** is not provided by this webhook.

### Inbound Parse (replies as new activity)

- **Endpoint:** `POST /api/inbound-email` (SendGrid Inbound Parse webhook).
- **Behavior:** Creates a **new** `email_activities` row with:
  - `event: 'inbound'`, `source: 'OFF_PLATFORM'`, `platform: 'sendgrid_inbound'`, `emailSequenceOrder: 'CONTACT_SEND'`.
  - Contact is resolved or created by sender email; `owner_id` from company/ENV.
- **Gap:** This row is **not** linked to the original outbound send. The inbound handler does **not**:
  - Read `In-Reply-To` / `References` headers,
  - Look up an existing `email_activities` by message-id,
  - Set `responseFromEmail` on the prior send or store a “reply-to” link on the new row.

So: **automatic** “they replied” tracking would require enhancing the inbound handler to resolve the thread (e.g. by In-Reply-To) and update the correct send row’s `responseFromEmail` (and optionally set a reply-to reference on the new CONTACT_SEND row).

---

## 3. “Responded and log it” (manual)

You **can** hit “responded and log it” on an email activity:

- **API:** `PUT /api/emails/[emailId]/response`
- **Body:** `contactResponse` (required), optional `respondedAt`, `responseSubject`, `responseDisposition`.
- **Behavior:**
  1. Creates a new `email_activities` row: `emailSequenceOrder: 'CONTACT_SEND'`, `body: contactResponse`, `event: 'sent'`, `messageId: null`, inherits `owner_id`, `contact_id`, `source`, `platform` from parent.
  2. Updates the parent row: `responseFromEmail = new row id`.
  3. Updates contact (e.g. `lastRespondedAt`, pipeline stage, cadence).

So for **any** email activity (platform or off-platform), the UX can offer “Add Response” and it will create the CONTACT_SEND row and link it via `responseFromEmail`. No SendGrid reply event is required.

- **Record off-platform:** `/outreach/record-off-platform` (and contact-scoped “Add Email Manually”) saves via `POST /api/contacts/[contactId]/off-platform-send` or `.../off-platform-conversation`. The success message already says: *“In Email History, use **Add Response** on that email to record their reply.”*

---

## 4. Outbound vs email_activity (single model)

There is **no** separate “outbound” table. Everything lives on **`email_activities`**:

| Source | How it’s created | Typical `source` | `emailSequenceOrder` |
|--------|-------------------|------------------|------------------------|
| SendGrid (compose/campaign) | `/api/outreach/send` → `sgMail.send(msg)` → create/update row | PLATFORM | OWNER_SEND |
| SendGrid events | `/api/webhooks/sendgrid` → find/update by `messageId` | (unchanged) | (unchanged) |
| Off-platform single | Record off-platform → `POST .../off-platform-send` | OFF_PLATFORM | OWNER_SEND |
| Off-platform thread | Record off-platform → `POST .../off-platform-conversation` | OFF_PLATFORM | OWNER_SEND / CONTACT_SEND + `responseFromEmail` chain |
| Inbound Parse | `POST /api/inbound-email` | OFF_PLATFORM | CONTACT_SEND |
| Manual “Add Response” | `PUT /api/emails/[emailId]/response` | (inherited) | CONTACT_SEND (new row); parent gets `responseFromEmail` |

So: **outbound** is just “our” side of the thread (`emailSequenceOrder = OWNER_SEND`); **inbound/response** is CONTACT_SEND. Same table, same thread model (`responseFromEmail` points to the next message in the thread).

---

## 5. Recommendations

1. **Scheduled sends:** Decide whether to (a) add a worker that sends at `scheduled_for` using the current send flow, or (b) use SendGrid `send_at` and align with a single `email_activities`-per-send model (including draft row → update on actual send).
2. **Auto “replied” from SendGrid:** Enhance `POST /api/inbound-email` to parse `In-Reply-To` (and optionally `References`), resolve the original `email_activities` by message-id (or similar), and set that row’s `responseFromEmail` to the new CONTACT_SEND row’s id.
3. **“Responded and log it”:** Already supported; ensure contact detail / email history UX exposes “Add Response” for every send (platform and off-platform) and calls `PUT /api/emails/[emailId]/response`.
