# Persona Template Plan

**Date:** 2026-03-05  
**Status:** Proposal — review before building

---

## The Core Insight

Real emails already exist in `email_activities`. The user (or their client) wrote something good — maybe with GPT help, maybe by hand — and it actually got sent. That's the most valuable source of template material we have. Right now there's no path from "this email was good" → "save it for reuse with this persona."

The AI generation path (outreach-message page) already has a "Save as template" post-generation. But that only works for AI-generated content. The off-platform and manually-written emails are dark.

---

## Schema Reality Check

**No new model needed.**

`templates.personaSlug` already exists as a `String?` on the `templates` table, already indexed. `POST /api/templates` already accepts `personaSlug`. `GET /api/templates` now accepts `?personaSlug=` (just added). A template with a `personaSlug` is a "persona template." Without one, it's a generic template. That's the only distinction.

The `outreach_personas` table has `slug` as the natural key. The soft string match on `personaSlug` is intentional — flexible, multi-template-per-persona, no FK constraint needed.

---

## What's Missing (The Gaps)

### Gap 1 — No "Make this a template" button on email history

Each email in the Email History section has Edit + Add Response. There's no way to say "this email was good — templatize it."

### Gap 2 — No variable conversion flow

Joel's actual email has concrete values: "John", "MidFirst", "NDA processing". If we save it raw, the next time we use it for a different contact it still says "John" and "MidFirst". We need to convert those concrete values into variable placeholders before saving.

### Gap 3 — No "Persona Templates" section on the contact detail page

Once a contact has `outreachPersonaSlug` set, there's nowhere to see "do we already have a template for this persona?" or "use this template for this contact."

---

## The Build Plan

### Piece 1 — "Make Template" button on each email in Email History

On each email activity card in the contact detail page, add a `Make template` button (alongside Edit / Add Response).

Clicking it opens the **Ingest Email as Template modal** (Piece 2), pre-populated with:
- `subject` from `email_activity.subject`
- `body` from `email_activity.body`
- `personaSlug` from `contact.outreachPersonaSlug` (if set)

---

### Piece 2 — `IngestEmailAsTemplateModal`

A focused modal for converting a real email into a reusable template.

**Fields shown:**
```
Title (auto-filled from persona slug, editable)
  e.g. "ReactivationAfterStaleRelationship – Check-in"

Persona  [purple badge — read-only if contact has one assigned]
  ReactivationAfterStaleRelationship

Subject  (editable, pre-filled from email)
  "Checking in — BusinessPoint Law"
```

**Split Pane:**
```
LEFT: Original Email (read-only)          RIGHT: Templatized Preview (live-updating)
──────────────────────────────────────    ──────────────────────────────────────────
Hi John, it's been some time since...     Hi {{first_name}}, it's been some time...
If NDA processing touches your team       If NDA processing touches your team
at MidFirst...                            at {{company_name}}...
```

**The critical mental model shift:**

Once you enter this modal, you are no longer thinking about John. You are thinking about `FormerColleagueButLongTimeNoCall`. John was the example that revealed the pattern. The template belongs to the persona, not the contact.

**Variable Mapper Panel** (between the two panes or below):

The contact data is used as a **detection hint only** — we know "John" = first name slot, "MidFirst" = company slot, because we have the contact record. But the output is a **persona-level reusable slot**, not a hydration of this contact's data.

| Detected value | How detected | Slot name | Toggle |
|---|---|---|---|
| John | matches contact.firstName | `{{first_name}}` | ✅ ON |
| MidFirst | matches contact.company | `{{company_name}}` | ✅ ON |
| Joel | matches owner.firstName | `{{sender_first_name}}` | ✅ ON |
| BusinessPoint Law | matches owner.companyName | `{{your_company}}` | ✅ ON |

User can toggle each substitution on/off. The right pane updates live.

The slots (`{{first_name}}`, `{{company_name}}`, etc.) are **persona template variables** — they represent the gaps in the pattern that any future contact with this persona will fill. The template is reusable for anyone who is `FormerColleagueButLongTimeNoCall`, regardless of their name or company.

**Variable format:** `{{variable_key}}` — consistent with the existing variable mapper service (not `{{snippet:}}` format, which is for content bank snippets).

**Save button:**
- `POST /api/templates` with `{ title, subject, body: templatizedBody, personaSlug, companyHQId }`
- If a template already exists for this `personaSlug` (detected on load), offer: **Save as new** vs **Replace existing**
- On success: closes modal, refreshes Piece 3 section below

---

### Piece 3 — "Persona Templates" section on Contact Detail

New section added **below the Outreach Persona section** on the contact detail page. Only renders when `contact.outreachPersonaSlug` is set.

```
┌──────────────────────────────────────────────────────┐
│ Persona Templates                    [+ Save email]  │
│ ReactivationAfterStaleRelationship                   │
│                                                      │
│ ▼ ReactivationAfterStaleRelationship – Check-in     │
│   Subject: Checking in — BusinessPoint Law           │
│   Saved 3 days ago                                   │
│   [Expand ↓]  [Use this →]                          │
│                                                      │
│ (empty state) No templates yet for this persona.    │
│ Make one from an email above or paste one in.        │
└──────────────────────────────────────────────────────┘
```

**"Use this →"** → navigates to `/contacts/[contactId]/outreach-message?templateId=X` — we'll add `?templateId` support to the outreach-message page so it pre-populates the body for the user to finalize and send.

**"+ Save email"** → same as making a blank Ingest modal (no pre-fill from email history — user pastes manually).

---

## What We Are NOT Building (Yet)

- `outreach_persona_templates` join table — not needed, soft match is correct
- Auto-variable substitution via AI — this is all client-side rule matching
- Surfacing persona templates in the Target Cockpit drawer — that comes after this
- Bulk "apply template to all contacts with this persona" — out of scope

---

## Data Flow Summary

```
email_activities (raw email Joel sent)
         │
         │ "Make template" button
         ▼
IngestEmailAsTemplateModal
  → detect variables (client-side)
  → user toggles substitutions
  → POST /api/templates  { personaSlug: "ReactivationAfterStaleRelationship", body: "Hi {{first_name}}..." }
         │
         ▼
templates table  (personaSlug = "ReactivationAfterStaleRelationship")
         │
         │ GET /api/templates?companyHQId=X&personaSlug=Y
         ▼
Persona Templates section (contact detail page)
  → "Use this" → outreach-message page with templateId preloaded
```

---

## Open Questions Before Building

1. **Variable format alignment** — RESOLVED. The template is in persona mode, not contact mode. `{{first_name}}`, `{{company_name}}`, etc. are persona-level slots. When a user hits "Use this" for a different contact with the same persona, the variableMapperService hydrates those slots from that new contact's data. If the service doesn't resolve a slot, the user fills it manually before sending. Either way, the template is useful.

2. **"Use this" → outreach-message deep link** — right now the outreach-message page has no `?templateId` support. Should we add it, or just show the template body inline in the contact detail for copy-paste? Leaning toward inline expand + copy for now (zero changes to outreach-message page), then add `?templateId` deep link as a follow-up.

3. **Upsert vs append** — one template per persona slug, or many? Many is correct — different tones, different cadence steps (initial outreach vs follow-up). The modal shows existing templates for the persona upfront so the user knows what already exists, but always saves as new.
