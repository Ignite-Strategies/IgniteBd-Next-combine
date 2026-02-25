# Outreach Message Architecture

> Last updated: Feb 2026  
> Context: [Outreach Tracker + Contact Detail integration](./OUTREACH_TRACKER_AND_CONTACT_DETAIL_INTEGRATION.md)

---

## The Model Shift

**Old (template factory):** Build generic reusable templates → assign to contact → hydrate variables → send. Contact is just a variable slot.

**New (contact-first):** Start from this specific person's relationship context, persona, career move, former company — derive a message built for them. Snippets are reusable building blocks; the assembled output is unique per contact.

---

## Current Architecture

### The contact-scoped generation flow

```
Contact Detail (/contacts/[contactId])
  └─ "Build Email" button
       └─ /contacts/[contactId]/outreach-message  ← NEW clean entry point
            └─ POST /api/template/generate-with-snippets
                 ├─ Fetches contact + relationship_contexts + outreachPersonaSlug from DB
                 ├─ Fetches persona name/description from outreach_personas table
                 ├─ Strips DONT_KNOW values before AI sees them
                 ├─ Builds persona-aware tone guidance (e.g. former colleague = casual, not formal intro)
                 └─ Selects + assembles content snippets (ContentSnip library)
```

### Key files

| File | Role |
|------|------|
| `app/(authenticated)/contacts/[contactId]/outreach-message/page.jsx` | **Entry point.** Contact-scoped UI. Hydrates all context from DB on load, shows relationship context + persona chips (DONT_KNOW filtered), editable notes + additional context box, generates + displays result. |
| `app/api/template/generate-with-snippets/route.js` | **AI generation.** Takes `contactId` + `companyHQId`, pulls everything from DB, builds tone-aware prompt, calls OpenAI, returns assembled template. |
| `app/(authenticated)/templates/create/ai-snippets/page.jsx` | **Legacy entry point.** Still works but is the old URL-param-heavy approach. Eventually should be deprecated for contact-scoped use. OK for standalone/non-contact use. |
| `app/(authenticated)/contacts/[contactId]/page.jsx` | Contact detail. "Build Email" now routes to `/contacts/[contactId]/outreach-message`. |
| `prisma/schema.prisma` → `outreach_personas` | Persona records: `slug`, `name`, `description`. Description is passed to AI for tone guidance. |
| `prisma/schema.prisma` → `relationship_contexts` | Per-contact relationship dims: `contextOfRelationship`, `relationshipRecency`, `formerCompany`, `primaryWork`, etc. The AI prompt is built from this. |
| `prisma/schema.prisma` → `ContentSnip` | The reusable snippet library. AI selects from these by `personaSlug` + `bestUsedWhen` + `templatePosition`. |

---

## The DONT_KNOW Problem

Several relationship context fields are stored as `"DONT_KNOW"` when the user hasn't specified them. These must be **stripped before reaching the AI** — they were leaking into the prompt and causing the AI to write copy that referenced unknown values.

**Where stripping happens:** `generate-with-snippets/route.js` — the `isDefined()` helper filters any value equal to `"DONT_KNOW"` before building the AI prompt sections.

**Also strip in display:** `outreach-message/page.jsx` — the `ContextChips` component also filters these before rendering.

---

## Saving Generated Messages — Two Paths

When the user hits **Save as Template** on the outreach-message page, two things happen in parallel:

### 1. Draft on the contact (`off_platform_email_sends`, `emailSent = null`)

The generated message is saved as a draft email record directly on the contact. `emailSent` is nullable — `null` means draft, a date means sent.

- **Fast lookup path:** Contact → Email History → see draft → "Edit & Send"
- No template lookup, no personaSlug matching — the message is right there on the person
- `platform = "ai-draft"` distinguishes it from manually-recorded sends
- Contact detail Email History shows drafts at the top with an amber "Draft" badge + "Edit & Send" link
- Only actual sends (non-null `emailSent`) advance the pipeline stage

### 2. Template in the library (`templates`, keyed by `personaSlug`)

Simultaneously saved to the templates table with `personaSlug` for future reuse across contacts with the same persona type.

- **Slow lookup path (future):** Template → match personaSlug → suggest to next contact with same persona
- Already wired, `personaSlug` column live in DB

---

## Downstream: Template Reuse by Persona

### The question
Should a generated outreach message be saved as:
- **A new `contact_outreach_messages` table** (contact-scoped, ephemeral)
- **The existing `templates` table with a `personaSlug` field** (persona-scoped, reusable)

### The answer: `templates` + `personaSlug`

Add `personaSlug String?` to the `templates` model. No FK to contact.

**Why:**
- The contact UX generates it, but the *artifact* belongs to the persona type, not the individual contact
- A `FormerColleagueNowReachingOutAgainAfterLongTime` message that works well is useful for the next person with the same persona
- Keeps the template library as the single source of truth
- Avoids a new table + new API surface

**Migration needed (not done yet):**

```prisma
model templates {
  // ... existing fields ...
  personaSlug   String?   // links generated templates back to a persona type
  isAiGenerated Boolean   @default(false)  // distinguish AI-assembled from manually built

  @@index([personaSlug])
}
```

**Save flow (future):**
```
outreach-message page result
  └─ "Save as Template" button (optional, not required to use)
       └─ POST /api/templates  { companyHQId, ownerId, title, subject, body, personaSlug, isAiGenerated: true }
            └─ templates table — persona-indexed, company-scoped, no contactId
```

**Retrieval suggestion (future):**
```
Contact Detail "Build Email"
  └─ Check: does a template with personaSlug = contact.outreachPersonaSlug exist?
       ├─ Yes → "We have a template for this persona type — use it or generate fresh"
       └─ No  → Generate fresh (current behavior)
```

---

## What DOES NOT need a new schema

| Need | Where it lives |
|------|----------------|
| Generated message display/edit | Frontend state only — no persistence needed unless user saves |
| Relationship context for AI | `relationship_contexts` table (already exists, already FK'd to contact) |
| Persona tone/description | `outreach_personas` table (already exists) |
| Snippet library | `ContentSnip` table (already exists) |
| Saved reusable template | `templates` table + `personaSlug` field (migration pending) |

---

## Downstream TODOs (park for later)

- [ ] Add `personaSlug` + `isAiGenerated` to `templates` schema + migration
- [ ] Add "Save as Template" action on the outreach-message result page
- [ ] On contact detail "Build Email": check for existing persona-slug template and surface it as an option
- [ ] Consider deprecating `/templates/create/ai-snippets` for contact-scoped use (redirect to new route)
- [ ] Populate `outreach_personas.description` for each slug so the AI gets richer tone guidance
