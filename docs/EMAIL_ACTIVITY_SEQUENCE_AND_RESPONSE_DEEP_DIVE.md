# Email activity sequence and response model — deep dive

## 1. What “response” means (no longer a string)

- **Before:** Response was a **string field** on the send row: `contactResponse`, `hasResponded`, `respondedAt`, `responseSubject`. One row = one send + optional response blob.
- **After:** Response is **not** a field. Response is **the unique id of another email_activity row**. That row is the response. It gets its own email_activity entry; the send row does not hold the response text. So:
  - **“The response”** = the **id** of the email_activity row that represents the contact’s (or our) reply.
  - That row’s `body`, `subject`, `createdAt`, etc. hold the content and metadata of the response.
  - The send row may still have legacy `contactResponse` (string) for backward compatibility; in the expanded model, you point to the response row by id (`inReplyToActivityId` from the response row to the send, or a dedicated “response activity id” on the send if we add it).

So: **response = email_activity uuid** (the id of the standalone email_activity that is the response). Not “that row’s body” — the response **is** that row; the row’s fields hold the content.

---

## 2. Step in thread: emailSequenceOrder

- **emailSequenceOrder** = step in the thread (replacing “email kind”):
  - **SENT** — we sent (initial or follow-up).
  - **CONTACT_RESPONDED** — contact replied; this row is their reply; `inReplyToActivityId` → the email_activity they’re replying to.
  - **OWNER_RESPONSE** — we replied back; this row is our reply; `inReplyToActivityId` → the email_activity we’re replying to.

We **dropped emailType** (FIRST_TIME / FOLLOWUP); first vs follow-up can stay computed in code (e.g. EmailTypeDeterminationService) for templates/UX and is not stored on the row.

---

## 3. Universal shape: one row fits both directions (sender / receiver)

**Question:** Is our email_activity shape universal enough so that the **same row shape** can represent both “we sent to contact” and “contact sent to us” (response as its own row)? E.g. can we treat contact as sender and owner as receiver for a CONTACT_RESPONDED row?

**Answer (convention, no column swap):**

- Every row has **owner_id** and **contact_id** (thread participants). We do **not** swap columns.
- **Sender / receiver** are determined by **emailSequenceOrder**:
  - **SENT** or **OWNER_RESPONSE** → sender = owner (our rep), receiver = contact.
  - **CONTACT_RESPONDED** → sender = contact, receiver = owner.

So one shape fits all: same two FKs on every row; who sent is implied by `emailSequenceOrder`. For a CONTACT_RESPONDED row we still set both `owner_id` (which rep’s thread) and `contact_id` (which contact); the convention “contact is sender, owner is receiver” is by step type, not by swapping columns.

---

## 4. HubSpot comparison (investigation)

- **From/To:** HubSpot uses explicit **from** and **to** (e.g. `hs_email_from_email`, `hs_email_to_email`), plus **direction** (e.g. EMAIL, INCOMING_EMAIL, FORWARDED_EMAIL).
- **Owner:** `hubspot_owner_id` = user who created/owns the email record.
- **Associations:** Emails are associated with contacts, companies, deals.

We use **owner_id + contact_id + emailSequenceOrder** instead of separate from/to columns: the same two IDs plus the step tell you who sent and who received. That keeps one universal row shape without adding separate sender/receiver columns.

---

## 5. Schema (email_activities) — summary

| Concept | Meaning |
|--------|--------|
| **Response** | The **id** of the email_activity row that is the response (standalone row). Content lives on that row. |
| **emailSequenceOrder** | SENT \| CONTACT_RESPONDED \| OWNER_RESPONSE — step in thread; implies sender (owner vs contact). |
| **inReplyToActivityId** | Id of the email_activity this row replies to (for CONTACT_RESPONDED / OWNER_RESPONSE). |
| **owner_id / contact_id** | Thread participants; sender/receiver by emailSequenceOrder (no swap). |
| Legacy | `contactResponse` (string), `hasResponded`, `respondedAt` on send row kept for backward compatibility. |

---

## 6. Migration / coexistence

- **Legacy:** Response can still be stored on the send row (contactResponse, hasResponded). No new row.
- **Expanded:** When recording a contact reply, create a **new** email_activity with emailSequenceOrder = CONTACT_RESPONDED, inReplyToActivityId = send.id, body = their text, owner_id + contact_id set. The **response** is that new row’s id. Same idea for OWNER_RESPONSE when we reply back.
