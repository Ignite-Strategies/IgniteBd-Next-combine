# Meeting System Plan

**Date:** 2026-03-05  
**Status:** Ranging out — no code yet

---

## The Problem

When a user has a meeting with a prospect, there's nowhere to log it. The only interaction history is `email_activities`. Notes on a contact is a single `String?` field that gets overwritten. Pipeline stage updates are manual (go to contact detail, open pipeline editor, change stage). There's no structured way to say "I met with John, it went well, he wants a proposal."

The inbound parse system handles **email responses**. This is a parallel system for **meetings** — a different action type with different signals and different downstream effects.

---

## What Exists Today

### Interaction logging
| Type | Exists? | How |
|------|---------|-----|
| Platform email sends | Yes | `email_activities` (OWNER_SEND, PLATFORM) |
| Off-platform email recording | Yes | `email_activities` (OWNER_SEND, OFF_PLATFORM) |
| Inbound email responses | Yes | `email_activities` (CONTACT_SEND, OFF_PLATFORM) via inbound parse |
| Meeting logging | No | Nothing |
| Call logging | No | Nothing |
| General notes timeline | No | Single `notes` field, no history |

### Notes on Contact
- `contact.notes` — single `String?`, overwritten each time
- No timestamp, no history, no author
- Used for: persona generation, relationship context, general scratchpad
- Updated via `PUT /api/contacts/[contactId]`

### Pipeline stages for prospect
```
need-to-engage → engaged-awaiting-response → interest → meeting → proposal → contract → contract-signed
```

The `meeting` stage exists but nothing auto-sets it. The only auto-movement is:
- Send outreach → `need-to-engage` → `engaged-awaiting-response`
- Record response → `engaged-awaiting-response` → `interest`
- Sign contract → `prospect/contract-signed` → `client/kickoff`

### Contact fields that a meeting should touch

The Contact model already has a LOT of buyer intelligence. Here's every field that's relevant when logging a meeting, grouped by what happens.

#### Auto-set (no user input needed)

| Contact field | Type | What happens | When |
|---------------|------|-------------|------|
| `lastContactedAt` | DateTime? | Set to meeting date | Always | Rename to `lastEngagementAt`? Meetings aren't "contacting." |
| `prior_relationship` | RelationshipEnum | Upgrade only: COLD→WARM on first meeting. WARM→ESTABLISHED after 2+. Never downgrade. | Always | — |
| `nextEngagementDate` | String? (YYYY-MM-DD) | Set from meeting form's follow-up date | When user provides it | Canonical next field. `nextContactedAt` should merge into this. |
| `nextEngagementPurpose` | NextEngagementPurpose | Set to `MEETING_FOLLOW_UP` (new value) | When nextEngagementDate set | — |
| `pipelineSnap` / `pipelineStageSnap` | String? | Snapped after pipeline move | When user confirms pipeline suggestion | Already exists |

**Note:** `lastRespondedAt` removed from auto-set. A meeting isn't a "response." That field is email-specific (they replied to our outreach). Meetings are mutual — we don't need to track who "responded."

#### User-set via meeting form (mapped to Contact on save)

| Contact field | Type | Current values | How it maps from meeting |
|---------------|------|---------------|------------------------|
| `buyingReadiness` | BuyingReadiness? | NOT_READY, READY_NO_MONEY, READY_WITH_MONEY | "Do they have budget?" — optional dropdown in meeting form |
| `buyerPerson` | BuyerPerson? | BUSINESS_OWNER, DIRECTOR_VP, PRODUCT_USER | "What's their role?" — confirm/update if learned in meeting |
| `doNotContactAgain` | Boolean | default false | If outcome = NEGATIVE and user confirms "stop outreach" |

**Removed from meeting mapping:**
- ~~`contactDisposition`~~ — zero reads, zero writes in entire codebase. Drop the field entirely (see Collision Map below).

#### Buyer intelligence scores (already on Contact, currently from enrichment)

These exist but are populated by enrichment, not meetings. Worth knowing they're there — meetings could *confirm or override* these in the future.

| Contact field | Type | What it is | Meeting-relevant? |
|---------------|------|-----------|-------------------|
| `buyerLikelihoodScore` | Int? | How likely to buy (enrichment) | Future: meeting confirms/overrides |
| `buyingPowerScore` | Int? | Budget authority score | Future: "they have budget" → boost |
| `readinessToBuyScore` | Int? | Ready to buy now? | Future: meeting outcome feeds this |
| `urgencyScore` | Int? | How urgent is their need | Future: "they need this ASAP" → boost |
| `rolePowerScore` | Int? | Power in org | Future: learned they're actually the VP |
| `budgetAuthority` | Boolean? | Has budget authority | Could set from meeting: "they control the budget" |
| `decisionMaker` | Boolean? | Is the decision maker | Could set from meeting: "they make the call" |
| `gatekeeper` | Boolean? | Is a gatekeeper | Could set from meeting: "they screen for their boss" |
| `influencer` | Boolean? | Is an influencer | Could set from meeting: "they recommend but don't decide" |
| `buyingTriggers` | String[] | What triggers a purchase | Could append: "new regulation coming", "contract expiring" |
| `whatTheyreLookingFor` | String? | "growth", "stability", "opportunity" | Could set from meeting notes |
| `persona_type` | PersonaType? | DECISION_MAKER, INFLUENCER, etc. | Confirm/update — same data as decisionMaker/gatekeeper booleans but as enum |

#### Pipeline (separate model, but snapped onto Contact)

| Model | Field | Current values | Meeting trigger |
|-------|-------|---------------|----------------|
| `pipelines.stage` | String | need-to-engage → engaged-awaiting-response → interest → **meeting** → proposal → contract → contract-signed | Auto: `interest` → `meeting` when meeting logged. Suggested: `meeting` → `proposal` if outcome positive. |
| `Contact.pipelineSnap` | String? | Mirrors pipelines.pipeline | Snapped after move |
| `Contact.pipelineStageSnap` | String? | Mirrors pipelines.stage | Snapped after move |

### Meetings page (current)
- `/meetings` exists but it's mostly a placeholder
- "Meeting Prep" section: search contact, generate BD intel, go to prep page
- "Upcoming Meetings" section: "Coming Soon" — would pull from Microsoft Graph calendar
- No meeting *logging* capability at all

### Meeting prep (`contact_analyses`)
- Pre-meeting: generates fit scores, talk track, risks, opportunities
- Good for going INTO a meeting
- Nothing for what happens AFTER

---

## Design Questions

### Question 1: Should Meeting be a model?

**Option A: No model — just use email_activities with a new event type**

Meetings become another `email_activities` row with `event: 'meeting'`. The `body` field holds the notes. This keeps everything in one timeline.

Pros:
- Single activity timeline (email + meetings mixed together)
- Existing email history endpoint already works
- No migration

Cons:
- `email_activities` is email-shaped (has `email`, `subject`, `messageId`, `emailSequenceOrder`). A meeting jammed in there is semantically weird
- Can't store meeting-specific data (attendees, outcome, duration, location)
- The model name literally says "email"
- Querying "all meetings" means filtering a huge email table

**Option B: New `meetings` model — separate from email_activities**

A proper model with meeting-specific fields.

Pros:
- Clean data model — meetings aren't emails
- Can store: attendees, outcome, duration, location, meeting type
- Can query meetings directly
- Can relate to Microsoft Graph calendar events later
- Can have its own API and UX
- Future: meeting → auto-pipeline movement is clean

Cons:
- Another model, another API, another set of endpoints
- Contact detail page needs to merge two timelines (emails + meetings)

**Option C: Generic `activities` model that covers both**

A polymorphic activity model: `type: 'email' | 'meeting' | 'call' | 'note'`

Pros:
- Single timeline for everything
- Future-proof for calls, LinkedIn messages, etc.

Cons:
- Premature abstraction — we know emails and meetings, that's it
- email_activities already exists with 10+ indexes, tons of code, real data
- Migrating email_activities → generic activities is a massive refactor for no immediate value

**Recommendation: Option B — new `meetings` model**

Meetings are structurally different from emails. They have attendees, outcomes, durations. Don't force-fit them into `email_activities`. The contact detail page can merge the two timelines in the UI by interleaving based on date.

### Question 2: What fields does a Meeting need?

```
Meeting
├── id
├── contactId (FK → Contact)           — who was the meeting with
├── ownerId (FK → owners)              — who from our side
├── crmId (FK → company_hqs)           — tenant
├── meetingDate (DateTime)             — when it happened
├── duration (Int?)                    — minutes (optional)
├── location (String?)                 — "Zoom", "Their office", etc.
├── meetingType (MeetingType enum)     — INTRO, FOLLOW_UP, PROPOSAL_REVIEW, CONTRACT_DISCUSSION, CHECK_IN, OTHER
├── outcome (MeetingOutcome enum)      — POSITIVE, NEUTRAL, NEGATIVE, NO_SHOW
├── notes (String? @db.Text)           — free-text meeting notes
├── buyerInterest (BuyerInterest enum) — HIGH, MEDIUM, LOW, NONE (signal strength)
├── suggestedNextStage (String?)       — e.g. "proposal" — what should pipeline move to
├── nextEngagementDate (String?)       — "YYYY-MM-DD" — when to follow up
├── nextAction (String?)               — "Send proposal", "Schedule demo", "Follow up in 2 weeks"
├── externalEventId (String?)          — Microsoft Graph event ID (for linking calendar events)
├── source (MeetingSource enum)        — MANUAL, CALENDAR_SYNC, INBOUND_PARSE
├── createdAt
├── updatedAt
```

### Question 3: What happens downstream when a meeting is logged?

This is the pipeline intelligence layer. When you log a meeting, the system should:

| Action | Automatic vs Suggested | Details |
|--------|----------------------|---------|
| **Pipeline stage update** | Suggested (user confirms) | If at `interest`, suggest → `meeting`. If meeting went well, suggest → `proposal`. |
| **nextEngagementDate** | Auto-set | From the meeting form or AI parse |
| **nextEngagementPurpose** | Auto-set | New value: `MEETING_FOLLOW_UP` |
| **prior_relationship** | Auto-set (upgrade only) | COLD → WARM after first meeting. Never downgrade. |
| **buyingReadiness** | Suggested | If notes say "they have budget" → suggest READY_WITH_MONEY |
| **lastContactedAt** | Auto-set | Meeting date |
| **lastRespondedAt** | Maybe auto-set | If they showed up, they responded |

### Question 4: What about the notes problem?

Contact.notes is a single overwritable string. That's fine for a scratchpad/persona context. But meeting notes are per-meeting — they belong on the Meeting model, not the Contact.

Options for general note history:
1. **Leave contact.notes as-is** — it's a scratchpad, not a log. Meeting notes go on the Meeting model. Email notes go on email_activities.body. Each interaction type owns its own notes.
2. **Add a `contact_notes` model** — timestamped notes array. Overkill right now.
3. **Use the Meeting model's notes field** — a meeting IS a note with structure. If you just want to jot "Called John, he's interested" — log it as a meeting with type CHECK_IN.

**Recommendation: Option 1 for now.** Meeting notes live on the Meeting. Contact.notes stays as the general scratchpad. If we need a timestamped notes log later, that's a separate model.

### Question 5: What about the pipeline auto-movement logic?

Current auto-movements:
```
Send outreach       → need-to-engage → engaged-awaiting-response
Record response     → engaged-awaiting-response → interest
Contract signed     → prospect/contract-signed → client/kickoff
```

Proposed additions from meetings:
```
Log meeting (any)   → interest → meeting (if was at interest)
Meeting positive    → meeting → proposal (SUGGESTED, not auto)
Meeting negative    → flag for review (suggest doNotContactAgain?)
Proposal discussed  → meeting → proposal (if meetingType = PROPOSAL_REVIEW)
```

Key principle: **auto-set the obvious ones, suggest the judgment calls.** Moving from `interest` → `meeting` after logging a meeting is obvious. Moving from `meeting` → `proposal` requires judgment — maybe it was a bad meeting.

### Question 6: UX-first — what does the meeting logging flow look like?

The user just had a meeting. They want to log it. Two paths:

**Path 1: Platform (priority — build this first)**

User goes to `/meetings` or clicks "Log Meeting" from contact detail page.

```
┌─────────────────────────────────────────────────────┐
│ Log Meeting                                         │
│                                                     │
│ Contact    [Search / Select]          ← required    │
│ Date       [2026-03-05]              ← default today│
│ Type       [Follow-up ▼]            ← dropdown      │
│                                                     │
│ How did it go?                                      │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                   │
│ │  +  │ │  ~  │ │  -  │ │ N/S │ ← outcome          │
│ │Pos. │ │Neut.│ │Neg. │ │NoShow│                    │
│ └─────┘ └─────┘ └─────┘ └─────┘                    │
│                                                     │
│ Buyer Interest  [High ▼]            ← optional      │
│                                                     │
│ Notes                                               │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Great meeting. Joel is interested in NDA        │ │
│ │ processing. Has budget. Wants to see a          │ │
│ │ proposal by end of month.                       │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Next action     [Send proposal        ]  ← free text│
│ Follow-up date  [2026-03-12           ]  ← date     │
│                                                     │
│                        ┌──────────────────┐         │
│                        │   Log Meeting    │         │
│                        └──────────────────┘         │
│                                                     │
│ ── Pipeline Suggestion (after submit) ──────────── │
│                                                     │
│ ⓘ This contact is at stage: interest                │
│   Based on this meeting, suggest moving to:         │
│   [meeting ▼]  →  [proposal ▼]                      │
│                                                     │
│   [ ] Also update buying readiness → READY_WITH_MONEY│
│                                                     │
│                    [Apply]  [Skip]                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

After logging:
1. Meeting record created
2. nextEngagementDate set on contact
3. prior_relationship upgraded if needed (COLD → WARM)
4. lastContactedAt set
5. Pipeline suggestion shown (user confirms or skips)

**Path 2: Inbound parse (build later)**

New subdomain: `meetings@crm.ignitestrategies.co` or similar.
User forwards a calendar invite or meeting summary email.
AI parses it into a Meeting record instead of an email_activities record.
Same promote flow but creates a Meeting, not an email_activity.

---

## Build Phases

### Phase 1: Meeting model + API + UX (Platform-first)

What:
- Prisma model for `meetings`
- New enums: `MeetingType`, `MeetingOutcome`, `BuyerInterest`, `MeetingSource`
- Expand `NextEngagementPurpose` with `MEETING_FOLLOW_UP`
- API routes: `POST /api/meetings`, `GET /api/meetings` (list), `GET /api/meetings/[id]`, `PUT /api/meetings/[id]`
- Meeting log form (modal or page)
- Pipeline suggestion UI after meeting log
- Contact detail: merged timeline (emails + meetings by date)

### Phase 2: Pipeline auto-triggers from meetings

What:
- When meeting logged and contact is at `interest` → auto-move to `meeting`
- When outcome positive + type is `PROPOSAL_REVIEW` → suggest `proposal`
- prior_relationship auto-upgrade (COLD → WARM, WARM → ESTABLISHED)
- buyingReadiness suggestion based on notes (optional, AI-assisted later)

### Phase 3: Meeting inbound parse

What:
- New subdomain: `meetings.crm.ignitestrategies.co` (or reuse `crm.` with a different slug pattern)
- New webhook: `/api/inbound-meeting` (or extend `/api/inbound-email` with type detection)
- AI parsing service for meetings (extract: contact, date, outcome, notes, next action)
- Creates a Meeting record instead of email_activities
- Same promote flow pattern as inbound parse

### Phase 4: Calendar integration

What:
- Microsoft Graph calendar events → auto-create Meeting records
- Match attendees to contacts
- After meeting time passes → prompt user to log outcome/notes
- Pre-populate meeting date, attendees, location from calendar event

---

## Schema Sketch

```prisma
enum MeetingType {
  INTRO
  FOLLOW_UP
  PROPOSAL_REVIEW
  CONTRACT_DISCUSSION
  CHECK_IN
  DEMO
  OTHER
}

enum MeetingOutcome {
  POSITIVE
  NEUTRAL
  NEGATIVE
  NO_SHOW
  CANCELLED
}

enum BuyerInterest {
  HIGH
  MEDIUM
  LOW
  NONE
}

enum MeetingSource {
  MANUAL
  CALENDAR_SYNC
  INBOUND_PARSE
}

model Meeting {
  id                String          @id @default(cuid())
  contactId         String
  ownerId           String
  crmId             String

  meetingDate       DateTime
  duration          Int?
  location          String?
  meetingType       MeetingType     @default(OTHER)
  outcome           MeetingOutcome?
  notes             String?         @db.Text
  buyerInterest     BuyerInterest?
  nextAction        String?
  nextEngagementDate String?

  suggestedNextStage String?
  pipelineApplied    Boolean         @default(false)

  externalEventId   String?
  source            MeetingSource   @default(MANUAL)

  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  contact           Contact         @relation(fields: [contactId], references: [id])
  owner             owners          @relation(fields: [ownerId], references: [id])
  company_hq        company_hqs     @relation(fields: [crmId], references: [id])

  @@index([contactId])
  @@index([ownerId])
  @@index([crmId])
  @@index([meetingDate])
  @@index([contactId, meetingDate])
}
```

---

## Decisions Made

1. **Sidebar nav** — Bolt "Meetings" onto left sidebar. Already exists at `/meetings` in the nav. The page just needs real content instead of "Coming Soon." Good for testing, easy to find.

2. **Single contact per meeting (v1)** — `contactId` on Meeting, no join table. Multi-attendee is a v2 concern.

3. **Pipeline suggestion inline** — After logging, show the suggestion in the same view. Apply or Skip.

---

## Open Questions

1. **Meeting vs Activity** — Should we also consider calls, LinkedIn messages, etc. now? Or just meetings? Leaning meetings-only for now, expand later.

2. **Merged timeline** — On the contact detail page, do we interleave meetings with emails chronologically, or keep them in separate sections? Leaning interleaved — one timeline, different card styles for email vs meeting.

3. **NextEngagementPurpose expansion** — Add `MEETING_FOLLOW_UP`? Or is `GENERAL_CHECK_IN` sufficient? Leaning add it — the follow-up reason matters for cadence and template selection.

4. **BuyerInterest on Contact vs Meeting** — Should `buyerInterest` also be a field on Contact (snapped from latest meeting)? Similar to how `pipelineSnap` works. Or only on individual Meeting records?

5. **How much buyer intelligence in the meeting form?** — The Contact has ~15 buyer fields (scores, booleans, enums). The meeting form shouldn't be a wall of dropdowns. Options:
   - **Minimal (v1):** Outcome + buyer interest + notes + follow-up date. Pipeline suggestion after save. That's it.
   - **Progressive:** Show a "More details" expander with buyingReadiness, budgetAuthority, decisionMaker if user wants to capture them.
   - **AI-assisted (later):** Parse the notes field to suggest updates to buyer fields. "You wrote 'they have budget' — update buyingReadiness to READY_WITH_MONEY?"

6. **The enrichment overlap** — Contact already has `buyerLikelihoodScore`, `readinessToBuyScore`, `buyingPowerScore` etc. from enrichment. Should meetings override these? Or are meeting-sourced signals a separate layer? Leaning: don't touch enrichment scores from meetings. Keep them separate. Meeting-sourced intelligence goes into `buyingReadiness`, `budgetAuthority`, `decisionMaker` (the enum/boolean fields). Enrichment scores stay as enrichment.

7. **persona_type vs the boolean trio** — Contact has `persona_type` (enum: DECISION_MAKER, INFLUENCER, etc.) AND `decisionMaker` (Boolean), `gatekeeper` (Boolean), `influencer` (Boolean). These overlap. Should the meeting form just set `persona_type` and ignore the booleans? Or sync them? Probably just use `persona_type` in the meeting form and leave booleans for enrichment.

---

## Contact Schema Collision Map

The Contact model has 10 engagement/status fields. Half of them collide with each other. Here's the full audit.

### The "Last" Fields (3 fields, should be 1)

| Field | Type | Reads | Writes | What it does |
|-------|------|-------|--------|-------------|
| `lastContactedAt` | DateTime? | 4 files | 5 files (via snapContactLastContactedAt) | Last time WE contacted THEM. Set on every send. |
| `lastRespondedAt` | DateTime? | 2 files | 2 files | Last time THEY replied. Set on response recording. |
| `lastContact` | String? | 2 files | **0 files** | Manual string "Aug 2025". Collected in targeting modal but NEVER PERSISTED to Contact. |

**The collision:** `lastContactedAt` and `lastRespondedAt` track two sides of the conversation. But with meetings, it gets weird — a meeting is mutual. Who "contacted" whom? The distinction breaks down. The user wants one field: "when was the last interaction with this person, period."

**Proposal:**
- Keep `lastContactedAt` → rename conceptually to "last engagement" (or actually rename the field). Set it on ANY interaction: send, response, meeting.
- `lastRespondedAt` → keep for now, it's used in cadence logic. But long-term, this is a derived value (query email_activities + meetings for latest CONTACT_SEND).
- `lastContact` → **DROP IT.** Zero writes. The string "Aug 2025" was a pre-system manual note. We have real timestamps now.

### The "Next" Fields (4 fields, should be 2)

| Field | Type | Reads | Writes | What it does |
|-------|------|-------|--------|-------------|
| `nextEngagementDate` | String? (YYYY-MM-DD) | 14+ files | 6 files | Main "when to follow up." Set by cadence service, manual edits, inbound parse. |
| `nextEngagementPurpose` | NextEngagementPurpose? | 7 files | 4 files | Why we're following up (CHECK_IN, UNRESPONSIVE, etc.) |
| `nextContactedAt` | DateTime? | 2 files | 1 file | Older "when to contact next." Used by tracker route + next-contact API. |
| `nextContactNote` | String? | 7 files | 1 file | Free text: "Follow next quarter." Shown in outreach UI and email templates. |

**The collision:** `nextEngagementDate` and `nextContactedAt` are the same concept implemented twice. `nextContactedAt` was first, then `nextEngagementDate` was added as the "real" one. The cadence service only reads `nextEngagementDate`. The tracker route queries BOTH. `nextContactNote` is useful but orphaned from `nextEngagementDate` — it was designed to pair with `nextContactedAt`.

**Proposal:**
- `nextEngagementDate` → **KEEP.** This is the canonical "when to follow up." Everything already uses it.
- `nextEngagementPurpose` → **KEEP.** Add `MEETING_FOLLOW_UP` value.
- `nextContactedAt` → **DEPRECATE.** Migrate any non-null values to `nextEngagementDate` where `nextEngagementDate` is null. Then drop.
- `nextContactNote` → **KEEP** but re-pair with `nextEngagementDate`. This is the "why" in free text (vs `nextEngagementPurpose` which is the "why" as an enum). Both are useful.

### The "Status" Fields (3 fields, should be 0-1)

| Field | Type | Reads | Writes | What it does |
|-------|------|-------|--------|-------------|
| `doNotContactAgain` | Boolean | 8 files | 2 files | Opt-out flag. Set from response route when disposition is "not_interested." |
| `contactDisposition` | ContactDisposition? | **0 files** | **0 files** | HAPPY_TO_RECEIVE_NOTE / NEUTRAL / DOESNT_CARE. **COMPLETELY UNUSED.** |
| `remindMeOn` | DateTime? | **0 files** | **0 files** | Already marked DEPRECATED. **COMPLETELY UNUSED.** |

**The collision:** `doNotContactAgain` is an opt-out that should arguably be a pipeline state (`prospect/do-not-contact` or similar) rather than a boolean on Contact. But it IS actively used by 8 files. `contactDisposition` was designed but never wired into anything. `remindMeOn` is dead.

**Proposal:**
- `doNotContactAgain` → **KEEP for now.** It's deeply wired into cadence and tracker logic. Conceptually it's a "contact status" or pipeline terminal state, but refactoring it into pipeline would touch 8+ files. Leave it, revisit when we do a proper ContactStatus enum.
- `contactDisposition` → **DROP IT.** Zero reads, zero writes. If we need "attitude toward outreach," meetings are a better signal source than an enum no one sets.
- `remindMeOn` → **DROP IT.** Already deprecated, zero usage.

### Summary: What to Clean Up

| Field | Action | Effort |
|-------|--------|--------|
| `lastContact` (String?) | **DROP** — never persisted | Low |
| `remindMeOn` (DateTime?) | **DROP** — deprecated, zero usage | Low (backfill first) |
| `contactDisposition` (ContactDisposition?) | **DROP** — zero usage | Low |
| `nextContactedAt` (DateTime?) | **DEPRECATE → DROP** — migrate to nextEngagementDate | Medium |
| `lastContactedAt` → rename to `lastEngagementAt`? | **RENAME** — reflects meetings + emails | Medium (touches 5 writers) |
| `doNotContactAgain` | **KEEP** — revisit later as ContactStatus or pipeline state | None for now |

### The Buyer Field Overlap

While we're at it — the Contact has overlapping buyer intelligence fields too:

| Concept | Enum field | Boolean fields | Scores |
|---------|-----------|---------------|--------|
| Decision power | `persona_type` (DECISION_MAKER, INFLUENCER, etc.) | `decisionMaker`, `gatekeeper`, `influencer` (3 booleans) | `rolePowerScore`, `seniorityScore` |
| Budget | `buyingReadiness` (NOT_READY, NO_MONEY, WITH_MONEY) | `budgetAuthority` | `buyingPowerScore` |
| Likelihood | — | — | `buyerLikelihoodScore`, `readinessToBuyScore`, `urgencyScore` |
| Role | `buyerPerson` (BUSINESS_OWNER, DIRECTOR_VP, PRODUCT_USER) | — | — |

The booleans (`decisionMaker`, `gatekeeper`, `influencer`) overlap with `persona_type`. The scores overlap with `buyingReadiness`. This is enrichment vs manual input — both exist, neither is canonical. For the meeting system, we use the enums (`persona_type`, `buyingReadiness`) and ignore the booleans and scores.

---

## Existing Code We'll Touch

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add Meeting model, new enums |
| `lib/config/pipelineConfig.js` | No change — stages already have `meeting` |
| `app/api/meetings/route.js` | Extend — currently GET-only (calendar). Add POST for logging. |
| `app/(authenticated)/meetings/page.jsx` | Overhaul — add meeting log form, meeting history |
| `app/(authenticated)/contacts/[contactId]/page.jsx` | Add meeting history to timeline, "Log Meeting" button |
| `lib/services/pipelineService.ts` | Maybe — add `suggestNextStage(currentStage, meetingOutcome)` |
| `lib/services/emailCadenceService.js` | Maybe — meetings should count as "contact" for cadence |

---

## What We Are NOT Building (Yet)

- AI parsing of meeting notes for auto-extraction (Phase 3)
- Calendar sync / auto-create from Microsoft Graph (Phase 4)
- Meeting inbound parse subdomain (Phase 3)
- Bulk meeting import
- Meeting templates or agendas
- Multi-contact meetings (v1 = single primary contact)
- Call logging (separate model if/when needed)
