# Beta Outreach Flow: Hand-Fed User → Full Pipeline

**Purpose:** One doc that ingests the end-to-end flow for a beta user who doesn’t use the platform—you ingest their list, run sends, match templates to personas, track sends/responses, and remind. Maps each step to what exists vs what’s missing.

---

## The 8-step flow (as specified)

1. **Ingest contacts with emails as CSV** – LinkedIn export, highlighted, with notes.
2. **Bulk Apollo send** – Same CSV-type stem; post-ingest bulk send (not just Apollo enrich).
3. **Template generation** – Modular “template snippets” (GoFast-style), e.g. mypitch, so we compose from snippets instead of full 3-paragraph templates per persona.
4. **Persona types** – e.g. “warm but using competitor.”
5. **Matching templates → persona → contacts** – Which template (or snippet combo) goes to which contact.
6. **Dates of email send** – When each contact was emailed.
7. **Response from contact** – Track replies.
8. **Service to remind** – (Optional) agent or automation to nudge follow-up.

---

## 1. Ingest contacts (CSV with emails + notes)

**What exists**

- **Upload:** `app/(authenticated)/contacts/upload/page.jsx` → `POST /api/contacts/batch` with FormData (`file`, `companyHQId`).
- **Batch API:** `app/api/contacts/batch/route.js` – parses CSV via `parseCSV`, normalizes headers.
- **Mapped columns today:** `firstName`, `lastName`, `email`, `companyName`, `pipeline`, `stage` (case-insensitive variants).
- **Contact model:** has `notes` (String?), `lastContact`, `persona_type`, `prior_relationship` (schema + CONTACT_MANUAL_TRACKING).

**Gaps**

- **Notes from CSV:** Batch route does **not** map a `notes` (or “Notes”) column. Comment says “notes … should be added on the contact detail page, not via CSV.” For LinkedIn export + notes you need to add `notes` (and optionally `title`) to the batch CSV mapping so his notes come in on ingest.
- **LinkedIn CSV shape:** If his export uses different column names (e.g. “First Name”, “Email Address”, “Note”), add those to the `normalizeHeader` mappings and to the contact payload (e.g. `notes`, `title`).

**Recommendation**

- Extend `app/api/contacts/batch/route.js`: in `normalizeHeader` add `notes` / `note`, and optionally `title` / `job title`; when building `contactData` (and create/update), set `notes: normalizedRow.notes || null`, `title: normalizedRow.title || null` so ingest is “CSV with emails + notes” ready.

---

## 2. Bulk Apollo send (post-ingest)

**What exists**

- **Apollo today:** Used for **enrichment** (LinkedIn URL → email, title, company), not for sending:
  - `lib/apollo.ts` – `enrichPerson` (e.g. by LinkedIn URL).
  - `app/api/contacts/[contactId]/enrich-career/route.ts`, LinkedIn save/enrich flows.
- **Sending:** `POST /api/outreach/send` – single email from Redis payload; `email_activities` record created. No bulk send from a list.

**Gaps**

- **Bulk send:** No “select N contacts (e.g. from same import/campaign) and send” flow. Either:
  - **A)** Build bulk send in Ignite: pick a list/filter (e.g. contacts from same CSV/campaign), pick template (or snippet-composed), schedule or send in batch via existing `outreach/send` + `email_activities`.  
  - **B)** Integrate Apollo’s **sending** product (if you use it) and sync “sent” back into Ignite (e.g. webhook or manual date/response).
- **Same CSV stem:** If “same CSV type stem” means “same upload batch,” you need a way to tag contacts with a **source batch** or **campaign/list** at ingest so “bulk Apollo send” = “send to everyone in this batch” (see also campaigns below).

**Recommendation**

- Implement **bulk send in-app**: “Bulk send” = loop over selected contact IDs (or a list id), for each: build payload (template + contact), call same `outreach/send` (or a batch variant), respect rate limits and store send date (see step 6). Optionally add `contact_list_id` or `import_batch_id` on Contact or a join table so “post ingest” = “contacts from this import.”

---

## 3. Template generation – modular snippets (GoFast-style)

**What exists**

- **GoFast “content snippets”:** Reusable blocks keyed by `variableName` (e.g. mypitch), company-scoped.
  - `content_snippets` table: `companyId`, `variableName`, `name`, `words`, `slug`.
  - `lib/content-snippets.ts`: `loadCompanySnippets`, `getContentSnippet`, `upsertContentSnippet`, etc.
  - API: `GET/POST/PUT /api/content-snippets`, generate endpoint.
- **Ignite templates:** Full templates (subject + body) with variables; `variableMapperService` hydrates `{{firstName}}`, etc. No **snippet** entity in Ignite yet—templates are monolithic.

**Gaps**

- **Template snippets in Ignite:** No equivalent of GoFast’s `content_snippets` in Ignite. So “mypitch” and other modular blocks don’t exist as first-class snippet entities; you’d be composing “full 3 paragraphs per persona” instead of “snippet A + snippet B by persona.”
- **Composition:** Need a way to define a **template** as “composed from snippet IDs/variable names” (e.g. greeting + mypitch + CTA) and hydrate snippet content + contact variables together.

**Recommendation**

- **Option A – Port snippet concept into Ignite:** Add `template_snippets` (or reuse name `content_snippets`) in Ignite: `companyHQId`, `variableName`, `name`, `body`, so the beta user can maintain “mypitch”, “warm_intro”, “competitor_angle”, etc. Then templates reference snippets (e.g. `{{snippet:mypitch}}`) and the variable mapper resolves snippet body then hydrates contact variables inside it.
- **Option B – Lightweight:** Keep full templates but allow “snippet” fields in the template body that pull from a small key-value store (e.g. company-level key-value or a minimal snippet table). Variable mapper would resolve `{{snippet:mypitch}}` from that store.

Either way, “template snippets” = modular pieces that can be mixed by persona (next step).

---

## 4. Persona types (e.g. “warm but using competitor”)

**What exists**

- **Schema:** `Contact.persona_type` (PersonaType), `Contact.prior_relationship` (RelationshipEnum).
- **PersonaType:** DECISION_MAKER, INFLUENCER, END_USER, GATEKEEPER, CHAMPION, OTHER.
- **RelationshipEnum:** COLD, WARM, ESTABLISHED, DORMANT.
- **Docs:** CONTACT_MANUAL_TRACKING.md – template selection by `prior_relationship` + pipeline/stage; CONTACT_MODEL_AUDIT.md.

**Gaps**

- **“Warm but using competitor”** is a **combo**: relationship = WARM + a “using competitor” flag or tag. Schema doesn’t have “using_competitor” or a generic tag list. You can:
  - Use **notes** for now (“warm, using Competitor X”), or
  - Add a **tag** / **label** (e.g. `tags: String[]` or a `contact_tags` table) with values like `using_competitor`, or
  - Add an enum or boolean like `competitive_situation` (e.g. USING_COMPETITOR, OPEN, UNKNOWN) and combine with `prior_relationship` in template selection.

**Recommendation**

- Short term: use `prior_relationship` = WARM and put “using competitor” in notes or a single tag field.
- Medium term: add a small set of **tags** or one **competitive_situation**-style field so “warm + using competitor” is a first-class persona flavor for template matching (step 5).

---

## 5. Matching template (or snippet combo) to persona → then to contacts

**What exists**

- **Template selection logic (doc’d):** CONTACT_MANUAL_TRACKING.md describes rule-based selection: `prior_relationship`, `persona_type`, pipeline/stage, `lastContact`.
- **Hydration:** `POST /api/template/hydrate-with-contact` + `variableMapperService` – given templateId + contactId (or `to`), returns hydrated subject/body. No automatic “pick template by persona” in API yet.
- **Personas (ICP):** Personas app (e.g. `/personas`, builder, from-contact) and APIs – those are “ideal customer” personas, not the same as “contact persona type” (DECISION_MAKER, WARM, etc.). Template-to-contact matching is about contact fields, not the Persona entity.

**Gaps**

- **Explicit “template ↔ persona type” mapping:** No table or config like “when prior_relationship=WARM and using_competitor → template_id X” or “when persona_type=DECISION_MAKER and stage=interest → snippet set Y.” That’s either hardcoded in a service or stored in DB (e.g. campaign or “template rules”).
- **Snippet combo by persona:** If templates are built from snippets (step 3), you need rules like “persona warm_competitor = snippet mypitch + snippet competitor_angle + snippet CTA.”

**Recommendation**

- Add a **template selection service** (or extend variable mapper): input = contact (with persona_type, prior_relationship, tags); output = templateId (or list of snippet variableNames). Rules can live in config (e.g. JSON) or in DB (e.g. `template_rules`: persona_type, prior_relationship, tag → template_id or snippet_ids). Use that in bulk send and compose so “matching templates to persona to contacts” is deterministic and editable.

---

## 6. Dates of email send

**What exists**

- **email_activities:** Each send creates a row with `contact_id`, `createdAt`, `event: 'sent'`, etc. So “date of send” = `email_activities.createdAt` for that contact + message.
- **Contact:** `lastContact` (String?) for manual “last contacted” note; no automatic “last send date” field on Contact.

**Gaps**

- **Convenience on Contact:** No denormalized `last_send_at` (DateTime) on Contact. You can derive it from `email_activities` (max createdAt where contact_id = X). If you want “show last send date on contact card” without joining, add `last_send_at` and update it when sending (or via a small job that syncs from email_activities).

**Recommendation**

- For “dates of email send”: **query `email_activities`** by contact (and optionally campaign_id when you add it). Optionally add `Contact.last_send_at` and keep it in sync on send for fast listing/filtering.

---

## 7. Response from contact

**What exists**

- **SendGrid webhooks:** `email_activities` has `event` (sent, delivered, opened, clicked, etc.). EMAIL_CAMPAIGN_AUDIT.md notes reply tracking is missing (needs parsing/inbound).
- **No inbound reply handling:** No webhook or pipeline that receives “reply to this message” and attaches it to the right contact/thread.

**Gaps**

- **Reply tracking:** To know “contact responded,” you need either:
  - **A)** SendGrid inbound parse webhook + logic to match reply to contact (by thread id / message id / email) and create an activity or “replied” event, or
  - **B)** Manual: user marks “replied” on contact or on the email activity.

**Recommendation**

- Short term: **manual** – e.g. “Mark as replied” on contact or on the email row, or use pipeline stage (e.g. move to “interest” when they reply). Medium term: implement **inbound parse** (SendGrid or similar), match to `email_activities` / contact, set event=replied and optionally store snippet or link to thread.

---

## 8. Service to remind (and optional agent)

**What exists**

- **Data to remind:** Contacts with `lastContact` set, pipeline = prospect, stage not contract-signed (CONTACT_MANUAL_TRACKING). You can query “contacted but no reply / not closed” and suggest follow-up.
- **No reminder service:** No cron, no scheduled job, no agent that “reminds me to follow up with these contacts.”

**Gaps**

- **Reminder mechanism:** Need something that:
  - Runs on a schedule (cron) or on-demand,
  - Finds contacts due for follow-up (e.g. last send &gt; N days, no reply, still in prospect),
  - Surfaces them (e.g. list in UI, or digest email to you), and optionally suggests template (from step 5).
- **Agent:** “Build an agent” here = automate the above and maybe draft a follow-up (e.g. “here’s a short list and a suggested snippet”) or send a daily digest. Can start as “list + link to compose” and later add LLM-suggested next step or auto-draft.

**Recommendation**

- **Phase 1:** Reminder **list**: API + UI “contacts to follow up” (last_send_at or lastContact &gt; N days ago, no replied event, pipeline/stage = prospect). No automation yet.
- **Phase 2:** **Cron or scheduled job** that builds this list and e.g. sends you an email digest or creates a “Follow-up” queue in the app.
- **Phase 3:** **Agent:** Same list + optional “suggest template/snippet for each” (using step 5) and/or “draft one-line follow-up” using LLM. Agent = “remind + suggest” rather than “send without human approval” if you want to keep human in the loop.

---

## Summary table

| Step | What exists | What’s missing |
|------|-------------|----------------|
| 1. Ingest CSV (emails + notes) | Upload + batch API; Contact.notes, .title | Map `notes` (and optionally `title`) from CSV in batch route; align with LinkedIn column names |
| 2. Bulk send | Single send via outreach/send; Apollo = enrich only | Bulk send from list; optional import_batch_id / list id for “same CSV stem” |
| 3. Template snippets | GoFast content_snippets (variableName, words); Ignite has full templates only | Snippet entity in Ignite + composition (templates = snippet refs + variables) |
| 4. Persona types | persona_type, prior_relationship enums | “Warm + using competitor” = tag or competitive_situation field |
| 5. Match template → persona → contacts | Hydrate template for contact; doc’d selection logic | Explicit mapping (DB or config): persona/relationship/tag → template or snippet set; use in bulk send |
| 6. Send dates | email_activities.createdAt per send | Optional Contact.last_send_at for convenience |
| 7. Response from contact | email_activities events (sent, opened, clicked) | Reply tracking: inbound parse or manual “replied” |
| 8. Remind | Query pattern (lastContact + pipeline) | Reminder list API/UI; cron digest; optional agent (suggest template / draft) |

---

## Suggested implementation order (beta)

1. **Batch CSV:** Add `notes` (and `title`) to batch route so his LinkedIn export + notes ingest in one go.
2. **Bulk send:** Minimal “select contacts + one template → send all” (or per-contact template by step 5), with rate limiting and logging to email_activities.
3. **Persona + matching:** Add simple template selection rules (persona_type + prior_relationship → template_id) and use in bulk send; add tag or field for “using competitor” if needed.
4. **Template snippets:** Add snippet store in Ignite (or minimal KV) and “compose template from snippets” so his mypitch etc. are reusable.
5. **Reminder list:** “Contacts to follow up” API + UI; then cron digest; then optional agent for suggest/draft.

This doc is the single place that ingests “all of the above” and ties it to the codebase and next steps.
