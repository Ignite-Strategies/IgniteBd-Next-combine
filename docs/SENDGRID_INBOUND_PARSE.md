# SendGrid Inbound Parse → CRM

## Overview

When an email is forwarded to your intake address (e.g. `intake@crm.yourdomain.com`), SendGrid Inbound Parse POSTs the parsed payload to our API. The route creates or finds a Contact, records the email as an Activity, and sets a +7 day follow-up on the contact.

**Endpoint:** `POST /api/inbound-email`  
**Implementation:** `app/api/inbound-email/route.ts`

---

## SendGrid setup

1. **Inbound Parse** (SendGrid: Settings → Inbound Parse): add your receiving host (e.g. `crm.yourdomain.com`) and set the **Destination URL** to:
   ```text
   https://<your-app-domain>/api/inbound-email
   ```
2. Configure MX for that host to point to `mx.sendgrid.net` (priority 10) so SendGrid receives the mail.

SendGrid sends **multipart/form-data** with fields: `from`, `to`, `subject`, `text`, `html`, `attachments` (count), etc. We use `from`, `subject`, `text`, `html`; attachments are not stored.

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `INBOUND_EMAIL_CRM_ID` | Yes | `company_hqs.id` to attach new/found contacts and the activity row. If unset, the API returns 503. |
| `INBOUND_EMAIL_OWNER_ID` | No | `owners.id` used as `owner_id` for the activity (and for new contacts) when the company has no `ownerId`. If both company `ownerId` and this are missing, the API returns 503. |

---

## Request / response

- **Method:** POST only.
- **Content-Type:** `multipart/form-data` (SendGrid default).
- **Success:** `200` → `{ "success": true }`.
- **Validation:** Missing or invalid `from` → `400` with `{ "success": false, "error": "..." }`.
- **Config / server:** Misconfiguration or internal error → `503` or `500` with JSON error body.

SendGrid expects a **2xx** response so they stop retrying; we return 2xx only for 200. For invalid payload we return 400 (SendGrid may retry; consider whether to return 200 and log instead if you want to avoid retries).

---

## Behavior (per request)

1. **Parse** `from`, `subject`, `text`, `html` from the form body. Attachments count is read but not stored.
2. **Validate** `from`: required; must parse to a valid email (supports `"Name <email@domain.com>"` or plain `email@domain.com`). Return 400 if missing or invalid.
3. **Resolve owner:** Use `INBOUND_EMAIL_CRM_ID` to load the company; `owner_id` = company `ownerId` or `INBOUND_EMAIL_OWNER_ID`. Return 503 if CRM or owner cannot be determined.
4. **Contact:** Look up by normalized email + `crmId`. If none, create a Contact with `crmId`, `email`, `fullName` (parsed from From header), `ownerId`.
5. **Activity:** Insert one `email_activities` row:
   - `event`: `'inbound'`
   - `source`: `OFF_PLATFORM`
   - `platform`: `'sendgrid_inbound'`
   - `emailSequenceOrder`: `CONTACT_SEND`
   - `owner_id`, `contact_id`, `email`, `subject`, `body` (text or html), `sentAt`.
6. **Follow-up:** Update the contact: `nextEngagementDate` = today + 7 days (ISO date), `nextEngagementPurpose`: `PERIODIC_CHECK_IN`. (There is no separate Task model; follow-up is represented on the contact.)
7. **Log:** A single log line with `[inbound-email]`, subject prefix, and flags for text/html/attachments (no full bodies).

---

## Out of scope (current implementation)

- AI parsing, threading, contact enrichment, complex date extraction.
- Storing or processing attachments.
- Linking this inbound message to a prior outbound send (no `responseFromEmail` / thread logic).

---

## Related

- **Email activity model:** `email_activities` — see `docs/EMAIL_ACTIVITY_THREAD_FIELDS.md`.
- **SendGrid events and tracking:** `docs/SENDGRID_SCHEDULED_SENDS_AND_RESPONSE_TRACKING.md`.
