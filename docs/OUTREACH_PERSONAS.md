# Outreach Personas System

## Overview

The Ignite BD platform has **two distinct persona systems** that serve different purposes:

1. **`outreach_personas`** - Simple, global relationship/context personas for outreach matching
2. **`personas`** - Full BD personas (company-scoped, complex) for product fit and BD intelligence

This document focuses on **`outreach_personas`** and how they're used with ContentSnips and contacts.

---

## Outreach Personas (`outreach_personas`)

### Purpose
Simple, lightweight personas that classify **relationship context** and **outreach scenarios**. Used for:
- **Contact classification** - Assign to contacts to indicate relationship type
- **ContentSnip matching** - Help select appropriate snippets for template assembly
- **Template personalization** - Guide which messaging works best for which contact types

### Model Structure

```prisma
model outreach_personas {
  id          String    @id @default(cuid())
  slug        String    @unique // e.g., "FormerColleagueNowReachingoutAgainAfterLongTime"
  name        String // Display name: "Former Colleague - Long Time"
  description String?   @db.Text // What this persona represents
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  contacts    Contact[] // Contacts assigned this persona
}
```

**Key characteristics:**
- **Global** - Not company-scoped (unlike full `personas`)
- **Simple** - Just slug, name, description (no complex BD intelligence)
- **Slug-based** - Uses camelCase slugs like `FormerColleagueNowReachingoutAgainAfterLongTime`

### Example Outreach Personas

Common slugs you might see:
- `FormerColleagueNowReachingoutAgainAfterLongTime`
- `CompetitorSwitchingProspect`
- `NewColdOutreach`
- `PriorConversationFollowUp`
- `StaleDormantContact`

---

## How Outreach Personas Are Used

### 1. **Contact Classification**

Contacts have an `outreachPersonaSlug` field that references `outreach_personas.slug`:

```prisma
model Contact {
  // ...
  outreachPersonaSlug String? // FK to outreach_personas.slug
  outreach_personas   outreach_personas? @relation(...)
}
```

**Usage:** When viewing/editing a contact, you can assign an outreach persona to classify the relationship context (e.g., "Former colleague", "Cold outreach", "Competitor switching").

### 2. **ContentSnip Matching**

ContentSnips have an optional `personaSlug` field that references `outreach_personas.slug`:

```prisma
model ContentSnip {
  // ...
  personaSlug      String? // References outreach_personas.slug
  bestUsedWhen     String? // Additional context: "reconnecting after long time"
}
```

**Usage:** When assembling templates, the snippet assembly service (`snippetAssemblyService.js`) uses `personaSlug` to match snippets to contacts:
- If a contact has `outreachPersonaSlug = "FormerColleagueNowReachingoutAgainAfterLongTime"`
- And a snippet has `personaSlug = "FormerColleagueNowReachingoutAgainAfterLongTime"`
- That snippet will be **preferred** when building templates for that contact

**Matching logic:**
1. **Exact match** - Prefer snippets where `personaSlug` matches contact's `outreachPersonaSlug`
2. **General fallback** - Use snippets with no `personaSlug` (general-purpose snippets)
3. **Any snippet** - If no matches, use first available snippet

### 3. **Best Used When**

The `bestUsedWhen` field on ContentSnip provides additional context beyond persona matching:
- `personaSlug` = "FormerColleagueNowReachingoutAgainAfterLongTime"
- `bestUsedWhen` = "reconnecting after 6+ months" or "when you have prior context"

This helps with:
- **Documentation** - Explains when to use the snippet
- **Future AI matching** - Could be used for more nuanced matching
- **Manual selection** - Helps users choose snippets manually

---

## AI-Generated Persona Suggestions from Contact Notes

### Overview

Use AI to analyze contact notes and automatically suggest appropriate outreach personas. The system extracts key relationship information and recommends the best persona match.

### Information Extraction

When analyzing a contact note, the AI extracts:

1. **Former Company** - Previous company/organization the contact worked with
2. **Primary Work** - Type of work/services provided (e.g., "NDA work", "contract review", "compliance")
3. **Relationship Quality** - Nature of the relationship (e.g., "great relationship", "positive", "neutral", "challenging")
4. **Opportunity Type** - Client's desire or potential for:
   - Referrals/recommendations
   - Repeat business
   - Introductions
   - Partnership opportunities
   - Other business development activities

### Example Contact Note Analysis

**Input Note:**
```
Did NDA work for him for Ares Infrastructure and we had a great relationship; may be opportunities for him to recommend my firm to clients that want to save on NDA work.
```

**Extracted Information:**
- **Former Company:** Ares Infrastructure
- **Primary Work:** NDA work
- **Relationship Quality:** Great relationship
- **Opportunity Type:** Referral/recommendation opportunities (client wants to recommend firm to others)

**Suggested Persona:** `FormerClientReferralOpportunity` or similar persona that captures:
- Past client relationship
- Positive relationship history
- Referral/recommendation potential

### Persona Suggestion Logic

The AI analyzes the extracted information to suggest personas based on:

1. **Relationship Type**
   - Former client → `FormerClient*` personas
   - Former colleague → `FormerColleague*` personas
   - Current client → `CurrentClient*` personas
   - Competitor → `CompetitorSwitchingProspect`

2. **Relationship Quality**
   - Positive/great relationship → Opportunities for referrals, repeat business
   - Neutral → Standard follow-up personas
   - Challenging → May need different approach

3. **Opportunity Signals**
   - Referral mentions → `*ReferralOpportunity` personas
   - Repeat business potential → `*RepeatBusiness` personas
   - Partnership mentions → `*PartnershipOpportunity` personas
   - No clear opportunity → Standard relationship personas

### Implementation

**API Endpoint:**
- **POST** `/api/contacts/[id]/suggest-persona` - Analyze contact notes and suggest persona
  - Input: `{ note: string }`
  - Output: `{ suggestedPersonaSlug: string, confidence: number, extractedInfo: { formerCompany?, primaryWork?, relationshipQuality?, opportunityType? } }`

**UI Integration:**
- **Contact edit/view pages** - "Generate Persona from Notes" button
  - Analyzes existing notes or allows input of new note
  - Displays suggested persona with confidence score
  - Shows extracted information for review
  - One-click to apply suggested persona

**Workflow:**
1. User views/edits contact
2. Clicks "Generate Persona from Notes" or "Suggest Persona"
3. System analyzes contact notes (or prompts for note input)
4. AI extracts key information and suggests persona
5. User reviews suggestion and extracted info
6. User accepts or manually selects different persona

### Example Persona Suggestions

Based on note patterns, common suggestions:

| Note Pattern | Suggested Persona |
|--------------|-------------------|
| "Did [work] for [company], great relationship, may recommend" | `FormerClientReferralOpportunity` |
| "Former colleague at [company], haven't talked in years" | `FormerColleagueNowReachingoutAgainAfterLongTime` |
| "Currently at [competitor], interested in switching" | `CompetitorSwitchingProspect` |
| "Previous client, may need more [work type]" | `FormerClientRepeatBusiness` |
| "Met at [event], potential partnership" | `NewContactPartnershipOpportunity` |

### Best Practices

1. **Review suggestions** - AI suggestions are recommendations; always review extracted info before applying
2. **Update notes** - Keep contact notes detailed and up-to-date for better AI analysis
3. **Refine personas** - If AI frequently suggests similar patterns, consider creating new personas
4. **Manual override** - Users can always manually select a different persona if the suggestion doesn't fit
5. **Confidence scores** - Use confidence scores to identify when manual review is especially important

---

## API Endpoints

### Outreach Personas

- **GET** `/api/outreach-personas` - List all outreach personas
- **POST** `/api/outreach-personas` - Create new persona (`{ slug, name, description? }`)
- **GET** `/api/outreach-personas/[slug]` - Get specific persona
- **PUT** `/api/outreach-personas/[slug]` - Update persona
- **DELETE** `/api/outreach-personas/[slug]` - Delete persona

### ContentSnips (with persona matching)

- **GET** `/api/outreach/content-snips?companyHQId=xxx` - List snippets (includes `personaSlug`, `bestUsedWhen`)
- **POST** `/api/outreach/content-snips` - Create snippet with optional `personaSlug` and `bestUsedWhen`
- **GET** `/api/outreach/content-snips/hydrate?companyHQId=xxx` - Get hydrated snippet map for template resolution

### AI Persona Suggestions

- **POST** `/api/contacts/[id]/suggest-persona` - Analyze contact notes and suggest persona
  - Request body: `{ note?: string }` (optional - uses existing notes if not provided)
  - Response: `{ suggestedPersonaSlug: string, confidence: number, extractedInfo: { formerCompany?, primaryWork?, relationshipQuality?, opportunityType? }, reasoning: string }`

---

## UI Locations

### Managing Outreach Personas
- **`/personas`** - Full personas page (includes both `personas` and `outreach_personas`)
- Uses `/api/outreach-personas` to list/create/edit outreach personas

### Using Personas with ContentSnips
- **`/content-snips`** - Content snippets page
  - Form includes **"Persona slug"** field (optional dropdown or text input)
  - Form includes **"Best used when"** field (optional text)
  - Table shows separate **"Persona"** and **"Best used when"** columns

### Assigning Personas to Contacts
- **Contact edit/view pages** - Can assign `outreachPersonaSlug` to contacts
  - **"Generate Persona from Notes"** button - AI analyzes notes and suggests persona
  - Shows suggested persona with confidence score and extracted information
  - One-click to apply suggested persona or manual override
- Used by template assembly to match snippets to contacts

---

## Relationship to Full Personas (`personas`)

**Important distinction:**

| Feature | `outreach_personas` | `personas` |
|---------|---------------------|------------|
| **Scope** | Global | Company-scoped |
| **Purpose** | Relationship context, outreach matching | BD intelligence, product fit |
| **Complexity** | Simple (slug, name, description) | Complex (title, industry, pain points, BD scores, etc.) |
| **Used for** | Contact classification, snippet matching | Product fit analysis, BD strategy |
| **API** | `/api/outreach-personas` | `/api/personas/*` |

**They are separate systems:**
- `outreach_personas` = "What kind of relationship/context is this contact?"
- `personas` = "What is this person's BD profile, product fit, and strategy?"

ContentSnip's `personaSlug` references **`outreach_personas`**, not the full `personas` model.

---

## Best Practices

### Creating Outreach Personas

1. **Use descriptive slugs** - `FormerColleagueNowReachingoutAgainAfterLongTime` is better than `colleague1`
2. **Keep it simple** - Focus on relationship context, not complex BD intelligence
3. **Make them reusable** - Global personas should work across companies
4. **Name clearly** - Display name should be human-readable: "Former Colleague - Long Time"

### Using Personas with ContentSnips

1. **Tag snippets appropriately** - Set `personaSlug` when a snippet is optimized for a specific relationship type
2. **Leave general snippets untagged** - Snippets that work for any persona should have `personaSlug = null`
3. **Use `bestUsedWhen` for context** - Add guidance like "when reconnecting after 6+ months" or "for competitor switching scenarios"
4. **Test matching** - Verify snippet assembly selects the right snippets for contacts with different personas

### Workflow

1. **Create outreach personas** - Define relationship types you commonly encounter
2. **Assign to contacts** - Tag contacts with appropriate `outreachPersonaSlug`
3. **Tag snippets** - Set `personaSlug` on ContentSnips that are optimized for specific personas
4. **Assembly works automatically** - Template assembly will prefer persona-matched snippets

---

## Code References

- **Schema:** `prisma/schema.prisma` - `outreach_personas` model (line ~1339)
- **ContentSnip:** `prisma/schema.prisma` - `ContentSnip.personaSlug` field (line ~1359)
- **Contact:** `prisma/schema.prisma` - `Contact.outreachPersonaSlug` field (line ~545)
- **API:** `app/api/outreach-personas/route.js`
- **API:** `app/api/contacts/[id]/suggest-persona/route.js` - AI persona suggestion endpoint
- **Service:** `lib/services/personaSuggestionService.js` - AI analysis and persona matching logic
- **Assembly:** `lib/services/snippetAssemblyService.js` - `selectBestMatch()` function uses `personaSlug`
- **UI:** `app/(authenticated)/content-snips/page.jsx` - Form and table for persona fields
- **UI:** `app/(authenticated)/personas/page.jsx` - Management page for personas
- **UI:** `app/(authenticated)/contacts/[id]/edit/page.jsx` - Contact edit page with persona suggestion feature

---

## Summary

**Yes, ContentSnip's `personaSlug` is an "outreach persona helper"** - it's a simple string reference to `outreach_personas.slug` that helps match snippets to contacts based on relationship context. This is separate from the full `personas` system used for BD intelligence and product fit analysis.
