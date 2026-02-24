# Pipeline Deep Dive: Moving People When They’re Not Buyers

**Purpose:** How the pipeline works, how to move contacts between pipelines/stages, and how to handle people who are **not buyers** (e.g. warm contact, referral source) so they stay in the CRM but out of the sales path.

**Important:** It’s **deal pipeline or nothing** — there is no separate “outreach status” field. “Engaged / awaiting response” is a **stage** in the prospect deal pipeline so we know an action was taken.

---

## Deal Pipeline: Canonical Values

**Source of truth:** `lib/config/pipelineConfig.js`

**Pipelines:**

- `unassigned` — Not in a formal path; no stages.
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

**Unassigned:** No stages. Use this for “not in a buying path” (warm contact, referral source, etc.).

---

## How You Move People (Pipeline + Stage)

### In the UI

1. Open **Contact detail** (`/contacts/[contactId]`).
2. In the pipeline section, click **Edit** (pencil) on pipeline/stage.
3. Choose **Pipeline** (unassigned, prospect, client, collaborator, institution).
4. If not unassigned, choose **Stage** from that pipeline’s list.
5. **Save.**

Pipeline page (`/pipelines`) is **read-only** (view by pipeline/stage); actual moves happen on contact detail.

### Via API

- **Endpoint:** `PUT /api/contacts/[contactId]/pipeline`
- **Body:** `{ "pipeline": "unassigned" }` or `{ "pipeline": "prospect", "stage": "interest" }`
- **Validation:** `pipelineConfig` — stage must belong to the chosen pipeline; `unassigned` has no stage (send `stage: null` or omit).
- **Trigger:** If you set prospect → `contract-signed`, `PipelineTriggerService` converts the contact to client pipeline, stage `kickoff`.

So: **moving someone “out” of the buying path = set pipeline to `unassigned`** (and optionally use notes/relationship/persona to say why).

---

## When They’re Not Buyers: Two Patterns

You want to:

- Keep them in the CRM (job, company, notes).
- **Not** treat them as prospects (no follow-up cadence, no “next stage” pressure).
- Still be able to find them (e.g. “warm contacts”, “said they’d forward”).

Recommended: **move to `unassigned`** and use **notes**, **prior_relationship**, and optionally **outreach persona** to capture the reason.

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

**Goal:** They’re not the buyer; they’re a **referral source**. You want to remember that and maybe follow up on the referral.

**What to do:**

1. **Pipeline:** Set to **`unassigned`**.
2. **Notes:** e.g. *“Not a buyer. Said: ‘I’ll forward this to someone who may care.’ Follow up on referral when they share contact.”*
3. **Optional:** When they introduce someone, add that new person as a **new contact** (prospect) and in notes you can say “Introduced by [Name].”

**Result:** They’re out of the buying path; the system doesn’t treat them as a prospect. Notes give you the context for follow-up. (If you later add tags or a “Referral source” pipeline, you could use that instead of or in addition to notes.)

---

## Fields That Help for “Not a Buyer”

| Field | Use for non-buyers |
|-------|---------------------|
| **Pipeline = unassigned** | Removes them from prospect/client/collaborator/institution views and stages. |
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

So: **any time you set pipeline to `unassigned` (and optionally clear stage), that contact is “moved out” of the buying path.** No extra “non-buyer” pipeline exists today; unassigned + notes/relationship/persona is the intended pattern.

---

## Gaps / Possible Extensions

- **No “Warm contact only” or “Referral source” pipeline:** Today we use **unassigned + notes + prior_relationship**. If you want a dedicated list or report (e.g. “All warm-only contacts”), you can filter contacts where `pipeline = unassigned` and `prior_relationship = WARM` (and/or search notes for “referral”).
- **Tags/labels:** There’s no `tags` or “referral source” flag on Contact. Notes (and optionally outreach persona) cover the use case; adding tags could make filtering and reporting easier later.
- **Bulk move:** Pipeline page doesn’t support “move selected to unassigned” from the table; you do it one-by-one on contact detail (or via API in bulk if you build it).

---

## Summary

- **Moving people:** Contact detail → Edit pipeline/stage → Save. API: `PUT /api/contacts/[contactId]/pipeline` with `pipeline` (and `stage` if not unassigned).
- **Not buyers:** Set **pipeline = unassigned**. Use **notes** and **prior_relationship** (and **title**, **outreach persona**) to capture “warm contact only” or “I’ll forward to someone.”
- **Friend/former colleague:** Unassigned + title kept + WARM + notes “keep warm, not pushing.”
- **“I’ll forward to someone”:** Unassigned + notes “will forward to someone who may care”; add new contact when they refer.

This keeps non-buyers in the CRM, out of the sales pipeline, and still findable and actionable via notes and relationship.
