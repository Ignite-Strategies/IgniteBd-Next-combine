# Pipeline Deep Dive: Moving People When They’re Not Buyers

**Purpose:** How the pipeline works, how to move contacts between pipelines/stages, and how to handle people who are **not buyers** (e.g. warm contact, referral source) so they stay in the CRM but out of the sales path.

**Important:** It’s **deal pipeline or nothing** — there is no separate “outreach status” field. “Engaged / awaiting response” is a **stage** in the prospect deal pipeline so we know an action was taken.

---

## Deal Pipeline: Canonical Values

**Source of truth:** `lib/config/pipelineConfig.js`

**Pipelines:**

- `unassigned` — Literally unassigned; not in any path. No stages.
- `connector` — Warm intro to a buyer (said they’d forward, or intro made). Stages: **forwarded**, **introduction-made**.
- `prospect` — Sales path (need-to-engage → … → contract-signed).
- `client` — After contract-signed (kickoff → … → terminated-contract).
- `collaborator` — Partnership path (interest → meeting → moa → agreement).
- `institution` — Institution path (same stages as collaborator).

**Prospect stages (in order):**

1. `need-to-engage` — In CRM, not emailed yet (default for new CSV uploads).
2. `engaged-awaiting-response` — Outreach sent, waiting for response. **Auto-set** when you send (platform or off-platform) so we know an action was taken; aligns with normal flow before “interest”.
3. `interest` — **Auto-set** when you mark a contact as “responded” and they were in `engaged-awaiting-response`.
4. `meeting`
5. `proposal`
6. `contract`
7. `contract-signed` — **Conversion:** system moves contact to **client** pipeline, stage **kickoff**.

**Unassigned:** No stages. Use only for contacts who are literally not assigned to any path yet.

**Connector:** Stages **forwarded** (said they’d forward / pass along), **introduction-made** (intro to the buyer has been made). Use for warm intros — “I’ll check with internal counsel,” “I’ll forward to someone who may care.” **They still matter:** you have to follow up — e.g. “Who did you forward it to?”, “Did you get a chance to pass it along?” — until you get the intro or the new contact. When they refer, add the new person as a contact and move this contact’s stage to introduction-made.

---

## How You Move People (Pipeline + Stage)

### In the UI

1. Open **Contact detail** (`/contacts/[contactId]`).
2. In the pipeline section, click **Edit** (pencil) on pipeline/stage.
3. Choose **Pipeline** (unassigned, connector, prospect, client, collaborator, institution).
4. If not unassigned, choose **Stage** from that pipeline’s list.
5. **Save.**

Pipeline page (`/pipelines`) is **read-only** (view by pipeline/stage); actual moves happen on contact detail.

### Via API

- **Endpoint:** `PUT /api/contacts/[contactId]/pipeline`
- **Body:** `{ "pipeline": "unassigned" }` or `{ "pipeline": "prospect", "stage": "interest" }`
- **Validation:** `pipelineConfig` — stage must belong to the chosen pipeline; `unassigned` has no stage (send `stage: null` or omit).
- **Trigger:** If you set prospect → `contract-signed`, `PipelineTriggerService` converts the contact to client pipeline, stage `kickoff`.

So: **warm intro / “I’ll forward” = set pipeline to `connector`**, stage **forwarded** (or **introduction-made** once the intro is done). **Literally unassigned** = set pipeline to `unassigned` (no stage).

---

## When They’re Not Buyers: Two Patterns

You want to:

- Keep them in the CRM (job, company, notes).
- **Not** treat them as prospects (no follow-up cadence, no “next stage” pressure).
- Still be able to find them (e.g. “warm contacts”, “said they’d forward”).

- **“I’ll forward” / referral source:** Use the **connector** pipeline, stage **forwarded** (or **introduction-made** once they’ve made the intro). Auto-set when you record a response with disposition `forwarding` or `not_decision_maker`.
- **Friend / warm contact only (not a referral path):** Use **unassigned** + **notes**, **prior_relationship**, and optionally **outreach persona**.

---

### Scenario A: Friend / Former Colleague — “List their job, keep warm contact”

**Goal:** Keep their info (especially job/title), stay in touch occasionally, don’t push for sale.

**What to do:**

1. **Pipeline:** Set to **`unassigned`** (no stage).
2. **Job/title:** Keep **`title`** (and company) on the contact — already on the Contact model; no extra list needed.
3. **Relationship:** Set **`prior_relationship`** = **WARM** (or ESTABLISHED if that fits better).
4. **Notes:** e.g. *“Friend / former colleague. Keep warm contact only; not pushing for sale.”*
5. **Optional:** Set **`outreachPersonaSlug`** to something like **`FormerColleagueNowReachingoutAgainAfterLongTime`** if you use outreach personas for template/snippet matching later.

**Result:** They disappear from prospect/client/collaborator/institution pipelines. You can still find them by relationship (WARM), notes, or persona. Title/job stays on the contact card.

---

### Scenario B: “Great to be in touch — I’ll forward to someone who may care”

**Goal:** They’re not the buyer; they’re a **connector** — warm intro to a buyer. You want to track “forwarded” vs “introduction made.”

**What to do:**

1. **Pipeline:** Set to **`connector`**, stage **forwarded** (or use **Record response** with disposition `forwarding` / `not_decision_maker` — we set this automatically).
2. **Notes:** We append e.g. *[Response] Said they’ll forward to someone who may care.* You can add more context.
3. When they introduce someone, add that person as a **new contact** (prospect). Set the new contact’s **introducedByContactId** to this connector’s id (on contact detail → Introduced By → look up connector by email → Set). Note “Introduced by [Name]” in notes, and move this connector’s stage to **introduction-made**.

**Result:** They live on the **connector** pipeline (forwarded → introduction-made). The new buyer contact has **introducedByContactId** set to the connector’s id, so you can show “Introduced by [Name]” on the buyer and link to the connector.

---

## Fields That Help for “Not a Buyer”

| Field | Use for non-buyers |
|-------|---------------------|
| **Pipeline = connector** (stages: forwarded, introduction-made) | Warm intro to a buyer; “I’ll forward,” referral source. |
| **Pipeline = unassigned** | Literally unassigned — not in any path yet (e.g. friend/warm contact only). |
| **introducedByContactId** | On the **introduced** contact (the buyer): string = connector’s contact id. Set via contact detail “Introduced By” (look up by email). Contact GET returns `introducedByContact` so you can show “Introduced by [Name].” |
| **notes** | “Warm contact only,” “Will forward to someone,” “Referral source,” etc. |
| **prior_relationship** | WARM / ESTABLISHED / DORMANT — good for filtering “warm but not pushing.” |
| **title** | Keep job/role on the contact (no separate “list” needed). |
| **outreachPersonaSlug** | Optional: e.g. former colleague persona for future outreach tone. |

---

## How Movement Works Under the Hood

1. **Config:** `pipelineConfig.js` defines valid pipelines and stages per pipeline.
2. **Validation:** `lib/services/pipelineService.ts` — `validatePipeline(pipeline, stage)` and `ensureContactPipeline(contactId, { pipeline, stage })`.
3. **API:** `PUT /api/contacts/[contactId]/pipeline` — validates, then runs **PipelineTriggerService**: if new state is prospect + contract-signed, it converts to client/kickoff; otherwise it upserts the `pipelines` row for that contact.
4. **DB:** One row per contact in `pipelines` (contactId, pipeline, stage). No separate outreach-status field — “engaged / awaiting response” is a deal pipeline stage.

**Auto-movement (deal pipeline only):**

- When you **send** an email (platform or off-platform) and the contact is **prospect** + **need-to-engage**, their stage is set to **engaged-awaiting-response**.
- When you **mark a response** and the contact is **prospect** + **engaged-awaiting-response**, their stage is set to **interest**.

So: **connector** = warm intro path (forwarded / introduction-made). **Unassigned** = literally not in any path. Use connector for “I’ll forward” / referral; unassigned for friend/warm-contact-only.

---

## Gaps / Possible Extensions

- **Connector pipeline** = referral / “I’ll forward” path (stages: forwarded, introduction-made). **Unassigned** = literally unassigned; for “warm contact only” filter `pipeline = unassigned` and `prior_relationship = WARM` (and/or notes).
- **Tags/labels:** There’s no `tags` or “referral source” flag on Contact. Notes (and optionally outreach persona) cover the use case; adding tags could make filtering and reporting easier later.
- **Bulk move:** Pipeline page doesn’t support “move selected to unassigned” from the table; you do it one-by-one on contact detail (or via API in bulk if you build it).

---

## Summary

- **Moving people:** Contact detail → Edit pipeline/stage → Save. API: `PUT /api/contacts/[contactId]/pipeline` with `pipeline` (and `stage` if not unassigned).
- **Connector (warm intro / “I’ll forward”):** Set **pipeline = connector**, stage **forwarded** (or **introduction-made** when intro is done). Recording a response with disposition `forwarding` / `not_decision_maker` does this automatically. Add new contact when they refer; move stage to introduction-made.
- **Friend/former colleague (warm contact only):** Unassigned + title kept + WARM + notes “keep warm, not pushing.”
- **Unassigned:** Use only for contacts literally not in any path yet.

This keeps non-buyers in the CRM, out of the sales pipeline, and still findable and actionable via notes and relationship.
