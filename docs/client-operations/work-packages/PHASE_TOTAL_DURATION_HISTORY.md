# phaseTotalDuration History & Migration

**Date**: December 2024  
**Purpose**: Document the evolution from `phaseTotalDuration` to stored start/end dates

---

## The Original System (Duration-Based)

### Original Schema
```prisma
model WorkPackagePhase {
  phaseTotalDuration Int? // Business days (calculated from hours)
  // No estimatedStartDate or estimatedEndDate fields
}
```

### Original Logic
- Calculate `phaseTotalDuration = totalEstimatedHours / 8` (hours to days)
- Calculate `expectedEndDate = effectiveStartDate + phaseTotalDuration`
- **Problem**: Dates were calculated on-the-fly, not stored
- **Problem**: Hours-to-days conversion was problematic (rounding, business days, etc.)

---

## The Problem

### Issues with Duration-Based Calculation

1. **Hours-to-Days Conversion Issues:**
   - `Math.ceil(totalEstimatedHours / 8)` doesn't account for weekends
   - Rounding errors (e.g., 9 hours = 2 days, but should be 1.125 days)
   - No way to handle actual vs estimated dates

2. **No Historical Tracking:**
   - Dates were calculated, not stored
   - Couldn't see when phases were originally estimated vs when they actually happened
   - No variance analysis possible

3. **Database Column Missing:**
   - At some point, `phaseTotalDuration` column didn't exist in database
   - Caused Prisma errors: `P2022: The column 'work_package_phases.phaseTotalDuration' does not exist`
   - Had to use `select` instead of `include` to avoid selecting non-existent column

---

## The Migration (Duration → Dates)

### Decision: Store Start/End Dates Instead

**Rationale:**
- Store actual `DateTime` values instead of calculating from duration
- Allows manual override of dates
- Enables historical tracking (estimated vs actual)
- Eliminates hours-to-days conversion issues

### New Schema (Current)
```prisma
model WorkPackagePhase {
  // Legacy field (kept for backward compatibility)
  phaseTotalDuration  Int? // normalized business days (backward compatibility)
  totalEstimatedHours Int? // Computed aggregate from items
  
  // NEW: Stored date fields (source of truth)
  estimatedStartDate DateTime? // Calculated: WorkPackage start + previous phases
  estimatedEndDate   DateTime? // Calculated: estimatedStartDate + phaseTotalDuration
  
  // NEW: Actual dates (set when work happens)
  actualStartDate DateTime? // Set when phase status → "in_progress"
  actualEndDate   DateTime? // Set when phase status → "completed"
}
```

---

## Current State (Hybrid)

### What We Have Now

**Both systems exist:**
- ✅ `phaseTotalDuration` - Still stored, marked as "backward compatibility"
- ✅ `estimatedStartDate` / `estimatedEndDate` - Stored DateTime fields (source of truth)
- ✅ `actualStartDate` / `actualEndDate` - Stored DateTime fields (actual dates)

### Current Logic (Confusing)

**The code still uses BOTH:**

1. **During Hydration** (`WorkPackageHydrationService.js`):
   - Still calls `upsertPhaseTotalDuration()` - **mutates** `phaseTotalDuration`
   - But also uses stored `estimatedStartDate` / `estimatedEndDate`

2. **During Calculation** (`PhaseDueDateService.js`):
   - `recalculateAllPhaseDates()` still uses `totalEstimatedHours / 8` to calculate `estimatedEndDate`
   - But also stores `estimatedStartDate` and `estimatedEndDate` in database

3. **Schema Comment**:
   - `estimatedEndDate` comment says: `// Calculated: estimatedStartDate + phaseTotalDuration`
   - But code actually uses: `estimatedStartDate + (totalEstimatedHours / 8)`

### The Confusion

**We're in a transition state:**
- `phaseTotalDuration` is marked as "backward compatibility" but still being updated
- Date fields exist but are still being calculated from hours
- No clear source of truth - using both duration AND dates

---

## What Should Happen

### The Goal (Pure Date-Based)

**Remove duration-based calculation entirely:**
- `phaseTotalDuration` should be **read-only** (for display only)
- `estimatedStartDate` and `estimatedEndDate` should be **manually set or shifted by date delta**
- When Phase N moves, shift Phase N+1, N+2, etc. by the same date delta
- **NO hours-to-days conversion** - pure date arithmetic

### The Fix (From Investigation)

**From `WORKPACKAGE_PHASE_DATE_INVESTIGATION.md`:**

1. **Remove** `upsertPhaseTotalDuration()` call from hydration
2. **Remove** hours-to-days conversion from `recalculateAllPhaseDates()`
3. **Implement** `shiftSubsequentPhases(phaseId, deltaDays)` - pure date delta
4. **Make** `phaseTotalDuration` display-only (calculated from `estimatedEndDate - estimatedStartDate` if needed)

---

## Timeline

### Phase 1: Original (Duration-Based)
- Only `phaseTotalDuration` field
- Calculate dates from duration
- **Problem**: Column missing, calculation issues

### Phase 2: Migration (Hybrid - Current State)
- Added `estimatedStartDate` / `estimatedEndDate` fields
- Kept `phaseTotalDuration` for "backward compatibility"
- Still calculating dates from hours
- **Problem**: Confusing, both systems active

### Phase 3: Target (Date-Based)
- `phaseTotalDuration` is read-only/display-only
- Dates are source of truth
- Pure date delta shifting
- **Goal**: Clean, simple, no hours logic

---

## Summary

**You're right** - there WAS an issue with `phaseTotalDuration` calculation, and we DID move to start/end dates. But we're currently in a **hybrid state** where:

- ✅ Date fields exist and are stored
- ❌ But we're still calculating them from hours
- ❌ `phaseTotalDuration` is still being updated
- ❌ No clear source of truth

**The fix** is to complete the migration:
- Make dates the source of truth
- Remove hours-to-days calculation
- Use pure date delta shifting
- Make `phaseTotalDuration` display-only

---

**Last Updated**: December 2024  
**Status**: In transition (hybrid state)  
**Target**: Pure date-based system

