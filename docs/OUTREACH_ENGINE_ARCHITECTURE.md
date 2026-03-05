# Outreach Engine Architecture

**Status:** Canonical reference — written to capture the full picture  
**Date:** 2026-03-05

---

## The Core Insight

The system was built around a structured view of what a business development email actually *is*. Not a blob of text — a sequence of intentional moves, each serving a specific role.

### The Email Skeleton

Every outreach email has the same anatomy. We defined this with `TemplatePosition`:

```
OPENING_GREETING   →  "Hi John,"
CATCH_UP           →  "It's been a while — we worked together at..."
BUSINESS_CONTEXT   →  "Since then I've been focused on NDA workflow..."
VALUE_PROPOSITION  →  "We've helped teams reduce turnaround by..."
COMPETITOR_FRAME   →  "If you're exploring alternatives to your current provider..."
TARGET_ASK         →  "I'd welcome the opportunity to connect."
SOFT_CLOSE         →  "Best, Joel"
```

Not every email uses every position. But every email has positions. This is the skeleton. The insight is that once you name the positions, you can build, reuse, and remix email components with surgical precision.

---

## The Three-Layer Model

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1 — PHRASE LIBRARY  (content_snips table)               │
│  Atomic, sentence-level building blocks                         │
│  Tagged by: templatePosition + personaSlug + bestUsedWhen       │
│                                                                 │
│  "I split off from Ares a few years ago"                        │
│   → BUSINESS_CONTEXT / prior_relationship_long_dormant          │
│                                                                 │
│  "I would welcome the opportunity to discuss."                  │
│   → TARGET_ASK / general_soft_outreach                          │
└────────────────────────┬────────────────────────────────────────┘
                         │  assembled by AI (generate-with-snippets)
                         │  or composed manually
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2 — TEMPLATES  (templates table)                         │
│  Full composed emails, persona-tagged, with variable slots      │
│  Tagged by: personaSlug                                         │
│                                                                 │
│  "Hi {{first_name}}, it's been some time since I reached out.  │
│   As a reminder, since launching {{your_company}}..."           │
│   → personaSlug: ReactivationAfterStaleRelationship             │
└────────────────────────┬────────────────────────────────────────┘
                         │  slots filled with contact data at send time
                         │  {{first_name}} → John, {{company_name}} → MidFirst
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3 — SENDS  (email_activities table)                      │
│  Hydrated, contact-specific, logged                             │
│  The actual email that went to John at MidFirst                 │
└─────────────────────────────────────────────────────────────────┘
```

**The persona slug runs through all three layers as the organizing spine.**  
A phrase block knows its persona. A template knows its persona. When you have a contact with a persona assigned, the system can walk all three layers coherently.

---

## The Three Build Paths (all output to Layer 2)

### Path A — Build from Library
The AI generation path. Takes the contact's persona + relationship context, selects phrase blocks by `templatePosition` and `personaSlug`, assembles them into a complete email skeleton, generates transitions.

```
Phrase Library (Layer 1) → generate-with-snippets → Template (Layer 2)
```

**Best for:** First time reaching out to this persona type, no prior template exists.

---

### Path B — Build from History
The off-platform capture path. A real sent email exists in `email_activities`. The user converts it to a reusable template by parameterizing contact-specific values.

```
Sent email (Layer 3) → strip specifics → {{first_name}} / {{company_name}} → Template (Layer 2)
```

**Best for:** User wrote a great email outside the platform. Capture it before it's lost.

---

### Path C — Build from Template (Remix)
Use an existing persona template as the base. Adjust tone, step, or cadence variant. Save as a new template.

```
Existing Template (Layer 2) → edit / remix → New Template (Layer 2)
```

**Best for:** You have a template for initial outreach but need a follow-up variant for the same persona.

---

## Key Design Decisions

### 1. Phrase blocks are persona-aware, not contact-aware
A phrase block knows it belongs to `prior_relationship_long_dormant`. It does NOT know about any specific contact. The persona is the unit of reuse.

### 2. Templates are persona-owned, not contact-owned
A template belongs to `ReactivationAfterStaleRelationship`. Not to John. John was the example that revealed the pattern. The template is reusable for any future contact with that persona.

### 3. Contact data is only used at hydration time (Layer 3)
`{{first_name}}`, `{{company_name}}` etc. are filled in at the moment of sending. The template itself never has a contact baked in.

### 4. `personaSlug` is a soft string match everywhere
No foreign key between layers. This is intentional — it allows flexibility, multiple templates per persona, phrase blocks that span personas, and evolution of persona taxonomy without migrations.

---

## What Needs to Be Built to Close the Loop

The three layers and three build paths exist in the data model. What's missing is the UI that makes them visible and connected:

| Gap | What's needed |
|---|---|
| No "Persona Templates" section on contact detail | Show Layer 2 templates for the contact's persona |
| No "Use this" path for template reuse | Pre-load template into outreach-message page |
| No Phrase Library CRUD page | Let users see/edit/add phrase blocks |
| No unified "build from X" entry point | When persona is set but no template exists, offer Path A / B / C |
| `{{first_name}}` / `{{company_name}}` not hydrated in reuse path | Add variable substitution when loading a template for a contact |

---

## The Phrase Library (Renamed from "Content Snippets")

`content_snips` in the DB — rename the UI label to **Phrase Library**.

Why the rename matters: "snippet" implies something small and throwaway. "Phrase Library" implies a curated, intentional catalogue of the user's voice — how they actually talk about what they do, how they open, how they close. It's more accurate and more valuable-feeling.

Each phrase block represents: **a sentence or phrase the user actually says, assigned to its structural role in an email, tagged to the persona situations where it fits.**

That's not a snippet. That's a voice catalogue.

---

## Existing Documentation (Reference)

- `docs/TEMPLATE_POSITION.md` — full enum + assembly order
- `docs/SNIPPET_ASSEMBLY_ARCHITECTURE.md` — assembly service design
- `docs/OUTREACH_PERSONAS.md` — persona model
- `docs/PERSONA_TEMPLATE_PLAN.md` — template save/reuse from contact detail
- `docs/OUTREACH_MESSAGE_ARCHITECTURE.md` — generate-with-snippets flow
