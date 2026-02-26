# Email Activity: tenant_id Investigation

## What is `tenant_id`?

On `email_activities`, **`tenant_id` is company context** — the ID of the Company HQ (organization) the send is attributed to. In the rest of the app it’s the same concept as `companyHQId`.

- **Schema:** `email_activities.tenant_id` is `String?` (optional).
- **When it’s set:**
  - **Platform sends (SendGrid):** The compose flow sends `tenantId` in the request body to `/api/outreach/build-payload`, which puts it in SendGrid custom args as `custom_arg_tenant_id`. When the send is logged (in `/api/outreach/send`) or when a SendGrid webhook creates/updates an activity, that value is stored as `tenant_id`.
  - **Off-platform sends:** Not set (see below).

So: **tenant_id = which company (Company HQ) the email is considered “for”** — used for attribution and for things like template hydration (`companyHQId: tenantId` in build-payload).

---

## Why is `tenant_id` null on your record?

Your record has:

- `source: "OFF_PLATFORM"`
- `platform: "manual"`
- `messageId: null`
- `tenant_id: null`

So this row is a **manually recorded off-platform send** (e.g. from “Record email” / “Add Email Manually”), not a send through the platform (SendGrid).

**Where it’s created:** `POST /api/contacts/[contactId]/off-platform-send` (see `app/api/contacts/[contactId]/off-platform-send/route.js`). That handler creates the activity with:

- `owner_id`, `contact_id`, `email`, `subject`, `body`, `event`, `messageId`, `source`, `platform`, `sentAt`

It **never sets `tenant_id`**. So **null is expected for all off-platform/manual email activities**.

---

## Is null a problem?

- **Schema:** Optional; null is valid.
- **Current usage:** Nothing in the codebase filters or segments email activities by `tenant_id`; the recent/reporting code only includes it in selects. So behavior is unchanged.
- **If you want it set:** You could derive it when recording off-platform (e.g. from the contact’s company or the owner’s default company) and pass it into the create payload. That would be a small change in the off-platform-send route and (if you have one) the record-off-platform UI.

---

## Summary

| Question | Answer |
|----------|--------|
| What is `tenant_id`? | Company HQ id (`companyHQId`) the send is attributed to. |
| Why null here? | Record is off-platform/manual; the off-platform-send API does not set `tenant_id`. |
| Required? | No; column is optional and not used for filtering today. |
