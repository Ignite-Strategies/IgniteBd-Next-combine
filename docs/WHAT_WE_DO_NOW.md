# What We Do Now

> Summary of outreach and contact tracking as of Feb 2026.  
> Details: [Outreach Message Architecture](./OUTREACH_MESSAGE_ARCHITECTURE.md), [Pipeline Deep Dive: Non-buyers](./PIPELINE_DEEP_DIVE_NON_BUYERS.md).

---

## In one sentence

We help you do **contact-first BD outreach**: build a message for this person, send (platform or off-platform), track when you contacted and when they responded, and move them by **pipeline** (deal stage) and **position** (intro within target vs decision maker) so warm intros stay findable without clogging the funnel.

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

## Position = where they sit in the path to a buyer

**Pipeline** = deal stage. **Position** = role at the target company (buyer vs warm intro).

We store **`Contact.introPositionInTarget`** (enum):

- **DECISION_MAKER** — They are the buyer.
- **INTRO_WITHIN_TARGET** — Warm intro at the company; can pass to the buyer (e.g. “I’ll check with internal counsel,” “I’ll forward to someone who may care”).
- **GATEKEEPER** — Controls access.
- **INFLUENCER** — Influences the decision.
- **OTHER**

So someone can be on the **connector** pipeline (forwarded / introduction-made) and **INTRO_WITHIN_TARGET** — “warm intro to a buyer.” You can filter by connector pipeline or by introPositionInTarget.

**Intro source (Contact → Contact):** When a contact was introduced by another contact (e.g. connector forwarded to the buyer), link them: set the **new** contact’s **`introSourceContactId`** to the connector’s id. Then:
- On the **buyer** contact you can show “Introduced by [connector name]” and link to the connector.
- On the **connector** contact you can show “Introduced: [list of contacts they introduced]” via the inverse relation `contactsIntroduced`.  
So connectors still matter and you follow up; the FK makes the “who introduced whom” graph explicit.

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
| **not_decision_maker** | Move to **connector** pipeline, stage **forwarded**. Set **introPositionInTarget = INTRO_WITHIN_TARGET**. Append note: “[Response] Not the decision maker.” |
| **forwarding** | Same; note: “[Response] Said they’ll forward to someone who may care.” When they make the intro, move stage to **introduction-made** or add the new buyer as a contact. |
| **not_interested** | Set **Contact.doNotContactAgain = true**. No pipeline change. |

So: **not the buyer / “I’ll forward”** → **connector / forwarded** + INTRO_WITHIN_TARGET + note. When they refer someone, add that person as a new contact (prospect), set the new contact’s **intro source** to the connector (Contact → Contact FK: `introSourceContactId`), note “Introduced by [Name],” and move the connector’s stage to **introduction-made**. Then you can show “Introduced by [Name]” on the buyer and “Introduced: [list]” on the connector.

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
| Intro source | Set `introSourceContactId` on the introduced contact (e.g. when adding the buyer); include `introSourceContact` / `contactsIntroduced` in contact GET when needed |

---

## Docs to open next

- **[OUTREACH_MESSAGE_ARCHITECTURE.md](./OUTREACH_MESSAGE_ARCHITECTURE.md)** — Message generation, saving drafts/templates, response handling, pipeline vs position.
- **[PIPELINE_DEEP_DIVE_NON_BUYERS.md](./PIPELINE_DEEP_DIVE_NON_BUYERS.md)** — Unassigned, notes, “forward to someone,” moving people.
- **[OUTREACH_TRACKER_AND_CONTACT_DETAIL_INTEGRATION.md](./OUTREACH_TRACKER_AND_CONTACT_DETAIL_INTEGRATION.md)** — Tracker and contact detail integration.
- **[EMAIL_SEND_TRACKING_AND_REMINDERS_DEEP_DIVE.md](./EMAIL_SEND_TRACKING_AND_REMINDERS_DEEP_DIVE.md)** — Where sends are tracked, follow-up calc, reminders.
