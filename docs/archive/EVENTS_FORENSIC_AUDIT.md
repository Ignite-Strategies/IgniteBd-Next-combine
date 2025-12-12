# Events System - Forensic Audit Report

**Date**: December 2024  
**Method**: Direct code inspection, no assumptions

---

## 🔥 1. INPUT MODEL

### Frontend Request Shape
**File**: `src/app/(authenticated)/events/build-from-persona/page.tsx` (lines 55-63)

```typescript
// What frontend sends to /api/events/recommend
{
  persona: {
    id: string;
    personName?: string;
    title?: string;
    industry?: string;
    location?: string;
  },
  filters: {
    priorityTypes: string[];  // e.g., ["well-known", "well-attended", "bd-exposure"]
    travelPreference: string;  // "anywhere" | "domestic" | "major-hubs" | "near-me"
    budgetPreference: string;  // "budget" | "standard" | "premium"
  },
  userRegion: string | null;  // Currently always null (not used)
}
```

### TypeScript Interface
**File**: `src/types/events.ts` (lines 26-36)

```typescript
export interface EventRecommendationRequest {
  persona: any;  // ⚠️ LOOSE TYPE - any
  filters: {
    priorityTypes: string[];  // ["well-known", "well-attended", ...]
    regionPreference?: string;  // ⚠️ NOT USED by frontend
    travelPreference?: string;
    budgetPreference?: string;
  };
  userRegion?: string | null;
  count?: number; // default 6
}
```

### Storage Location
- **Persona**: React state (`selectedPersona`) - loaded from `/api/personas?companyHQId=xxx`
- **Filters**: React state (`priorityFilters`, `travelPreference`, `budgetPreference`)
- **userRegion**: React state (always `null` - not populated)
- **No localStorage persistence**
- **No Redis caching**

### Required vs Optional
- ✅ **Required**: `persona` (validated in frontend)
- ✅ **Required**: `filters.priorityTypes` (must have at least 1, validated in frontend)
- ⚠️ **Optional**: `filters.travelPreference` (defaults to "anywhere")
- ⚠️ **Optional**: `filters.budgetPreference` (defaults to "standard")
- ⚠️ **Optional**: `userRegion` (always null)
- ⚠️ **Optional**: `count` (defaults to 6)

---

## 🔥 2. EventPlannerService (AI Call)

### OpenAI Prompt (Verbatim)
**File**: `src/lib/services/EventPlannerService.ts` (lines 45-105)

```
You are an event intelligence planner. Generate 6 real, specific event recommendations for business development purposes.

Persona:
- Title: ${persona.title || persona.personName || 'Not specified'}
- Industry: ${persona.industry || 'Not specified'}
- Location: ${persona.location || 'Not specified'}
- Description: ${persona.description || 'Not specified'}
- Pain Points: ${Array.isArray(persona.painPoints) ? persona.painPoints.join(', ') : persona.painPoints || 'Not specified'}
- Goals: ${persona.whatTheyWant || 'Not specified'}

User Region: ${userRegion || 'Not specified'}

Priority Filters:
${priorityFilters.length > 0 ? priorityFilters.map(p => `- ${p}`).join('\n') : '- None specified'}

Travel Preference: ${travelPref}
Budget Preference: ${budgetPref}

Requirements:
1. Return EXACTLY 6 events
2. All events must be REAL, specific events (not generic types)
3. Use multiple producer types (Association, Commercial, Media, Institution, Corporate)
4. Each event must have:
   - name: Full event name
   - producerType: One of "Association", "Commercial", "Media", "Institution", "Corporate"
   - organization: Organizer name
   - location: City, State/Country or null
   - dateRange: "Q1 2025", "March 2025", "TBD", etc. or null
   - wellKnownScore: 1-10 (how well-known is this event)
   - attendanceScore: 1-10 (expected attendance level)
   - bdValueScore: 1-10 (business development value for this persona)
   - travelFitScore: 1-10 (how well does travel fit user's region/preference)
   - costScore: 1-10 (cost-effectiveness, higher = more cost-effective)
   - totalScore: Sum of all 5 scores above
   - relevanceReason: 2-3 sentence explanation of why this event fits
   - url: Event website URL if available (optional)

5. Apply scoring logic based on priority filters:
   - If "well-known" is selected, prioritize higher wellKnownScore
   - If "well-attended" is selected, prioritize higher attendanceScore
   - If "bd-exposure" is selected, prioritize higher bdValueScore
   - If "local-travel" is selected, prioritize higher travelFitScore
   - If "cost-effective" is selected, prioritize higher costScore
   - If "allocator-density" is selected, prioritize events with high allocator attendance
   - If "gp-density" is selected, prioritize events with high GP/dealflow attendance

6. Travel fit scoring:
   - If userRegion is provided and travelPreference is "near-me", prioritize events in/near that region
   - If travelPreference is "domestic", only include US events
   - If travelPreference is "major-hubs", prioritize major cities
   - If travelPreference is "anywhere", no geographic restrictions

7. Budget scoring:
   - "budget": Prioritize free/low-cost events (higher costScore)
   - "standard": Standard pricing events
   - "premium": High-end events (may have lower costScore but higher other scores)

Return ONLY a valid JSON object with this structure:
{
  "events": [
    { /* event 1 */ },
    { /* event 2 */ },
    ...
  ]
}

The "events" array must contain exactly 6 event objects. No markdown, no code blocks, just the JSON object.
```

### System Prompt
**File**: `src/lib/services/EventPlannerService.ts` (lines 140-141)

```
You are an expert event intelligence planner. Return only valid JSON. Return a JSON object with an "events" key containing an array of 6 event objects. No markdown, no code blocks.
```

### Expected AI JSON Schema
**From Prompt Requirements** (lines 62-74):

```json
{
  "events": [
    {
      "name": "string",
      "producerType": "Association" | "Commercial" | "Media" | "Institution" | "Corporate",
      "organization": "string",
      "location": "string | null",
      "dateRange": "string | null",
      "wellKnownScore": 1-10,
      "attendanceScore": 1-10,
      "bdValueScore": 1-10,
      "travelFitScore": 1-10,
      "costScore": 1-10,
      "totalScore": number,  // Sum of 5 scores
      "relevanceReason": "string",
      "url": "string | undefined"
    }
  ]
}
```

### Scoring Logic in Prompt
**AI is instructed to generate**:
- **5 sub-scores** (1-10 each): `wellKnownScore`, `attendanceScore`, `bdValueScore`, `travelFitScore`, `costScore`
- **1 total score**: `totalScore` = sum of all 5 sub-scores (AI calculates this)
- **Scoring is done by AI** based on priority filters and persona context

### Post-Processing After AI Returns
**File**: `src/lib/services/EventPlannerService.ts` (lines 183-211)

1. **Parse JSON** (handles markdown code blocks if present)
2. **Extract events array** (handles `events`, `data`, or direct array)
3. **Validate & Normalize** each event:
   ```typescript
   const validated: EventSuggestion = {
     name: event.name || `Event ${index + 1}`,
     producerType: (event.producerType || 'Commercial') as EventProducerType,
     organization: event.organization || 'Unknown',
     location: event.location || null,
     dateRange: event.dateRange || null,
     wellKnownScore: Math.max(1, Math.min(10, Number(event.wellKnownScore) || 5)),
     attendanceScore: Math.max(1, Math.min(10, Number(event.attendanceScore) || 5)),
     bdValueScore: Math.max(1, Math.min(10, Number(event.bdValueScore) || 5)),
     travelFitScore: Math.max(1, Math.min(10, Number(event.travelFitScore) || 5)),
     costScore: Math.max(1, Math.min(10, Number(event.costScore) || 5)),
     totalScore: 0, // Will calculate below
     relevanceReason: event.relevanceReason || 'Event recommendation based on persona and filters',
     url: event.url || undefined,
   };
   ```
4. **Recalculate totalScore** (backend overrides AI calculation):
   ```typescript
   validated.totalScore =
     validated.wellKnownScore +
     validated.attendanceScore +
     validated.bdValueScore +
     validated.travelFitScore +
     validated.costScore;
   ```
5. **Fill to 6 events** if AI returns fewer (creates placeholder events with score 25)

### Key Findings
- ✅ AI generates **5 sub-scores** (1-10 each)
- ✅ AI calculates `totalScore` (sum)
- ✅ Backend **recalculates** `totalScore` (overrides AI)
- ✅ Backend **clamps** all scores to 1-10 range
- ✅ Backend **fills missing events** with placeholders

---

## 🔥 3. AI OUTPUT MODEL

### Legacy Type (ACTUALLY USED)
**File**: `src/types/events.ts` (lines 8-24)

```typescript
export interface EventSuggestion {
  name: string;
  producerType: EventProducerType;  // "Association" | "Commercial" | "Media" | "Institution" | "Corporate"
  organization: string;
  location: string | null;
  dateRange: string | null;

  wellKnownScore: number;       // 1–10
  attendanceScore: number;      // 1–10
  bdValueScore: number;         // 1–10
  travelFitScore: number;       // 1–10
  costScore: number;            // 1–10

  totalScore: number;           // sum of above (max 50)
  relevanceReason: string;
  url?: string;
}
```

**This is the type returned by `EventPlannerService.generateEventRecommendations()`**  
**This is the type imported in the frontend** (`import type { EventSuggestion } from '@/types/events'`)

### New Structured Type (NOT USED)
**File**: `src/lib/types/EventSuggestion.ts` (lines 1-27)

```typescript
export interface EventCost {
  min: number | null;
  max: number | null;
  currency: "USD";
}

export interface EventSuggestion {
  id: string;

  eventName: string;
  eventSeriesName: string | null;

  organizerName: string;
  producerType: "Commercial" | "Association" | "Media" | "Institution" | "Corporate";

  city: string;
  stateOrRegion: string | null;

  startDate: string | null;
  endDate: string | null;

  cost: EventCost;

  personaAlignment: number;   // 0–100

  url?: string;
}
```

### Differences

| Field | Legacy (USED) | Structured (UNUSED) |
|-------|--------------|---------------------|
| Event Name | `name` | `eventName` |
| Series | ❌ None | `eventSeriesName` |
| Organizer | `organization` | `organizerName` |
| Location | `location` (string) | `city` + `stateOrRegion` |
| Date | `dateRange` (string) | `startDate` + `endDate` |
| Cost | ❌ None | `cost: { min, max, currency }` |
| Scoring | 5 sub-scores + `totalScore` | `personaAlignment` (0-100) |
| ID | ❌ None | `id` (required) |

### Which One UI Consumes?
**✅ UI consumes LEGACY type** (`src/types/events.ts`)

**Evidence**:
- `src/app/(authenticated)/events/build-from-persona/page.tsx` line 9: `import type { EventSuggestion } from '@/types/events';`
- `EventRecommendationsList.tsx` line 6: `import type { EventSuggestion } from '@/types/events';`
- UI reads: `event.name`, `event.organization`, `event.wellKnownScore`, etc.

---

## 🔥 4. UI Rendering Model

### Component Props Interface
**File**: `src/app/(authenticated)/events/build-from-persona/EventRecommendationsList.tsx` (lines 8-11)

```typescript
interface EventRecommendationsListProps {
  events: EventSuggestion[];  // From '@/types/events'
  personaId?: string | null;
}
```

### Properties UI Cards Read
**File**: `EventRecommendationsList.tsx` (lines 76-134)

**Exact fields accessed**:
1. `event.name` (line 76) - Event title
2. `event.producerType` (line 80) - Badge display
3. `event.organization` (line 86) - Subtitle
4. `event.location` (line 92) - Location display
5. `event.dateRange` (line 93) - Date display
6. `event.totalScore` (line 101) - Main score display
7. `event.wellKnownScore` (line 111) - Sub-score
8. `event.attendanceScore` (line 115) - Sub-score
9. `event.bdValueScore` (line 119) - Sub-score
10. `event.travelFitScore` (line 123) - Sub-score
11. `event.costScore` (line 127) - Sub-score
12. `event.relevanceReason` (line 133) - Explanation text
13. `event.url` (line 138) - External link

### Score Format Expected
**UI expects**:
- ✅ **5 sub-scores** (1-10 each): `wellKnownScore`, `attendanceScore`, `bdValueScore`, `travelFitScore`, `costScore`
- ✅ **1 total score**: `totalScore` (sum, max 50)
- ❌ **NOT** `personaAlignment` (0-100)

**Evidence**: Lines 108-129 show all 5 sub-scores displayed, plus `totalScore` on line 101.

---

## 🔥 5. SAVE PIPELINE

### Save Route Input
**File**: `src/app/api/events/save/route.ts` (line 17)

```typescript
const { eventSuggestion, userId } = await req.json();
```

**What frontend sends**:
**File**: `EventRecommendationsList.tsx` (lines 23-27)

```typescript
const response = await api.post('/api/events/save', {
  eventSuggestion: event,  // ⚠️ Legacy EventSuggestion type
  userId,
  personaId: personaId || null,  // ⚠️ NOT USED by save service
});
```

### Save Service Validation
**File**: `src/lib/services/EventUpsertService.ts` (lines 4-6)

```typescript
export async function saveEvent(eventSuggestion: any, userId: string) {
  // 1. Validate + parse + normalize AI result
  const parsed = EventSuggestionSchema.parse(eventSuggestion);
```

### Zod Schema (What Save Expects)
**File**: `src/lib/schemas/EventSuggestionSchema.ts`

```typescript
export const EventSuggestionSchema = z.object({
  id: z.string(),  // ⚠️ REQUIRED but legacy type doesn't have it

  eventName: z.string(),  // ⚠️ Legacy has "name"
  eventSeriesName: z.string().nullable(),  // ⚠️ Legacy doesn't have this

  organizerName: z.string(),  // ⚠️ Legacy has "organization"
  producerType: z.enum(["Commercial", "Association", "Media", "Institution", "Corporate"]),

  city: z.string(),  // ⚠️ Legacy has "location" (full string)
  stateOrRegion: z.string().nullable(),  // ⚠️ Legacy doesn't have this

  startDate: z.string().nullable(),  // ⚠️ Legacy has "dateRange" (single string)
  endDate: z.string().nullable(),  // ⚠️ Legacy doesn't have this

  cost: z.object({  // ⚠️ Legacy doesn't have cost
    min: z.number().nullable(),
    max: z.number().nullable(),
    currency: z.literal("USD"),
  }),

  personaAlignment: z.number().min(0).max(100),  // ⚠️ Legacy has 5 sub-scores, not this

  url: z.string().url().optional(),
});
```

### Prisma Model (What Gets Saved)
**File**: `prisma/schema.prisma` (lines 1034-1062)

```prisma
model SavedEvent {
  id              String   @id @default(cuid())
  userId          String

  eventName       String
  eventSeriesName String?
  organizerName   String
  producerType    String

  city            String
  stateOrRegion   String?

  startDate       String?
  endDate         String?

  costMin         Int?
  costMax         Int?
  currency        String

  personaAlignment Int

  url             String?

  rawJson         Json
  createdAt       DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
  @@map("saved_events")
}
```

### Save Service Mapping
**File**: `EventUpsertService.ts` (lines 8-32)

```typescript
const saved = await prisma.savedEvent.create({
  data: {
    userId,

    eventName: parsed.eventName,  // ⚠️ Frontend sends "name"
    eventSeriesName: parsed.eventSeriesName,  // ⚠️ Frontend doesn't send this
    organizerName: parsed.organizerName,  // ⚠️ Frontend sends "organization"
    producerType: parsed.producerType,

    city: parsed.city,  // ⚠️ Frontend sends "location" (full string)
    stateOrRegion: parsed.stateOrRegion,  // ⚠️ Frontend doesn't send this

    startDate: parsed.startDate,  // ⚠️ Frontend sends "dateRange"
    endDate: parsed.endDate,  // ⚠️ Frontend doesn't send this

    costMin: parsed.cost.min,  // ⚠️ Frontend doesn't send cost
    costMax: parsed.cost.max,  // ⚠️ Frontend doesn't send cost
    currency: parsed.cost.currency,  // ⚠️ Frontend doesn't send cost

    personaAlignment: parsed.personaAlignment,  // ⚠️ Frontend sends 5 sub-scores, not this

    url: parsed.url ?? null,

    rawJson: parsed,  // Stores whatever was validated
  },
});
```

### Critical Finding: SAVE WILL FAIL
**The save pipeline expects**:
- `id` (required) - ❌ Legacy type doesn't have it
- `eventName` - ❌ Legacy type has `name`
- `organizerName` - ❌ Legacy type has `organization`
- `city` + `stateOrRegion` - ❌ Legacy type has `location` (single string)
- `startDate` + `endDate` - ❌ Legacy type has `dateRange` (single string)
- `cost: { min, max, currency }` - ❌ Legacy type doesn't have cost
- `personaAlignment` (0-100) - ❌ Legacy type has 5 sub-scores

**Result**: Zod validation will **reject** the legacy format → Save fails with validation error.

---

## 🔥 6. Model Comparison Table

| Field | (A) Input | (B) AI Output (Legacy) | (C) UI Card | (D) Structured | (E) SavedEvent DB |
|-------|-----------|----------------------|-------------|----------------|-------------------|
| **Event Name** | ❌ | `name` | ✅ `event.name` | `eventName` | `eventName` |
| **Series Name** | ❌ | ❌ | ❌ | `eventSeriesName?` | `eventSeriesName?` |
| **Organizer** | ❌ | `organization` | ✅ `event.organization` | `organizerName` | `organizerName` |
| **Producer Type** | ❌ | `producerType` | ✅ `event.producerType` | `producerType` | `producerType` |
| **Location** | ❌ | `location` (string) | ✅ `event.location` | `city` + `stateOrRegion?` | `city` + `stateOrRegion?` |
| **Date** | ❌ | `dateRange` (string) | ✅ `event.dateRange` | `startDate?` + `endDate?` | `startDate?` + `endDate?` |
| **Cost** | ❌ | ❌ | ❌ | `cost: { min?, max?, currency }` | `costMin?` + `costMax?` + `currency` |
| **Scoring** | ❌ | 5 sub-scores + `totalScore` | ✅ 5 sub-scores + `totalScore` | `personaAlignment` (0-100) | `personaAlignment` (Int) |
| **ID** | ❌ | ❌ | ❌ | `id` (required) | `id` (auto) |
| **URL** | ❌ | `url?` | ✅ `event.url` | `url?` | `url?` |
| **Reason** | ❌ | `relevanceReason` | ✅ `event.relevanceReason` | ❌ | ❌ (in `rawJson`) |

### Mismatches

**🔴 CRITICAL MISMATCHES**:

1. **Field Name Mismatches**:
   - Legacy: `name` → Structured: `eventName` → DB: `eventName`
   - Legacy: `organization` → Structured: `organizerName` → DB: `organizerName`
   - Legacy: `location` → Structured: `city` + `stateOrRegion` → DB: `city` + `stateOrRegion`
   - Legacy: `dateRange` → Structured: `startDate` + `endDate` → DB: `startDate` + `endDate`

2. **Scoring System Mismatch**:
   - Legacy: 5 sub-scores (1-10) + `totalScore` (sum, max 50)
   - Structured: `personaAlignment` (0-100)
   - **No mapping between systems**

3. **Missing Fields**:
   - Legacy → Structured: Missing `id` (required), `eventSeriesName`, `cost`, `personaAlignment`
   - Structured → Legacy: Missing `relevanceReason`, all 5 sub-scores

4. **Save Pipeline Broken**:
   - Frontend sends Legacy format
   - Save service expects Structured format
   - **Zod validation will fail**

---

## 🔥 7. THE SINGLE SOURCE OF TRUTH

### The REAL Input Model
```typescript
// What frontend actually sends
{
  persona: {
    id: string;
    personName?: string;
    title?: string;
    industry?: string;
    location?: string;
  },
  filters: {
    priorityTypes: string[];  // ["well-known", "well-attended", ...]
    travelPreference: string;  // "anywhere" | "domestic" | "major-hubs" | "near-me"
    budgetPreference: string;  // "budget" | "standard" | "premium"
  },
  userRegion: string | null;  // Always null
}
```

### The REAL AI Scoring Model
```typescript
// What AI actually returns (after normalization)
{
  name: string;
  producerType: "Association" | "Commercial" | "Media" | "Institution" | "Corporate";
  organization: string;
  location: string | null;
  dateRange: string | null;
  wellKnownScore: number;      // 1-10
  attendanceScore: number;     // 1-10
  bdValueScore: number;        // 1-10
  travelFitScore: number;      // 1-10
  costScore: number;           // 1-10
  totalScore: number;          // Sum of 5 scores (max 50)
  relevanceReason: string;
  url?: string;
}
```

### The REAL UI Expected Shape
**Same as AI Output Model** (legacy type from `src/types/events.ts`)

UI reads all fields from legacy model, displays all 5 sub-scores + totalScore.

### The REAL Save Model
```typescript
// What save service expects (but never receives)
{
  id: string;  // ⚠️ REQUIRED but not in legacy
  eventName: string;  // ⚠️ Legacy has "name"
  eventSeriesName: string | null;
  organizerName: string;  // ⚠️ Legacy has "organization"
  producerType: "Commercial" | "Association" | "Media" | "Institution" | "Corporate";
  city: string;  // ⚠️ Legacy has "location" (full string)
  stateOrRegion: string | null;
  startDate: string | null;  // ⚠️ Legacy has "dateRange"
  endDate: string | null;
  cost: { min: number | null; max: number | null; currency: "USD" };  // ⚠️ Legacy doesn't have
  personaAlignment: number;  // ⚠️ Legacy has 5 sub-scores, not this
  url?: string;
}
```

### The Missing Mapping Layer
**There is NO transformation between**:
- Legacy AI output → Structured save format

**What needs to exist**:
```typescript
function transformLegacyToStructured(legacy: LegacyEventSuggestion): StructuredEventSuggestion {
  // Map name → eventName
  // Map organization → organizerName
  // Parse location → city + stateOrRegion
  // Parse dateRange → startDate + endDate
  // Calculate personaAlignment from 5 sub-scores
  // Generate id
  // Extract cost from relevanceReason? (not possible)
}
```

### The Exact Reason Scoring "Magic" Works
**It doesn't work for saving.**

**Scoring works for display because**:
1. AI generates 5 sub-scores (1-10 each)
2. Backend recalculates `totalScore` (sum)
3. UI displays all 5 sub-scores + totalScore
4. **All using the same legacy type**

**Scoring breaks for saving because**:
1. Legacy type has 5 sub-scores
2. Save service expects `personaAlignment` (0-100)
3. **No mapping exists**
4. **Zod validation fails**

### The Model That MUST Become © The Universal Event Model

**The Universal Event Model must**:
1. ✅ Support **both** scoring systems (5 sub-scores AND personaAlignment)
2. ✅ Support **both** field naming conventions (name/eventName, organization/organizerName)
3. ✅ Support **both** location formats (single string AND city+region)
4. ✅ Support **both** date formats (dateRange AND startDate+endDate)
5. ✅ Include **cost** information
6. ✅ Include **relevanceReason** (AI explanation)
7. ✅ Include **id** for persistence
8. ✅ Be **backward compatible** with legacy type
9. ✅ Be **forward compatible** with structured type

**Proposed Universal Model**:
```typescript
interface UniversalEventSuggestion {
  // Identity
  id?: string;  // Optional for new events, required for saved
  
  // Event Info (support both naming)
  name: string;  // Primary
  eventName?: string;  // Alias (maps to name)
  eventSeriesName?: string | null;
  
  // Organizer (support both naming)
  organization: string;  // Primary
  organizerName?: string;  // Alias (maps to organization)
  
  producerType: "Commercial" | "Association" | "Media" | "Institution" | "Corporate";
  
  // Location (support both formats)
  location?: string | null;  // Legacy: full string
  city?: string;  // Structured: parsed
  stateOrRegion?: string | null;  // Structured: parsed
  
  // Date (support both formats)
  dateRange?: string | null;  // Legacy: "Q1 2025", "March 2025"
  startDate?: string | null;  // Structured: ISO date
  endDate?: string | null;  // Structured: ISO date
  
  // Cost
  cost?: {
    min: number | null;
    max: number | null;
    currency: "USD";
  };
  
  // Scoring (support both systems)
  // Legacy scoring (5 sub-scores)
  wellKnownScore?: number;  // 1-10
  attendanceScore?: number;  // 1-10
  bdValueScore?: number;  // 1-10
  travelFitScore?: number;  // 1-10
  costScore?: number;  // 1-10
  totalScore?: number;  // Sum (max 50)
  
  // Structured scoring
  personaAlignment?: number;  // 0-100
  
  // Metadata
  relevanceReason?: string;  // AI explanation
  url?: string;
}
```

**This model can**:
- Accept legacy format (from AI)
- Accept structured format (from save)
- Display in UI (all fields available)
- Save to database (all fields mappable)
- Transform between formats seamlessly

---

## Summary

**Current State**: Save pipeline is **BROKEN** due to type mismatch. Frontend sends legacy format, save service expects structured format. Zod validation will fail.

**Root Cause**: Two parallel type systems (legacy and structured) with no transformation layer.

**Solution**: Create Universal Event Model that supports both formats, with transformation functions to map between them.

