# What We Do Now

> Summary of outreach and contact tracking as of Feb 2026.  
> Details: [Outreach Message Architecture](./OUTREACH_MESSAGE_ARCHITECTURE.md), [Pipeline Deep Dive: Non-buyers](./PIPELINE_DEEP_DIVE_NON_BUYERS.md).

---

## In one sentence

We help you do **contact-first BD outreach**: build a message for this person, send (platform or off-platform), track when you contacted and when they responded, and move them by **pipeline** (deal stage) and **position** (intro within target vs decision maker) so warm intros stay findable without clogging the funnel. Optional **introducedByContactId** (string) on a contact links to who introduced them; look up by that id when you need to show “Introduced by [Name].”

---

## Contact-first outreach

- **Start from the contact.** Open Contact detail → “Build Email” → outreach-message page. We pull relationship context, persona, and notes from the DB and generate a message for *this* person (AI + content snippets). No generic template slot.
- **Send** via platform (SendGrid/sequence) or **record an off-platform send** (e.g. you emailed from your own client). Both create an **email_activities** row and snap **Contact.lastContactedAt**.
- **One email model.** All sends (platform + off-platform, drafts + sent) live in **email_activities**. Contact has a single email history; tracker and follow-up logic use that.

---

## Tracking: who we contacted, when they’re due, when they responded

- **Last contacted:** `Contact.lastContactedAt` — snapped when we send (any source). Used for “when did we last reach out” and cadence.
- **Last responded:** `Contact.lastRespondedAt` — snapped when we record a response. So we know “they replied” without joining to activities.
- **Next contact:** `Contact.nextContactedAt` (+ optional `nextContactNote`, `doNotContactAgain`). Computed from cadence or set manually (e.g. “follow next quarter”). Tracker and “who’s due” use this.
- **Outreach tracker** (`/outreach/tracker`): list contacts with sends, filter by date range / response status, show last send, next follow-up, status (Responded / Overdue / Due today / Due in X days).

---

## Pipeline = where they are in the deal

Every contact has one **pipeline** row: `pipeline` + `stage`.

- **unassigned** — Literally unassigned. No stage. Use only when they’re not in any path yet.
- **connector** — Warm intro to a buyer: they said they’d forward, or the intro has been made. Stages: **forwarded** (said they’d forward / pass along), **introduction-made** (intro to the buyer done). **They still matter** — you follow up (“Who did you forward it to?”, “Did you get a chance to pass it along?”) until you have the intro or the new contact.
- **prospect** — Sales path. Stages: need-to-engage → engaged-awaiting-response → interest → meeting → proposal → contract → contract-signed (then auto-move to **client**).
- **client** — After contract-signed (kickoff → … → terminated-contract).
- **collaborator** / **institution** — Other paths with their own stages.

**Auto-moves:**

- When you **send** (platform or off-platform) and they’re **prospect** + **need-to-engage** → stage becomes **engaged-awaiting-response**.
- When you **record a response** and they’re **prospect** + **engaged-awaiting-response** → stage becomes **interest** (default “positive” behavior).
- When you record **not_decision_maker** or **forwarding** → we put them on the **connector** pipeline, stage **forwarded**. When they make the intro, move stage to **introduction-made** (or add the new buyer as a contact).

---

## Introduced by (optional link to connector)

**Pipeline** = deal stage. To record “who introduced this contact,” we store **`Contact.introducedByContactId`** — a simple string: the **contact id** of the person who introduced them (e.g. the connector). No FK/relation in the schema; look up that contact when you need to show “Introduced by [Name]” or link to their record.

- On the **contact detail** page: **Introduced By** section — enter the introducer’s email, **Look up**, then **Set** to save. The API looks up contact by email (scoped by `crmId`) and sets `introducedByContactId`.
- **GET** `/api/contacts/[id]` returns `introducedByContact` (id, displayName, email) when set, so the UI can show the link without an extra request.

---

## How “upload email” and “Add Response” connect

**Upload/record email** and **Add Response** are two separate steps; Add Response does **not** appear on the upload success screen.

1. **Where you record the email**
   - From the **contact page**: Email History → **Add Email Manually** → goes to **Record Off-Platform** (with that contact pre-selected).
   - You paste or enter the email you sent → **Save Email Record** (or **Save email + response** if you pasted a full conversation).
2. **What happens on success**
   - If you came from a contact, you’re redirected back to **that contact page** after a short delay.
3. **Where you add their reply**
   - **On the contact page**, in **Email History**, each sent email (that doesn’t already have a response) has an **Add Response** button.
   - So: you upload the email → you land back on the contact → the new email appears in the list with **Add Response** → you click it to record that they replied (and optionally set disposition: positive, not decision maker, forwarding, not interested).

**Summary:** Upload creates the email row. Add Response is done **on the contact**, on that email’s row in Email History — not on the Record Off-Platform page.

---

## Recording a response: what we do

**API:** `PUT /api/emails/[emailId]/response`  
Body: `{ contactResponse, respondedAt?, responseSubject?, responseDisposition? }`.

We always:

- Update the **email_activities** row (contactResponse, respondedAt, hasResponded).
- Snap **Contact.lastRespondedAt** to the response date.

Then we branch on **responseDisposition**:

| Disposition | What we do |
|-------------|------------|
| **positive** (default) | If prospect + engaged-awaiting-response → move stage to **interest**. |
| **not_decision_maker** | Move to **connector** pipeline, stage **forwarded**. Append note: “[Response] Not the decision maker.” |
| **forwarding** | Same; note: “[Response] Said they’ll forward to someone who may care.” When they make the intro, move stage to **introduction-made** or add the new buyer as a contact. |
| **not_interested** | Set **Contact.doNotContactAgain = true**. No pipeline change. |

So: **not the buyer / “I’ll forward”** → **connector / forwarded** + note. When they refer someone, add that person as a new contact (prospect), set the new contact’s **introducedByContactId** to the connector’s id (e.g. via contact detail “Introduced By” → look up by email → Set), note “Introduced by [Name],” and move the connector’s stage to **introduction-made**.

---

## Key APIs and surfaces

| What | Where |
|------|--------|
| Build email for contact | Contact detail → Build Email → `/contacts/[id]/outreach-message` → `POST /api/template/generate-with-snippets` |
| Send (platform) | `POST /api/outreach/send` — creates email_activities, snaps lastContactedAt, prospect need-to-engage → engaged-awaiting-response |
| Record off-platform send | `POST /api/contacts/[id]/off-platform-send` — same snap + pipeline move |
| Record response | `PUT /api/emails/[emailId]/response` — body includes **responseDisposition** |
| Next contact (manual) | `PUT/GET /api/contacts/[id]/next-contact` — nextContactedAt, doNotContactAgain, nextContactNote |
| Email history | `GET /api/contacts/[id]/email-history` — from email_activities |
| Outreach tracker | `GET /api/outreach/tracker` — contacts with sends, filters, last/next dates, hasResponded |
| Pipeline/stage | Contact detail edit, or `PUT /api/contacts/[id]` / pipeline API |
| Intro source | Set `introducedByContactId` on the introduced contact (contact detail → Introduced By → look up by email → Set). Contact GET returns `introducedByContact` when set. Lookup: `GET /api/contacts/lookup-by-email?email=...&crmId=...` |

---

## Docs to open next

- **[OUTREACH_MESSAGE_ARCHITECTURE.md](./OUTREACH_MESSAGE_ARCHITECTURE.md)** — Message generation, saving drafts/templates, response handling, pipeline vs position.
- **[PIPELINE_DEEP_DIVE_NON_BUYERS.md](./PIPELINE_DEEP_DIVE_NON_BUYERS.md)** — Unassigned, notes, “forward to someone,” moving people.
- **[OUTREACH_TRACKER_AND_CONTACT_DETAIL_INTEGRATION.md](./OUTREACH_TRACKER_AND_CONTACT_DETAIL_INTEGRATION.md)** — Tracker and contact detail integration.
- **[EMAIL_SEND_TRACKING_AND_REMINDERS_DEEP_DIVE.md](./EMAIL_SEND_TRACKING_AND_REMINDERS_DEEP_DIVE.md)** — Where sends are tracked, follow-up calc, reminders.
