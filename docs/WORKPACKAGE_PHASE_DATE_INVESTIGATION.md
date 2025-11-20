# WorkPackagePhase Date Hydration Investigation

**Date**: December 2024  
**Purpose**: Forensic analysis of how WorkPackagePhase date fields are implemented, stored, and hydrated

---

## 🔍 TASK 1 — Prisma Schema Analysis

### Actual Schema (from `prisma/schema.prisma`)

```prisma
model WorkPackagePhase {
  id            String      @id @default(cuid())
  workPackageId String
  workPackage   WorkPackage @relation(fields: [workPackageId], references: [id], onDelete: Cascade)

  name                String
  position            Int
  description         String? // Phase description
  phaseTotalDuration  Int? // normalized business days (backward compatibility)
  totalEstimatedHours Int? // Computed aggregate from items (quantity * estimatedHoursEach)

  // Estimated dates (calculated from WorkPackage effectiveStartDate)
  estimatedStartDate DateTime? // Calculated: WorkPackage start + previous phases
  estimatedEndDate   DateTime? // Calculated: estimatedStartDate + phaseTotalDuration

  // Actual dates (set when work begins/completes, can be manually overwritten)
  actualStartDate DateTime? // Set when phase status changes to "in_progress" (or manually)
  actualEndDate   DateTime? // Set when phase status changes to "completed" (or manually)

  // Status tracking
  status String? // not_started | in_progress | completed

  items WorkPackageItem[]

  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt

  @@unique([workPackageId, name, position])
  @@index([workPackageId])
  @@index([position])
  @@map("work_package_phases")
}
```

### Schema Findings

**Date Fields:**
- `estimatedStartDate`: `DateTime?` (nullable)
- `estimatedEndDate`: `DateTime?` (nullable)
- `actualStartDate`: `DateTime?` (nullable)
- `actualEndDate`: `DateTime?` (nullable)

**Duration Fields:**
- `phaseTotalDuration`: `Int?` (nullable, marked as "backward compatibility")
- `totalEstimatedHours`: `Int?` (nullable, computed from items)

**Status Field:**
- `status`: `String?` (nullable, values: `not_started | in_progress | completed`)

**No computed fields or defaults** - all date fields are nullable and must be set explicitly.

---

## 🔍 TASK 2 — Phase Date Hydration Services

### Service 1: `PhaseDueDateService.js`

**Location**: `src/lib/services/PhaseDueDateService.js`

**Functions:**

#### `calculatePhaseEffectiveDate(workPackageStartDate, allPhases, currentPhasePosition)`
- **Purpose**: Calculates effective start date for a phase based on WorkPackage start and previous phases
- **Logic**: 
  - Uses actual dates when available for progressive calculation
  - If previous phase has `actualEndDate`, uses it + 1 day
  - If previous phase has `actualStartDate`, calculates from actual start + duration
  - Otherwise, uses estimated duration (`totalEstimatedHours / 8`)
- **Does NOT mutate database** - pure calculation function

#### `calculatePhaseDueDate(effectiveDate, totalEstimatedHours)`
- **Purpose**: Calculates expected end date
- **Logic**: Calls `computeExpectedEndDate(effectiveDate, totalEstimatedHours)`
- **Formula**: `effectiveDate + (totalEstimatedHours / 8 days)`
- **Does NOT mutate database** - pure calculation function

#### `recalculateAllPhaseDates(workPackageId, overwriteActuals = false)`
- **Purpose**: Recalculates and updates ALL phase dates for a work package
- **Logic**:
  - Gets all phases sorted by position
  - For each phase:
    1. Calculates `totalEstimatedHours` from items
    2. Determines `phaseStartDate`:
       - Phase 1: Uses `workPackage.effectiveStartDate` (or `actualStartDate` if exists)
       - Phase 2+: Uses calculated from previous phases (uses `actualEndDate` if available)
    3. Calculates `estimatedEndDate` = `phaseStartDate + (totalEstimatedHours / 8)`
    4. Updates phase with `totalEstimatedHours`, `estimatedStartDate`, `estimatedEndDate`
  - **MUTATES DATABASE** - Updates `estimatedStartDate` and `estimatedEndDate` for all phases
  - Uses hours-to-days conversion (`totalEstimatedHours / 8`)

#### `overwritePhaseDates(phaseId, dates)`
- **Purpose**: Manual override of phase dates
- **Logic**: Directly updates any provided date fields
- **MUTATES DATABASE** - Updates `estimatedStartDate`, `estimatedEndDate`, `actualStartDate`, `actualEndDate`

#### `updatePhaseDatesFromStatus(phaseId, newStatus)`
- **Purpose**: Auto-sets actual dates when status changes
- **Logic**:
  - If status → `in_progress` AND `actualStartDate` is null → sets `actualStartDate = today`
  - If status → `completed` AND `actualEndDate` is null → sets `actualEndDate = today`
- **MUTATES DATABASE** - Updates `status`, `actualStartDate`, `actualEndDate`

#### `upsertWorkPackageEffectiveDate(workPackageId, effectiveStartDate, overwriteActuals = false)`
- **Purpose**: Updates WorkPackage `effectiveStartDate` and triggers recalculation
- **Logic**: Updates WorkPackage, then calls `recalculateAllPhaseDates()`
- **MUTATES DATABASE** - Updates WorkPackage and all phases

### Service 2: `WorkPackageHydrationService.js`

**Location**: `src/lib/services/WorkPackageHydrationService.js`

**Function:** `hydrateWorkPackage(workPackage, options = {})`

**Phase Hydration Logic:**

1. **Upserts `phaseTotalDuration`** (lines 68-86):
   - Calculates `totalEstimatedHours` from items
   - Calls `upsertPhaseTotalDuration(phase.id, aggregatedHours)`
   - **MUTATES DATABASE** - Updates `phaseTotalDuration` and `totalEstimatedHours`

2. **Sets Phase 1 `estimatedStartDate`** (lines 94-108):
   - If Phase 1 has no `estimatedStartDate` and WorkPackage has `effectiveStartDate`:
     - Updates Phase 1: `estimatedStartDate = effectiveStartDate`
   - **MUTATES DATABASE** - Updates Phase 1

3. **Calculates effective dates for response** (lines 110-196):
   - Uses `actualStartDate` if available
   - Otherwise uses stored `estimatedStartDate`
   - Otherwise calculates from progressive start date
   - **Does NOT mutate** - only calculates for response

4. **Calculates expected end dates for response**:
   - Uses `actualEndDate` if phase is completed
   - Otherwise calculates: `effectiveDate + (totalEstimatedHours / 8)`
   - **Does NOT mutate** - only calculates for response

**Key Finding**: Hydration service **DOES mutate** `phaseTotalDuration` and Phase 1 `estimatedStartDate`, but other date calculations are **read-only** for the response.

### Service 3: `PhaseDurationService.js`

**Location**: `src/lib/services/PhaseDurationService.js`

**Functions:**

#### `calculatePhaseTotalDurationFromHours(totalEstimatedHours)`
- **Formula**: `Math.ceil(totalEstimatedHours / 8)`
- **Does NOT mutate** - pure calculation

#### `upsertPhaseTotalDuration(phaseId, totalEstimatedHours = null)`
- **Purpose**: Updates `phaseTotalDuration` and `totalEstimatedHours` on a phase
- **Logic**: Calculates `phaseTotalDuration = totalEstimatedHours / 8`, then updates phase
- **MUTATES DATABASE** - Updates `phaseTotalDuration` and `totalEstimatedHours`

#### `recalculateAllPhaseDurations(workPackageId)`
- **Purpose**: Recalculates `phaseTotalDuration` for all phases
- **Logic**: For each phase, calculates hours from items, then `phaseTotalDuration = hours / 8`
- **MUTATES DATABASE** - Updates `phaseTotalDuration` and `totalEstimatedHours` for all phases

---

## 🔍 TASK 3 — Duration/Calculation Logic

### Functions That Use Hours-to-Days Conversion

1. **`convertHoursToDays(estimatedHours)`** (`workPackageTimeline.js`)
   - Formula: `Math.ceil(estimatedHours / 8)`
   - Used by: `computeExpectedEndDate()`

2. **`computeExpectedEndDate(effectiveDate, totalEstimatedHours)`** (`workPackageTimeline.js`)
   - Formula: `effectiveDate + convertHoursToDays(totalEstimatedHours)`
   - Used by: `calculatePhaseDueDate()`, `recalculateAllPhaseDates()`, `WorkPackageHydrationService`

3. **`calculatePhaseDueDate(effectiveDate, totalEstimatedHours)`** (`PhaseDueDateService.js`)
   - Wrapper around `computeExpectedEndDate()`
   - Used by: `recalculateAllPhaseDates()`

4. **`calculatePhaseEffectiveDate(workPackageStartDate, allPhases, currentPhasePosition)`** (`PhaseDueDateService.js`)
   - Uses `totalEstimatedHours / 8` for duration calculation
   - Used by: NOT CURRENTLY USED (dead code?)

### Where Duration Logic Appears in Hydrate

**In `WorkPackageHydrationService.js`:**
- Line 80: Calls `upsertPhaseTotalDuration()` - **MUTATES** `phaseTotalDuration`
- Line 147: Calls `computeExpectedEndDate()` - **READ-ONLY** (for response)

**In `PhaseDueDateService.js`:**
- Line 46: Uses `Math.ceil((phase.totalEstimatedHours || 0) / 8)` - **READ-ONLY** (calculation)
- Line 53: Uses `Math.ceil((phase.totalEstimatedHours || 0) / 8)` - **READ-ONLY** (calculation)
- Line 139: Calls `calculatePhaseDueDate()` - **MUTATES** `estimatedEndDate`

### Dead Code

**`calculatePhaseEffectiveDate()`** - Defined but **NOT USED** anywhere in the codebase.

### Incorrect Logic

**`recalculateAllPhaseDates()`** (lines 82-198):
- **Problem**: Uses `totalEstimatedHours / 8` to calculate `estimatedEndDate`
- **Problem**: Recalculates ALL phases when ANY phase changes
- **Problem**: Uses hours-to-days conversion instead of pure date delta

**`WorkPackageHydrationService.hydrateWorkPackage()`** (line 80):
- **Problem**: Calls `upsertPhaseTotalDuration()` which mutates `phaseTotalDuration` during hydration
- **Problem**: Should be read-only during hydration

---

## 🔍 TASK 4 — Phase Date Mutations

### Mutation Points

#### 1. **`PATCH /api/workpackages/phases/:phaseId`** (`src/app/api/workpackages/phases/[phaseId]/route.js`)

**When status changes:**
- Calls `updatePhaseDatesFromStatus()` → sets `actualStartDate`/`actualEndDate`
- Then calls `recalculateAllPhaseDates()` → **RECALCULATES ALL PHASES**

**When dates are overwritten:**
- Calls `overwritePhaseDates()` → directly updates date fields
- If `actualStartDate` or `actualEndDate` changed → calls `recalculateAllPhaseDates()`

**Editable Fields:**
- ✅ `status` (auto-sets actual dates)
- ✅ `estimatedStartDate` (manual override)
- ✅ `estimatedEndDate` (manual override)
- ✅ `actualStartDate` (manual override)
- ✅ `actualEndDate` (manual override)

**Auto-Calculated Fields:**
- ⚠️ `estimatedStartDate` - Auto-calculated by `recalculateAllPhaseDates()` (WRONG)
- ⚠️ `estimatedEndDate` - Auto-calculated by `recalculateAllPhaseDates()` (WRONG)

#### 2. **`PATCH /api/workpackages/:id`** (`src/app/api/workpackages/[id]/route.js`)

**When `effectiveStartDate` changes:**
- Calls `recalculateAllPhaseDates()` → **RECALCULATES ALL PHASES**

#### 3. **`WorkPackageHydrationService.hydrateWorkPackage()`**

**During hydration:**
- Calls `upsertPhaseTotalDuration()` → **MUTATES** `phaseTotalDuration`
- Updates Phase 1 `estimatedStartDate` if missing → **MUTATES** Phase 1

**Problem**: Hydration should be **READ-ONLY**, but it mutates the database.

#### 4. **Item Creation/Update/Delete** (`src/app/api/workpackages/items/*`)

**When items change:**
- Updates `phaseTotalDuration` directly
- **Does NOT** update date fields (correct)

### Summary of Mutations

**Fields That Are Auto-Calculated (WRONG):**
- `estimatedStartDate` - Calculated by `recalculateAllPhaseDates()` using hours logic
- `estimatedEndDate` - Calculated by `recalculateAllPhaseDates()` using hours logic

**Fields That Should NOT Be Auto-Calculated:**
- `estimatedStartDate` - Should only be set manually or by date delta
- `estimatedEndDate` - Should only be set manually or by date delta

**Fields That Are Correctly Auto-Set:**
- `actualStartDate` - Set when status → `in_progress` ✅
- `actualEndDate` - Set when status → `completed` ✅

---

## 🔍 TASK 5 — The Truth

### What the Schema Supports

**The schema supports:**
- ✅ `estimatedStartDate` - Stored as `DateTime?`
- ✅ `estimatedEndDate` - Stored as `DateTime?`
- ✅ `actualStartDate` - Stored as `DateTime?`
- ✅ `actualEndDate` - Stored as `DateTime?`
- ✅ `phaseTotalDuration` - Stored as `Int?` (backward compatibility)
- ✅ `totalEstimatedHours` - Stored as `Int?`

**All date fields are nullable** - no defaults, no computed fields.

### How Dates Are Currently Hydrated

**Hydration Flow:**

1. **API Route** (`/api/workpackages/:id/hydrate`):
   - Fetches WorkPackage with phases (selects all date fields)
   - Calls `hydrateWorkPackage()`

2. **Hydration Service** (`WorkPackageHydrationService.js`):
   - **MUTATES**: Updates `phaseTotalDuration` for all phases
   - **MUTATES**: Updates Phase 1 `estimatedStartDate` if missing
   - **READS**: Uses stored `estimatedStartDate`, `estimatedEndDate`, `actualStartDate`, `actualEndDate`
   - **CALCULATES**: Computes `effectiveDate` and `expectedEndDate` for response (read-only)

3. **Response**:
   - Returns stored dates: `estimatedStartDate`, `estimatedEndDate`, `actualStartDate`, `actualEndDate`
   - Returns calculated dates: `effectiveDate`, `expectedEndDate` (for display)

### Where Wrong Logic Needs to Be Removed

1. **`recalculateAllPhaseDates()`** (`PhaseDueDateService.js`):
   - **WRONG**: Uses `totalEstimatedHours / 8` to calculate `estimatedEndDate`
   - **WRONG**: Recalculates ALL phases when ANY phase changes
   - **SHOULD**: Only shift subsequent phases by date delta when a phase is moved

2. **`WorkPackageHydrationService.hydrateWorkPackage()`**:
   - **WRONG**: Mutates `phaseTotalDuration` during hydration
   - **WRONG**: Mutates Phase 1 `estimatedStartDate` during hydration
   - **SHOULD**: Be read-only, only calculate for response

3. **`PATCH /api/workpackages/phases/:phaseId`**:
   - **WRONG**: Calls `recalculateAllPhaseDates()` after every update
   - **SHOULD**: Only shift subsequent phases when a phase's dates are moved

### What Needs to Change for Date Delta Rule

**Current Rule (WRONG):**
- If Phase N changes, recalculate ALL phases using hours logic

**Required Rule:**
- If Phase N's `estimatedStartDate` or `estimatedEndDate` is moved:
  1. Calculate delta: `newDate - oldDate`
  2. Shift ALL subsequent phases (N+1, N+2, ...) by the same delta
  3. **NO hours logic** - pure date arithmetic

**Example:**
- Phase 1: Nov 10 → Nov 15
- Phase 2: Nov 16 → Nov 20
- If Phase 1 moves to Nov 12 → Nov 17 (delta = +2 days):
  - Phase 2 should become: Nov 18 → Nov 22 (shifted by +2 days)

---

## 🔍 TASK 6 — Patch Plan

### Files That Need Edits

#### 1. **`src/lib/services/PhaseDueDateService.js`**

**Function: `recalculateAllPhaseDates()`**
- **Lines 82-198**: Complete rewrite required
- **Current Logic**: Uses hours-to-days conversion, recalculates all phases
- **New Logic**: 
  - Only called when WorkPackage `effectiveStartDate` changes
  - Phase 1: `estimatedStartDate = effectiveStartDate`
  - Phase 2+: `estimatedStartDate = previousPhase.estimatedEndDate + 1 day`
  - `estimatedEndDate` = manually set or calculated from `estimatedStartDate + duration` (if duration exists)

**Function: `shiftSubsequentPhases(phaseId, deltaDays)`** (NEW)
- **Purpose**: Shift all phases after the given phase by delta days
- **Logic**:
  1. Get phase and all subsequent phases
  2. For each subsequent phase:
     - `estimatedStartDate += deltaDays`
     - `estimatedEndDate += deltaDays` (if exists)
  3. Update all phases

**Function: `updatePhaseDatesFromStatus()`**
- **Lines 289-326**: Keep as-is (correct)

**Function: `overwritePhaseDates()`**
- **Lines 246-279**: Modify to:
  - If `estimatedStartDate` or `estimatedEndDate` changed:
    - Calculate delta from old dates
    - Call `shiftSubsequentPhases()` instead of `recalculateAllPhaseDates()`

#### 2. **`src/lib/services/WorkPackageHydrationService.js`**

**Function: `hydrateWorkPackage()`**
- **Lines 68-86**: **REMOVE** `upsertPhaseTotalDuration()` call
- **Lines 94-108**: **REMOVE** Phase 1 `estimatedStartDate` mutation
- **Keep**: Read-only date calculations for response (lines 110-196)

#### 3. **`src/app/api/workpackages/phases/[phaseId]/route.js`**

**Function: `PATCH` handler**
- **Lines 40-58**: **REMOVE** `recalculateAllPhaseDates()` call after status change
- **Lines 60-86**: Modify to:
  - If `estimatedStartDate` or `estimatedEndDate` changed:
    - Get old phase dates
    - Calculate delta
    - Call `shiftSubsequentPhases()` instead of `recalculateAllPhaseDates()`
  - If `actualStartDate` or `actualEndDate` changed:
    - **DO NOT** recalculate (actual dates don't affect estimated dates)

#### 4. **`src/app/api/workpackages/[id]/route.js`**

**Function: `PATCH` handler**
- **Lines 199-202**: **MODIFY** `recalculateAllPhaseDates()` call
  - Only recalculate if `effectiveStartDate` changed
  - New logic: Phase 1 = `effectiveStartDate`, Phase 2+ = progressive from Phase 1

#### 5. **`src/lib/services/PhaseDurationService.js`**

**Function: `upsertPhaseTotalDuration()`**
- **Status**: Keep for backward compatibility, but **DO NOT** call during hydration
- **Usage**: Only call when items are added/updated/deleted (not during hydration)

### Logic That Needs to Replace Wrong Logic

#### Replace `recalculateAllPhaseDates()` with Date Delta Logic

**Current (WRONG):**
```javascript
// Uses hours-to-days conversion
const days = Math.ceil(totalEstimatedHours / 8);
estimatedEndDate = estimatedStartDate + days;
```

**New (CORRECT):**
```javascript
// Pure date delta
if (phase.estimatedStartDate && phase.estimatedEndDate) {
  // Use stored dates (manually set)
} else if (phase.estimatedStartDate && phase.phaseTotalDuration) {
  // Calculate from stored start + duration
  estimatedEndDate = estimatedStartDate + phaseTotalDuration days;
} else {
  // Calculate from previous phase
  estimatedStartDate = previousPhase.estimatedEndDate + 1 day;
  estimatedEndDate = estimatedStartDate + phaseTotalDuration days;
}
```

#### Replace `recalculateAllPhaseDates()` calls with `shiftSubsequentPhases()`

**Current (WRONG):**
```javascript
await recalculateAllPhaseDates(workPackageId, false);
```

**New (CORRECT):**
```javascript
// Only if estimated dates changed
if (estimatedStartDate !== undefined || estimatedEndDate !== undefined) {
  const oldPhase = await getPhase(phaseId);
  const delta = calculateDelta(oldPhase, newDates);
  if (delta !== 0) {
    await shiftSubsequentPhases(phaseId, delta);
  }
}
```

### Mutations That Need to Be Removed

1. **Remove** `upsertPhaseTotalDuration()` call from `hydrateWorkPackage()` (line 80)
2. **Remove** Phase 1 `estimatedStartDate` mutation from `hydrateWorkPackage()` (lines 94-108)
3. **Remove** `recalculateAllPhaseDates()` call after status change in PATCH handler
4. **Modify** `recalculateAllPhaseDates()` to only recalculate when `effectiveStartDate` changes

### Final Hydrate Flow

**Correct Hydrate Flow:**

1. **API Route**: Fetch WorkPackage with phases (all date fields)
2. **Hydration Service**: 
   - **READ-ONLY**: Use stored dates from database
   - **CALCULATE**: Compute `effectiveDate` and `expectedEndDate` for response (read-only)
   - **NO MUTATIONS**: Do not update database during hydration
3. **Response**: Return stored dates + calculated dates for display

**Mutations Only Happen When:**
- User manually edits phase dates → shift subsequent phases
- User changes WorkPackage `effectiveStartDate` → recalculate Phase 1, then progressive
- User changes phase status → auto-set actual dates (no shift needed)

---

## Summary

### Current State

- ✅ Schema supports all required date fields
- ❌ Hydration mutates database (should be read-only)
- ❌ Date calculations use hours-to-days conversion (should use date delta)
- ❌ All phases recalculated when any phase changes (should only shift subsequent phases)
- ✅ Actual dates correctly auto-set on status change

### Required Changes

1. **Remove mutations from hydration** - Make hydration read-only
2. **Replace hours logic with date delta** - Pure date arithmetic
3. **Implement `shiftSubsequentPhases()`** - Shift by delta, not recalculate
4. **Only recalculate when `effectiveStartDate` changes** - Not on every phase update

### Files to Edit

1. `src/lib/services/PhaseDueDateService.js` - Rewrite `recalculateAllPhaseDates()`, add `shiftSubsequentPhases()`
2. `src/lib/services/WorkPackageHydrationService.js` - Remove mutations
3. `src/app/api/workpackages/phases/[phaseId]/route.js` - Use `shiftSubsequentPhases()` instead of `recalculateAllPhaseDates()`
4. `src/app/api/workpackages/[id]/route.js` - Modify `recalculateAllPhaseDates()` call

---

**End of Investigation**

