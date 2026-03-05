# Targeting UX Proposal

## Problem

**Prospecting** = "find people" (list builder, broad search, AI-sourced).  
**Targeting** = "I already know who I want to reach — put these people in the next cadence."

We want to avoid one-off emails: the client has a cadence (e.g. 5 steps) and wants to say "send to **this person** for that cadence," with structure: who they are, my relationship to them, notes — then one action to send the initial email and have them enter the pipeline like any other prospect.

## Current state

- **Contact** has: `notes`, `prior_relationship` (RelationshipEnum: COLD | WARM | ESTABLISHED | DORMANT), `persona_type` (PersonaType), `outreachPersonaSlug`, pipeline snap (`prospect` / `need-to-engage` / `engaged-awaiting-response` etc.).
- **CSV upload** already supports: contact fields + `notes`, `pipeline`, `stage`. Batch API defaults new contacts to `prospect` / `need-to-engage`.
- **First send** (platform or off-platform) already moves `prospect` + `need-to-engage` → `engaged-awaiting-response` (see `outreach/send` and `off-platform-send`).
- **contact_lists** exist with `type` (e.g. "static"); Contact has `contactListId`.

So we have the pipeline and “first email → pipeline” behavior. What we’re missing is a **pre-pipeline bucket**: “these are my **targets** for the next cadence,” with UX to add them (CSV/manual), capture who/relationship/notes, optionally hydrate, then “send initial” so they enter the pipeline.

## Proposal

### 1. Enum: “Target” as a pre-pipeline intent

Add an enum and field on `Contact` so we can clearly separate “in the pool” vs “queued for this cadence”:

**Option A (recommended): enum on Contact**

```prisma
enum ContactOutreachIntent {
  PROSPECT   // Default: in pool, not specifically queued for next cadence
  TARGET     // Explicitly marked for next cadence run
}

// On Contact:
outreachIntent  ContactOutreachIntent?  @default(PROSPECT)
```

- **PROSPECT**: default; existing behavior (list builder, CSV without “target”, etc.).
- **TARGET**: “I want to reach this person in the next cadence.” Filter: “all contacts where outreachIntent = TARGET” = Targeting list.

**Option B: reuse contact_lists**

- Create a special list type `type = 'target'` (or a well-known list name “Targets”) and put contacts in that list. Targeting UX = view/edit that list.
- Pros: no schema change. Cons: “target” is then list membership, not an intrinsic flag; multiple target lists or “target for cadence X” gets messier.

Recommendation: **Option A** for a clear, filterable “these are my targets” bucket and simple “hydrate all targets” / “send initial to all targets” flows.

### 2. UX: Targeting flow

- **Targeting** = dedicated surface (e.g. “Targeting” under Engage, or a sub-view under Contacts/Outreach).
- **Who**: who they are (name, company, title) + **my relationship** (`prior_relationship`) + **notes** (existing fields). Optional: persona / outreach persona for copy.
- **Add targets**:
  - **CSV upload**: same as current contact upload, plus a column **Target** (or **Intent**): e.g. `target`, `1`, `yes` → set `outreachIntent = TARGET`. If column missing, default PROSPECT (or leave null).
  - **Manual**: add one contact (or pick existing) and set “Add to targets” / `outreachIntent = TARGET`.
- **List**: “Targets” = contacts where `outreachIntent = TARGET` (and not yet moved to pipeline by “send initial,” or keep as TARGET until first send — see below).

### 3. Hydrate targets

- “Hydrate” = enrich contacts (use existing enrichment flow) so we have good data before sending.
- **Action**: “Hydrate all targets” → call enrich for all contacts with `outreachIntent = TARGET` (and optionally not yet enriched, or force refresh). No schema change; reuse existing enrich API.

### 4. Send initial → pipeline

- **Action**: “Send initial email” (or “Start cadence”) for one or more targets.
  - Ensure contact has pipeline `prospect` + stage `need-to-engage` (already the default for new/CSV contacts).
  - Send first cadence email (existing send path).
  - Existing logic already moves `prospect` + `need-to-engage` → `engaged-awaiting-response` on first send.
- **After send**: either:
  - **A)** Clear target flag: set `outreachIntent = PROSPECT` (or null) so they leave the “Targets” list and live only in pipeline; or  
  - **B)** Keep `outreachIntent = TARGET` and add e.g. `targetedAt DateTime?` so we can show “Targeted on …” and still filter “not yet sent” by pipeline stage.

Recommendation: **A** for simplicity: once they’re in the pipeline, they’re a normal prospect; “Targets” = “not yet in pipeline for this cadence.”

### 5. CSV shape (contact/notes + target)

- Current CSV already has contact fields + `notes`, `pipeline`, `stage`.
- Add optional column (any case): **Target** (or **Intent**, **Targeting**). Values: `target`, `1`, `yes`, `true` → set `outreachIntent = TARGET`; otherwise `outreachIntent = PROSPECT` or leave default.
- Optionally map **Relationship** (or **Prior relationship**) to `prior_relationship` if not already (e.g. COLD, WARM, ESTABLISHED, DORMANT).

So the client can upload: contact, notes, relationship, target → we create/update contacts, set pipeline to prospect/need-to-engage, set outreachIntent = TARGET for marked rows → they show in Targeting → hydrate → send initial → they’re in the pipeline.

### 6. Summary flow

1. **Add targets**: CSV (contact + notes + optional relationship + target column) or manual “Add to targets.”
2. **Targeting list**: show contacts with `outreachIntent = TARGET`; show who they are, relationship, notes.
3. **Hydrate**: “Hydrate all targets” → enrich those contacts.
4. **Send initial**: pick cadence, send first email to selected targets → pipeline stays/becomes prospect/need-to-engage, first send moves to engaged-awaiting-response; clear `outreachIntent` to PROSPECT so they drop off the Targets list and are just in the pipeline.

This gives you a clear “Targeting” UX without one-off emails: targets are a structured queue, then one action turns them into pipeline prospects and kicks off the cadence.

---

## Implementation checklist (high level)

- [ ] Add `ContactOutreachIntent` enum and `Contact.outreachIntent` to schema; migration.
- [ ] **Targeting** page/section: list contacts where `outreachIntent = TARGET`; show name, company, relationship, notes; actions: Hydrate, Send initial.
- [ ] CSV upload: support **Target** (or Intent) column → set `outreachIntent`; optionally **Relationship** → `prior_relationship`.
- [ ] Batch API: accept target/relationship from normalized row; set `outreachIntent` and `prior_relationship`.
- [ ] “Send initial” for target(s): ensure pipeline prospect/need-to-engage, call existing send path; on success set `outreachIntent = PROSPECT` (or null).
- [ ] Optional: “Add to targets” from contact detail or contact list (set `outreachIntent = TARGET`).
- [ ] Sidebar/nav: add “Targeting” under Engage (or under Outreach) linking to the new Targeting view.

If you want, next step can be a concrete schema diff (Prisma), then API and UI changes in order.
