# Events & Event Intelligence - Comprehensive Audit

**Date**: December 2024  
**Purpose**: Diagnostic analysis of current Events/Event Intelligence implementation before refactor

---

## 1. Repo Files Found

### Frontend Routes & Pages
- `src/app/(authenticated)/events/page.tsx` - Events index page
- `src/app/(authenticated)/events/build-from-persona/page.tsx` - Main event recommendation builder
- `src/app/(authenticated)/events/build-from-persona/PersonaSearch.tsx` - Persona selection component
- `src/app/(authenticated)/events/build-from-persona/EventFilters.tsx` - Filter panel component
- `src/app/(authenticated)/events/build-from-persona/EventRecommendationsList.tsx` - Results display component
- `src/app/(authenticated)/builder/event/[eventPlanId]/page.jsx` - EventPlan builder (separate system)

### API Routes
- `src/app/api/events/recommend/route.ts` - Generate event recommendations via OpenAI
- `src/app/api/events/save/route.ts` - Save event recommendations to database
- `src/app/api/artifacts/eventplans/route.js` - CRUD for EventPlan model (separate system)
- `src/app/api/artifacts/eventplans/[id]/route.js` - Individual EventPlan operations

### Services & Business Logic
- `src/lib/services/EventPlannerService.ts` - OpenAI-based recommendation generation
- `src/lib/services/EventUpsertService.ts` - Save/validate event suggestions

### Types & Schemas
- `src/types/events.ts` - Legacy EventSuggestion type (scoring-based)
- `src/lib/types/EventSuggestion.ts` - New EventSuggestion type (structured)
- `src/lib/schemas/EventSuggestionSchema.ts` - Zod validation schema

### Utilities
- `src/lib/utils/eventFormatter.ts` - Date/location/cost formatting helpers

### Parsers
- `src/lib/parsers/configs/events.ts` - Universal parser config for event selection (placeholder)

---

## 2. Current Prisma Models

### SavedEvent Model (Event Intelligence)
**Location**: `prisma/schema.prisma` lines 1034-1062

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

**Purpose**: Stores AI-generated event recommendations that users save  
**Key Fields**:
- `userId` - Links to user who saved (no relation to Owner/Contact)
- `personaAlignment` - 0-100 score (not the same as scoring system)
- `rawJson` - Full event object stored as JSON
- No relation to Persona model (personaId was removed in recent refactor)

### EventPlan Model (Content Artifact - Separate System)
**Location**: `prisma/schema.prisma` lines 757-773

```prisma
model EventPlan {
  id          String    @id @default(cuid())
  companyHQId String
  companyHQ   CompanyHQ @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  eventName   String
  date        DateTime?
  location    String?
  agenda      String?
  description String?
  published   Boolean   @default(false)
  publishedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([companyHQId])
  @@index([published])
  @@map("event_plans")
}
```

**Purpose**: Content artifact for creating/managing event plans (CLE events, etc.)  
**Key Fields**:
- `companyHQId` - Tenant scoping
- `published` - Publishing workflow
- No relation to SavedEvent or event intelligence system

**Domain Naming Analysis**:
- "Event" is **overloaded**:
  1. `SavedEvent` = AI-generated event recommendations (intelligence)
  2. `EventPlan` = Content artifact for event planning (deliverables)
  3. `event` field in `EmailActivity` = email delivery state (unrelated)

---

## 3. Current Server Actions

### EventPlannerService.generateEventRecommendations()
**File**: `src/lib/services/EventPlannerService.ts`

**Input**: `EventRecommendationRequest`
```typescript
{
  persona: any;  // Raw persona object
  filters: {
    priorityTypes: string[];  // ["well-known", "well-attended", ...]
    regionPreference?: string;
    travelPreference?: string;
    budgetPreference?: string;
  };
  userRegion?: string | null;
  count?: number; // default 6
}
```

**Output**: `EventSuggestion[]` (legacy type with scoring)

**What it does**:
1. Validates persona and filters
2. Builds OpenAI prompt with persona context and filter preferences
3. Calls OpenAI GPT-4o with JSON response format
4. Parses and validates response (handles markdown code blocks)
5. Normalizes events to ensure exactly 6 results
6. Calculates `totalScore` as sum of 5 sub-scores

**Scoring System**:
- `wellKnownScore`: 1-10 (how well-known is event)
- `attendanceScore`: 1-10 (expected attendance)
- `bdValueScore`: 1-10 (BD value for persona)
- `travelFitScore`: 1-10 (travel fit for user region/preference)
- `costScore`: 1-10 (cost-effectiveness, higher = more cost-effective)
- `totalScore`: Sum of above (max 50)

### EventUpsertService.saveEvent()
**File**: `src/lib/services/EventUpsertService.ts`

**Input**: 
- `eventSuggestion: any` - Event object to save
- `userId: string` - User ID from localStorage/Firebase

**Output**: Prisma `SavedEvent` record

**What it does**:
1. Validates event using `EventSuggestionSchema` (Zod)
2. Maps validated data to Prisma `SavedEvent` model
3. Creates database record with `rawJson` backup

**Note**: Expects new structured format (`eventName`, `organizerName`, etc.) but frontend sends legacy format (`name`, `organization`, etc.) - **TYPE MISMATCH**

---

## 4. Relevant Routes

### `/events` (Index)
**File**: `src/app/(authenticated)/events/page.tsx`

**What it does**:
- Landing page with single "Build from Persona" card
- Routes to `/events/build-from-persona`

**Data**: None (static page)

**Server Actions**: None

**UI Components**: 
- `PageHeader`
- Single card with router navigation

**Missing**: No saved events list, no browse functionality

---

### `/events/build-from-persona` (Main Builder)
**File**: `src/app/(authenticated)/events/build-from-persona/page.tsx`

**What it does**:
- Single-page flow: persona selection → filters → generate → inline results
- No multi-step wizard
- Results appear on same page after generation

**Data Expected**:
- Personas from `/api/personas?companyHQId=xxx`
- User region from localStorage (not currently used)

**Server Actions Called**:
- `GET /api/personas` - Load personas for selection
- `POST /api/events/recommend` - Generate recommendations
- `POST /api/events/save` - Save individual event (from results list)

**UI Components**:
- `PersonaSearch` - Radio button list of personas
- `EventFilters` - Filter panel with priority/travel/budget
- `EventRecommendationsList` - Grid of event cards with save buttons

**State Management**:
- Local React state (no global state)
- Results stored in component state (ephemeral)
- No persistence of search/filter state

**Missing**:
- No quick persona input (removed in recent refactor)
- No saved searches
- No filter presets
- No pagination (always returns 6 events)

---

### `/events/results` (DELETED)
**Status**: ❌ Removed in recent architecture reset

**Previous Behavior**: Separate page that loaded from sessionStorage  
**Current**: Results are inline on `/events/build-from-persona`

---

### `/builder/event/[eventPlanId]` (Separate System)
**File**: `src/app/(authenticated)/builder/event/[eventPlanId]/page.jsx`

**What it does**:
- Builder for `EventPlan` content artifacts
- Part of content hub system (Blogs, Presentations, etc.)
- NOT related to event intelligence/recommendations

**Data**: EventPlan model via `/api/artifacts/eventplans`

**Note**: This is a completely separate domain from event intelligence

---

## 5. Route-by-Route Summary

### `/events`
- **Data**: None
- **Server Actions**: None
- **UI**: Static landing page
- **Missing**: Browse saved events, view recommendations history

### `/events/build-from-persona`
- **Data Expected**: 
  - Personas (from API)
  - User region (from localStorage, not used)
- **Server Actions**:
  - `GET /api/personas` - Load personas
  - `POST /api/events/recommend` - Generate (OpenAI)
  - `POST /api/events/save` - Save event
- **UI Components**:
  - `PersonaSearch` - Persona selection
  - `EventFilters` - Filter configuration
  - `EventRecommendationsList` - Results display with save
- **Missing**:
  - Type mismatch: Frontend sends legacy format, backend expects new format
  - No validation that saved events match recommendation format
  - No error handling for save failures
  - No loading states for persona fetch
  - No empty states for no personas
  - No way to view saved events
  - No way to regenerate with different filters

---

## 6. Current Source of Truth

### Events Storage
**Status**: ✅ **Partially Implemented**

**Where events are stored**:
- `SavedEvent` Prisma model (database)
- `rawJson` field stores full event object

**Where events are NOT stored**:
- No canonical event database/catalog
- No external event API integration
- Events are **ephemeral AI responses** until saved

### Event Generation Flow
1. User selects persona + filters
2. `EventPlannerService` calls OpenAI
3. OpenAI generates 6 events (no database lookup)
4. Events returned as `EventSuggestion[]` (legacy type)
5. Events displayed in UI (ephemeral, in React state)
6. User can save individual events → `SavedEvent` model

### Scoring System
**Status**: ✅ **Implemented but Inconsistent**

**Two Different Scoring Systems**:

1. **AI Generation Scoring** (legacy, in `EventSuggestion`):
   - 5 sub-scores (1-10 each): wellKnown, attendance, bdValue, travelFit, cost
   - `totalScore` = sum (max 50)
   - Used for ranking/relevance in recommendations

2. **Saved Event Scoring** (new, in `SavedEvent`):
   - `personaAlignment` (0-100)
   - Single score, different scale
   - **No mapping between the two systems**

**Gap**: Saved events lose the 5-dimensional scoring when saved

### Type System
**Status**: ⚠️ **Inconsistent - Two Type Definitions**

1. **Legacy Type** (`src/types/events.ts`):
   ```typescript
   interface EventSuggestion {
     name: string;
     organization: string;
     location: string | null;
     dateRange: string | null;
     wellKnownScore: number;  // 1-10
     attendanceScore: number;  // 1-10
     bdValueScore: number;     // 1-10
     travelFitScore: number;   // 1-10
     costScore: number;         // 1-10
     totalScore: number;        // sum
     relevanceReason: string;
     url?: string;
   }
   ```

2. **New Type** (`src/lib/types/EventSuggestion.ts`):
   ```typescript
   interface EventSuggestion {
     id: string;
     eventName: string;
     eventSeriesName: string | null;
     organizerName: string;
     city: string;
     stateOrRegion: string | null;
     startDate: string | null;
     endDate: string | null;
     cost: { min: number | null; max: number | null; currency: "USD" };
     personaAlignment: number;  // 0-100
     url?: string;
   }
   ```

**Problem**: Frontend uses legacy type, save service expects new type → **TYPE MISMATCH**

---

## 7. Cursor's Understanding of Current Architecture

The Events Intelligence system is a **hybrid AI-generation + save pipeline** with architectural inconsistencies. The flow starts with persona-based filtering that generates ephemeral event recommendations via OpenAI (using a 5-dimensional scoring system: well-known, attendance, BD value, travel fit, and cost). These recommendations are displayed inline on a single-page builder (`/events/build-from-persona`) where users can save individual events. However, there's a **critical type mismatch**: the frontend uses a legacy `EventSuggestion` type with scoring fields (`name`, `organization`, `wellKnownScore`, etc.) while the save pipeline expects a new structured type (`eventName`, `organizerName`, `personaAlignment`, etc.). Saved events are persisted to a `SavedEvent` Prisma model with a single `personaAlignment` score (0-100), losing the granular 5-dimensional scoring. The system has no canonical event database—events are purely AI-generated until saved. There's also a separate `EventPlan` model for content artifacts (CLE events) that's completely unrelated to the intelligence system, creating domain naming confusion where "Event" refers to three different concepts.

---

## 8. Gaps / Missing Layers

### Critical Gaps

1. **Type System Inconsistency**
   - Frontend uses legacy `EventSuggestion` (scoring-based)
   - Backend save expects new `EventSuggestion` (structured)
   - **Save functionality likely broken** due to field name mismatch
   - No migration path between types

2. **No Canonical Event Source**
   - Events are ephemeral AI responses
   - No event database/catalog
   - No external event API integration
   - No way to verify if events are real/current

3. **Scoring System Loss**
   - 5-dimensional scoring (wellKnown, attendance, bdValue, travelFit, cost) lost on save
   - Saved events only have `personaAlignment` (0-100)
   - No way to filter/sort saved events by original scores
   - No mapping between AI scores and saved alignment score

4. **Missing Save Pipeline Validation**
   - `EventUpsertService` expects structured format
   - Frontend sends legacy format
   - No transformation layer
   - Save likely fails silently or with errors

5. **No Persona Relation**
   - `SavedEvent` has no `personaId` (removed in recent refactor)
   - Can't query "events saved for this persona"
   - Can't track persona → event relationships

### Architectural Gaps

6. **No Event Intelligence Model**
   - No model for BD-specific event intelligence
   - No allocator density tracking
   - No GP/dealflow density metrics
   - No historical recommendation tracking

7. **No Recommendation History**
   - Can't see past recommendations
   - Can't regenerate with same filters
   - No A/B testing of filter combinations
   - No learning from user saves

8. **Loose Type Boundaries**
   - `any` types in `EventRecommendationRequest.persona`
   - No validation of persona structure
   - No type safety in filter options
   - String-based filter IDs (no enums)

9. **Missing Route Boundaries**
   - No saved events list page
   - No event detail page
   - No way to browse saved events
   - No way to delete saved events
   - No way to edit saved events

10. **No Data Persistence for Recommendations**
    - Recommendations only in React state
    - Lost on page refresh
    - No way to share recommendations
    - No way to export recommendations

11. **Incomplete Filter System**
    - Filter options hardcoded in component
    - No filter presets
    - No saved filter combinations
    - No filter validation

12. **No Error Recovery**
    - No retry logic for OpenAI failures
    - No fallback events
    - No partial results handling
    - No user feedback for generation failures

13. **Missing User Context**
    - `userId` from localStorage (unreliable)
    - No relation to Owner/Contact models
    - No companyHQ scoping for saved events
    - No multi-tenant isolation

14. **No Event Validation**
    - No verification events are real
    - No date validation
    - No URL validation
    - No cost validation

15. **Separate Domain Confusion**
    - `EventPlan` model for content artifacts
    - `SavedEvent` model for intelligence
    - Same "event" naming, different purposes
    - No clear separation in codebase

---

## Summary

The Events Intelligence system has a **working AI generation pipeline** but suffers from **type inconsistencies**, **missing persistence layers**, and **architectural gaps**. The core flow (persona → filters → AI → display → save) works, but the save functionality is likely broken due to type mismatches. There's no canonical event source, no way to view saved events, and the scoring system is lost on save. The system needs type unification, proper persistence, and clear domain boundaries before it can scale.

