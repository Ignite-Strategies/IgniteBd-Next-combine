# Event System Reconciliation - Implementation Summary

**Date**: January 2025  
**Status**: ✅ Core Architecture Complete

---

## 🎯 Three-Layer Architecture

### 1. Persona-Based BD Intelligence (Read-only)
**Purpose**: "Where is the opportunity?"

- **Service**: `PersonaBDIntelligenceService`
- **API**: `GET /api/personas/[personaId]/bd-intelligence`
- **Output**: `PersonaBDSignal[]` with single `bdScore` (0-100) and `bdRationale`
- **No user preferences**: Budget, travel, geography are NOT considered
- **Focus**: Allocator density, GP/dealflow density, industry relevance, BD opportunity signals

### 2. Event Tuner (User Constraints)
**Purpose**: "What am I willing to do?"

- **Model**: `event_tuners` with constraints:
  - `conferencesPerQuarter`
  - `costRange` (EventCostRange enum)
  - `eventSearchRawText`
  - `travelDistance` (TravelDistance enum)
  - `preferredStates` (many-to-many)
  - `personas` (many-to-many, optional)
- **API**: `POST /api/event-tuners/create`
- **Immutable**: Once Event Ops are created, tuner is locked
- **Hard gates**: Constraints are pass/fail only, no scoring

### 3. Event Ops (Executable Events)
**Purpose**: "What am I executing?"

- **Model**: `bd_event_ops` (existing, enhanced)
- **New fields**:
  - `eventTunerId` - Links to tuner that generated it
  - `prioritySource` - "BD_INTEL" if from BD intelligence
- **Source**: Derived from EventTuner constraints + BD Intelligence overlay

---

## 🔄 Event Selection Flow

### Step 1: Create Event Tuner
User defines their program constraints:
- Cost range
- Geographic preferences (states)
- Travel distance
- Search keywords
- Optional: Personas for BD intelligence

### Step 2: Generate Selectable Events
**Service**: `EventSelectionService.generateSelectableEvents()`

1. **Get BD Intelligence** (if personas on tuner)
   - Calls `PersonaBDIntelligenceService`
   - Returns top ~10 BD-relevant events

2. **Get EventMeta candidates**
   - Fetches from `event_metas` table

3. **Filter by constraints** (hard gates)
   - Cost range check
   - Geographic check (preferred states)
   - Travel distance check
   - Search text check
   - **Events that fail are excluded**

4. **Mark BD Intelligence priority**
   - If event appears in BD Intelligence AND passes constraints
   - Mark `prioritySource = "BD_INTEL"`

5. **Rank results**
   - If personas exist: Sort by BD_INTEL first, then persona fit score
   - If no personas: Sort chronologically

### Step 3: User Selects Events
User reviews selectable events and chooses which to add to their program.

### Step 4: Create Event Ops
Selected events become `bd_event_ops` records, linked to the EventTuner.

---

## 🚫 What Was Removed

### Deprecated Concepts
- ❌ Priority filters (well-known, well-attended, etc.)
- ❌ Multi-dimensional scoring (wellKnownScore, costScore, etc.)
- ❌ BudgetPreference enum (budget/standard/premium)
- ❌ Preference-based AI prompts
- ❌ "Balancing" preferences in scoring

### Old Services (To Be Deprecated)
- `EventPlannerService` - Mixed preferences with rankings
- `EventRecommendationService` - Complex multi-score system
- Priority filter UI components

---

## ✅ What Was Added

### New Models
- `event_tuners` - User program constraints
- `event_tuner_states` - Many-to-many preferred states
- `event_tuner_personas` - Many-to-many personas (optional)

### New Enums
- `EventCostRange`: FREE, LOW_0_500, MEDIUM_500_2000, HIGH_2000_5000, PREMIUM_5000_PLUS, NO_LIMIT
- `TravelDistance`: LOCAL, REGIONAL, DOMESTIC, INTERNATIONAL, NO_LIMIT
- `EventSource`: Added BD_INTEL

### New Services
- `PersonaBDIntelligenceService` - Pure BD intelligence, no preferences
- `EventTunerFilterService` - Hard constraint checking
- `EventSelectionService` - Main orchestration service

### New APIs
- `POST /api/event-tuners/create` - Create event program
- `GET /api/event-tuners/[tunerId]/selectable-events` - Get filtered events
- `GET /api/personas/[personaId]/bd-intelligence` - Get BD signals

---

## 📝 Language & Copy Rules

### ✅ Use This Language
- **"Market Intelligence"** - BD Intelligence signals
- **"Your Event Program"** - EventTuner
- **"Matches your program"** - Events that pass constraints
- **"BD Opportunity"** - BD Intelligence rationale

### ❌ Do NOT Use
- "Priority filters"
- "Well-known"
- "Cost-effective"
- "Priority rankings"
- Any explanation of why events failed constraints (just exclude them)

---

## 🔧 Implementation Status

### ✅ Completed
- [x] EventTuner Prisma model
- [x] BD Intelligence service (persona-only)
- [x] Event filtering service (hard gates)
- [x] Event selection service (orchestration)
- [x] BD Intelligence → Event Tuner bridge
- [x] API routes for EventTuner
- [x] API route for BD Intelligence

### ⏳ Pending
- [ ] Event Tuner UX (replace priority filters)
- [ ] Remove deprecated services
- [ ] Update all copy/language
- [ ] Migration script
- [ ] Database migration

---

## 🎯 Key Principles

### 1. Hard Gates, Not Scoring
Constraints are pass/fail. If an event doesn't match cost range, it's excluded. No scoring.

### 2. BD Intelligence is Advisory
BD Intelligence shows opportunity, but doesn't override constraints. If a BD event violates constraints, it's excluded.

### 3. Priority Overlay, Not Override
BD events that pass constraints get marked as `prioritySource = "BD_INTEL"` and shown first, but they still must pass all constraints.

### 4. No Preference Bleeding
BD Intelligence layer does NOT accept preferences. EventTuner layer does NOT do BD scoring. Event Ops layer does NOT do filtering.

---

## 🚀 Next Steps

1. **Create Migration**
   - Add EventTuner models
   - Add new enums
   - Add `eventTunerId` and `prioritySource` to `bd_event_ops`

2. **Build Event Tuner UX**
   - Replace priority filter UI with constraint inputs
   - Cost range selector
   - State selector (multi-select)
   - Travel distance selector
   - Search text input

3. **Update Events Landing Page**
   - "Market Intelligence" path (BD Intelligence only)
   - "Your Event Program" path (Event Tuner)

4. **Deprecate Old Code**
   - Mark old services as deprecated
   - Remove priority filter components
   - Update documentation

---

## 📚 Files Created

### Services
- `lib/services/PersonaBDIntelligenceService.ts`
- `lib/services/EventTunerFilterService.ts`
- `lib/services/EventSelectionService.ts`

### APIs
- `app/api/event-tuners/create/route.ts`
- `app/api/event-tuners/[tunerId]/selectable-events/route.ts`
- `app/api/personas/[personaId]/bd-intelligence/route.ts`

### Schema
- `prisma/schema.prisma` - Added EventTuner models and enums

---

**Status**: Core architecture complete. Ready for UX implementation and migration.

