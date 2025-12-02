# FORENSIC AUDIT: Event ↔ Association Crossover

**Date**: 2025-01-XX  
**Scope**: Complete repo scan for association/ecosystem/organizer/producer references  
**Status**: ✅ Complete

---

## 1. EXISTING IMPLEMENTATIONS

### 1.1 Prisma Models

#### ✅ AssociationIngest (COMPLETE, ACTIVE)
**File**: `prisma/schema.prisma` (lines 1115-1142)

```prisma
model AssociationIngest {
  id               String   @id @default(cuid())
  
  // Raw spreadsheet fields
  rawName          String
  rawWebsite       String?
  rawLocation      String?
  
  // Inferred by AI
  normalizedName   String
  description      String?
  industryTags     String[]
  memberTypes      String[]
  memberSeniority  String?
  missionSummary   String?
  authorityLevel   Int?
  valueProposition String?
  
  // BD Intelligence
  personaAlignment Json?
  bdRelevanceScore Int?
  
  ecosystemType    EcosystemEntityType @default(ASSOCIATION)
  
  createdAt        DateTime @default(now())
}
```

**Status**: ✅ Complete, actively used  
**Conflicts**: None - isolated Stage 1 implementation

---

#### ✅ EcosystemEntityType Enum (COMPLETE, ACTIVE)
**File**: `prisma/schema.prisma` (lines 1106-1113)

```prisma
enum EcosystemEntityType {
  ASSOCIATION
  VENDOR
  PARTNER
  MEDIA
  GOVERNMENT
  NONPROFIT
}
```

**Status**: ✅ Complete, defined but only ASSOCIATION currently used  
**Conflicts**: None

---

#### ⚠️ BDEventOpp Model (PARTIAL - HAS ORGANIZER FIELDS)
**File**: `prisma/schema.prisma` (lines 1065-1100)

```prisma
model BDEventOpp {
  organizerName   String
  producerType    String  // "Association" | "Commercial" | "Media" | "Institution" | "Corporate"
  // ... other fields
}
```

**Status**: ⚠️ Partial - has `organizerName` and `producerType` but NO relation to `AssociationIngest`  
**What it does**: Stores event organizer as string, producer type as string  
**Conflict**: **CRITICAL** - Events reference organizers but are NOT linked to ecosystem intelligence

---

### 1.2 TypeScript Types

#### ✅ Association Interface (COMPLETE, ACTIVE)
**File**: `src/components/ecosystem/AssociationCard.tsx` (lines 5-21)

```typescript
export interface Association {
  id: string;
  rawName: string;
  normalizedName: string;
  description?: string | null;
  industryTags: string[];
  memberTypes: string[];
  memberSeniority?: string | null;
  missionSummary?: string | null;
  authorityLevel?: number | null;
  valueProposition?: string | null;
  personaAlignment?: Record<string, number> | null;
  bdRelevanceScore?: number | null;
  rawWebsite?: string | null;
  rawLocation?: string | null;
  createdAt: Date;
}
```

**Status**: ✅ Complete, actively used  
**Conflicts**: None

---

#### ✅ ProducerType Type (COMPLETE, ACTIVE)
**File**: `src/lib/types/BD_EventOpp.ts` (lines 1-6)

```typescript
export type ProducerType =
  | "Commercial"
  | "Association"
  | "Media"
  | "Institution"
  | "Corporate";
```

**Status**: ✅ Complete  
**What it does**: Defines producer types for events  
**Conflict**: **POTENTIAL** - "Association" type exists but NOT linked to `AssociationIngest` records

---

#### ✅ BDEventOpp Interface (COMPLETE, ACTIVE)
**File**: `src/lib/types/BD_EventOpp.ts` (lines 19-57)

```typescript
export interface BDEventOpp {
  organizerName: string;
  producerType: ProducerType;
  // ... other fields
}
```

**Status**: ✅ Complete, actively used  
**What it does**: Event type with organizer fields  
**Conflict**: **CRITICAL** - `organizerName` is just a string, NOT a relation

---

### 1.3 API Routes

#### ✅ /api/ecosystem/association/ingest (COMPLETE, ACTIVE)
**File**: `src/app/api/ecosystem/association/ingest/route.ts`

**Endpoints**:
- `POST /api/ecosystem/association/ingest` - Upload CSV/XLSX, parse, run AI inference
- `GET /api/ecosystem/association/ingest` - Fetch all associations

**Status**: ✅ Complete, actively used  
**What it does**: Handles association ingestion from spreadsheets  
**Conflicts**: None - isolated Stage 1 implementation

---

### 1.4 Services

#### ✅ associationInference Service (COMPLETE, ACTIVE)
**File**: `src/lib/services/associationInference.ts`

**What it does**: 
- Runs OpenAI inference on association raw data
- Infers: normalizedName, description, industryTags, memberTypes, authorityLevel, BD scores
- Returns `AssociationInferenceResult`

**Status**: ✅ Complete, actively used  
**Conflicts**: None

---

#### ⚠️ EventRecommendationService (PARTIAL - MENTIONS ORGANIZER)
**File**: `src/lib/services/EventRecommendationService.ts` (lines 84-88, 210)

**Excerpt**:
```typescript
// Line 84-88
3. Use multiple producer types (Association, Commercial, Media, Institution, Corporate)
4. Each event must have:
   - organizerName: Organizer name
   - producerType: One of "Association", "Commercial", "Media", "Institution", "Corporate"

// Line 210
organizerName: event.organizerName || event.organization || 'Unknown',
producerType: (event.producerType || 'Commercial') as BDEventOpp['producerType'],
```

**Status**: ⚠️ Partial  
**What it does**: Generates event recommendations with organizer names  
**Conflict**: **CRITICAL** - Organizer is just a string, NOT linked to ecosystem intelligence

---

#### ✅ EventPlannerService (PARTIAL - MENTIONS PRODUCER TYPES)
**File**: `src/lib/services/EventPlannerService.ts` (line 60)

**Excerpt**:
```typescript
3. Use multiple producer types (Association, Commercial, Media, Institution, Corporate)
```

**Status**: ⚠️ Partial - references producer types but no ecosystem linkage  
**Conflicts**: None (no direct conflict, but missing connection)

---

### 1.5 Components

#### ✅ AssociationCard (COMPLETE, ACTIVE)
**File**: `src/components/ecosystem/AssociationCard.tsx`

**Status**: ✅ Complete, actively used  
**What it does**: Displays association preview card with BD score, authority level, industry tags  
**Conflicts**: None

---

#### ✅ AssociationDetailModal (COMPLETE, ACTIVE)
**File**: `src/components/ecosystem/AssociationDetailModal.tsx`

**Status**: ✅ Complete, actively used  
**What it does**: Full detail view for associations with persona alignment charts  
**Conflicts**: None

---

#### ⚠️ EventRecommendationsList (PARTIAL - DISPLAYS PRODUCER TYPE)
**File**: `src/app/(authenticated)/events/build-from-persona/EventRecommendationsList.tsx` (lines 54-89)

**Excerpt**:
```typescript
const getProducerTypeColor = (type: string) => {
  switch (type) {
    case 'Association': return 'bg-blue-100 text-blue-800';
    // ...
  }
};
// ...
{event.producerType}  // Line 89
```

**Status**: ⚠️ Partial  
**What it does**: Displays producer type badge on event cards  
**Conflict**: **POTENTIAL** - Shows "Association" type but NOT linked to `AssociationIngest`

---

### 1.6 Pages

#### ✅ /ecosystem/associations (COMPLETE, ACTIVE)
**File**: `src/app/(authenticated)/ecosystem/associations/page.tsx`

**Features**:
- File upload (CSV/XLSX)
- Cluster map views (by industry, persona, authority)
- List view with cards
- Detail modal

**Status**: ✅ Complete, actively used  
**Conflicts**: None

---

## 2. NAVIGATION + UI FORENSICS

### 2.1 Sidebar Navigation

**File**: `src/components/Sidebar.jsx`

**Current Navigation Groups**:
1. Growth Ops (BD Roadmap, Personas, Products, BD Intelligence)
2. Attract (Ads & SEO, Content, **Events**)
3. Engage (Manage Contacts, Contact Lists, Deal Pipelines, Enrich, Outreach, Meetings)
4. Nurture (disabled)
5. Client Operations (Proposals, Work Packages, Execution, Billing)
6. Settings

**Findings**:
- ❌ **NO "Ecosystem" navigation entry**
- ❌ **NO "Associations" navigation entry**
- ✅ Events page exists under "Attract" group
- ❌ Ecosystem page exists but NOT in sidebar

**Status**: **MISSING** - Ecosystem/Associations page is orphaned (accessible via direct URL only)

---

### 2.2 Existing Pages Under /ecosystem/

**Files Found**:
- ✅ `src/app/(authenticated)/ecosystem/associations/page.tsx` - EXISTS, ACTIVE

**Status**: Page exists but not linked in navigation

---

### 2.3 Hidden/Disabled Navigation

**File**: `src/components/Sidebar.jsx` (line 70-76)

```javascript
{
  name: 'Nurture',
  disabled: true,
  items: [
    { name: 'Email Marketing', path: '#', icon: Mail, disabled: true },
    { name: 'Social Media', path: '#', icon: Share2, disabled: true },
  ],
}
```

**Findings**: 
- "Nurture" group exists but is disabled
- No ecosystem references in disabled sections

---

## 3. EVENT ↔ ORGANIZER CONNECTIONS

### 3.1 Field Analysis

#### Fields in BDEventOpp Model
**File**: `prisma/schema.prisma` (lines 1072-1073)

```prisma
organizerName   String
producerType    String
```

**Status**: ✅ Fields exist but are **STRING FIELDS**, NOT relations

---

#### Fields in Event Types
**Files**: 
- `src/lib/types/BD_EventOpp.ts` (line 30-31)
- `src/lib/schemas/BDEventOppSchema.ts` (lines 23-24)
- `src/lib/types/EventSuggestion.ts` (lines 13-14)

**Excerpt**:
```typescript
organizerName: string;
producerType: ProducerType;
```

**Status**: ✅ Fields exist but are **PRIMITIVES**, NOT relations

---

### 3.2 Lookup/Mapping Logic

**Search Results**: 
- ❌ **NO lookup logic** mapping `organizerName` → `AssociationIngest`
- ❌ **NO inference logic** using ecosystem intelligence for events
- ❌ **NO connection** between event `producerType: "Association"` and `AssociationIngest` records

**Files Checked**:
- `src/lib/services/EventRecommendationService.ts` - ❌ No ecosystem lookup
- `src/lib/services/EventPlannerService.ts` - ❌ No ecosystem lookup
- `src/lib/mappers/transformEventAIToOpp.ts` - ❌ No ecosystem mapping

---

### 3.3 Industry Inference from Organizer

**Search Results**:
- ❌ **NO logic** to infer industry from organizer name
- ❌ **NO matching** between event `organizerName` and `AssociationIngest.normalizedName`

---

### 3.4 Ecosystem References in Event Services

**Files Checked**:
- `src/lib/services/EventRecommendationService.ts` - ❌ No "ecosystem" mentions
- `src/lib/services/EventPlannerService.ts` - ❌ No "ecosystem" mentions
- `src/lib/services/BDEventOppSaveService.ts` - ❌ No "ecosystem" mentions
- `src/lib/services/EventUpsertService.ts` - ❌ No "ecosystem" mentions

**Finding**: Event services are **TOTALLY ISOLATED** from ecosystem intelligence

---

### 3.5 Scoring Using Organizer Metadata

**Search Results**:
- ❌ **NO scoring** using `AssociationIngest.bdRelevanceScore`
- ❌ **NO matching** using `AssociationIngest.industryTags`
- ❌ **NO persona alignment** using `AssociationIngest.personaAlignment`

**Event scoring is completely independent** - uses only persona-based match signals, NOT ecosystem intelligence

---

### 3.6 Connection Status: TOTAL ISOLATION

**Conclusion**: 

✅ **Event engine and ecosystem engine exist in TOTAL ISOLATION**

**Evidence**:
1. `BDEventOpp.organizerName` is a string field, NOT a foreign key
2. No Prisma relation between `BDEventOpp` and `AssociationIngest`
3. No service logic connecting events to associations
4. No lookup/mapping functions
5. No shared intelligence (BD scores, persona alignment, industry tags)

---

## 4. MISSING PIECES (DIFF REPORT)

### Navigation & UI
- ❌ **Missing**: Sidebar entry for "Ecosystem" or "Associations"
- ❌ **Missing**: Navigation group placement (should be under "Attract" or "Growth Ops"?)
- ❌ **Missing**: Icon import for ecosystem in Sidebar.jsx

### Prisma Schema
- ❌ **Missing**: Foreign key from `BDEventOpp.organizerName` → `AssociationIngest.id`
- ❌ **Missing**: Optional relation `BDEventOpp.associationId String? @relation(...)`
- ❌ **Missing**: Index on `BDEventOpp.organizerName` for lookup performance

### Services & Logic
- ❌ **Missing**: Lookup service: `findAssociationByOrganizerName(organizerName: string)`
- ❌ **Missing**: Enrichment service: `enrichEventWithAssociationIntelligence(event: BDEventOpp)`
- ❌ **Missing**: Matching logic: Fuzzy match `BDEventOpp.organizerName` → `AssociationIngest.normalizedName`
- ❌ **Missing**: Scoring enhancement: Use `AssociationIngest.bdRelevanceScore` in event scoring
- ❌ **Missing**: Industry inference: Use `AssociationIngest.industryTags` for event industry matching

### Transform/Mapper Layer
- ❌ **Missing**: `transformEventWithAssociation.ts` - Map event organizer to association record
- ❌ **Missing**: `enrichEventRecommendation.ts` - Enhance event recommendations with ecosystem data
- ❌ **Missing**: Normalization function: `normalizeOrganizerName(name: string)` for matching

### API Routes
- ❌ **Missing**: `GET /api/ecosystem/association/match?organizerName=...` - Find association by organizer
- ❌ **Missing**: `POST /api/events/enrich` - Enrich existing events with association intelligence
- ❌ **Missing**: `GET /api/ecosystem/association/:id/events` - Get events by association

### Event Recommendation Enhancement
- ❌ **Missing**: Use `AssociationIngest` records when `producerType === "Association"`
- ❌ **Missing**: Boost event scores if organizer matches high-BD-score association
- ❌ **Missing**: Filter/sort events by association authority level
- ❌ **Missing**: Show association intelligence in event recommendation cards

### Save Pipeline Connection
- ❌ **Missing**: When saving event with `producerType: "Association"`, attempt to link to `AssociationIngest`
- ❌ **Missing**: In `BDEventOppSaveService.ts`, add association lookup before save
- ❌ **Missing**: In `EventUpsertService.ts`, enrich with association intelligence

### Canonical Organizer Intelligence Model
- ❌ **Missing**: Unified `OrganizerIntelligence` model/type that combines:
  - AssociationIngest data (if association)
  - Event statistics (count, avg persona alignment)
  - BD relevance aggregations
- ❌ **Missing**: Service to build organizer intelligence from multiple sources

### Event-to-Association Reverse Lookup
- ❌ **Missing**: "View all events from this association" feature
- ❌ **Missing**: Association detail page showing related events
- ❌ **Missing**: Query: `GET /api/ecosystem/association/:id/events`

### Type System
- ❌ **Missing**: Union type: `Organizer = AssociationIngest | { name: string, type: string }`
- ❌ **Missing**: Enhanced `BDEventOpp` with optional `association: Association | null`
- ❌ **Missing**: Type guards: `isAssociationOrganizer(organizerName: string): boolean`

---

## SUMMARY

### What Exists ✅
1. Complete `AssociationIngest` model and inference pipeline (Stage 1)
2. `BDEventOpp` model with `organizerName` and `producerType` fields
3. Event recommendation service generating events with organizer names
4. Ecosystem associations page (orphaned in navigation)

### What's Missing ❌
1. **CRITICAL**: No connection between events and associations
2. **CRITICAL**: No navigation entry for ecosystem/associations
3. No lookup/matching logic for organizer → association
4. No enrichment of events using association intelligence
5. No shared scoring/BD intelligence
6. No reverse lookup (association → events)

### Architecture Gap
**Events and Ecosystem are TWO SEPARATE SYSTEMS** with no integration layer. Events have organizer names as strings, but these are never matched to `AssociationIngest` records, even when `producerType === "Association"`.

