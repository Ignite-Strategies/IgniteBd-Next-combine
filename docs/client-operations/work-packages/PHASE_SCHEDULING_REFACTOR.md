# WorkPackagePhase Scheduling System Refactor

**Date**: December 2024  
**Goal**: Clean, predictable, fully DB-backed phase timeline

---

## Core Principles

1. **Database is source of truth** - All dates stored, no derived calculations
2. **estimatedStartDate/estimatedEndDate are the real schedule** - Users edit these directly
3. **phaseTotalDuration is a helper** - Can be overridden, never auto-restored from hours
4. **Delta-shift algorithm** - When Phase N moves, shift Phase N+1, N+2, etc. by same delta
5. **Actual dates are independent** - Manual checkpoints, never affected by estimated changes
6. **Hydration is read-only** - Never mutates database

---

## Database Schema (Source of Truth)

```prisma
model WorkPackagePhase {
  // Schedule (source of truth)
  estimatedStartDate DateTime? // User-editable, defines planned timeline
  estimatedEndDate   DateTime? // User-editable, defines planned timeline
  
  // Helper fields
  phaseTotalDuration Int?      // Auto-set from hours initially, but user can override
  totalEstimatedHours Int?     // Read-only baseline (for variance reporting in MVP2)
  
  // Actuals (independent checkpoints)
  actualStartDate DateTime?    // Set when status → "in_progress" (if empty)
  actualEndDate   DateTime?    // Set when status → "completed" (if empty)
  
  // Status
  status String? // "not_started" | "in_progress" | "completed"
}
```

---

## Editing Rules

### Path 1: Edit Duration
1. User edits `phaseTotalDuration`
2. Calculate: `newEstimatedEndDate = estimatedStartDate + phaseTotalDuration`
3. Calculate delta: `deltaDays = newEstimatedEndDate - oldEstimatedEndDate`
4. Shift subsequent phases by delta

### Path 2: Edit End Date
1. User edits `estimatedEndDate`
2. Calculate: `newPhaseTotalDuration = estimatedEndDate - estimatedStartDate`
3. Update `phaseTotalDuration` to match
4. Calculate delta: `deltaDays = newEstimatedEndDate - oldEstimatedEndDate`
5. Shift subsequent phases by delta

### Path 3: Edit Start Date
1. User edits `estimatedStartDate`
2. Calculate delta: `deltaDays = newEstimatedStartDate - oldEstimatedStartDate`
3. Shift subsequent phases by delta
4. Optionally recalc `phaseTotalDuration` if end date unchanged

### Path 4: Edit Status
1. If status → "in_progress" AND `actualStartDate` is empty → set `actualStartDate = TODAY`
2. If status → "completed" AND `actualEndDate` is empty → set `actualEndDate = TODAY`
3. **DO NOT** shift phases
4. **DO NOT** touch estimated dates

---

## Delta-Shift Algorithm

```javascript
/**
 * Shift all phases after the given phase by deltaDays
 * Pure date arithmetic - no hours conversion, no business-day logic
 */
async function shiftSubsequentPhases(phaseId, deltaDays) {
  // Get current phase to find position
  const currentPhase = await prisma.workPackagePhase.findUnique({
    where: { id: phaseId },
    select: { position: true, workPackageId: true },
  });
  
  if (!currentPhase) return;
  
  // Get all subsequent phases
  const subsequentPhases = await prisma.workPackagePhase.findMany({
    where: {
      workPackageId: currentPhase.workPackageId,
      position: { gt: currentPhase.position },
    },
  });
  
  // Shift each phase by delta
  await Promise.all(
    subsequentPhases.map(phase => {
      const updates = {};
      
      if (phase.estimatedStartDate) {
        const newStart = new Date(phase.estimatedStartDate);
        newStart.setDate(newStart.getDate() + deltaDays);
        updates.estimatedStartDate = newStart;
      }
      
      if (phase.estimatedEndDate) {
        const newEnd = new Date(phase.estimatedEndDate);
        newEnd.setDate(newEnd.getDate() + deltaDays);
        updates.estimatedEndDate = newEnd;
      }
      
      if (Object.keys(updates).length > 0) {
        return prisma.workPackagePhase.update({
          where: { id: phase.id },
          data: updates,
        });
      }
    })
  );
}
```

---

## Refactor Tasks

### 1. PhaseDueDateService.js

**Remove:**
- `recalculateAllPhaseDates()` - full recalculation logic
- Hours-to-days conversion in date calculations
- Any logic that recalculates from hours

**Add:**
- `shiftSubsequentPhases(phaseId, deltaDays)` - pure date delta shifting
- `calculateDurationFromDates(startDate, endDate)` - helper for duration recalculation
- `updatePhaseDates(phaseId, updates)` - handles date/duration updates with delta shifting

**Keep:**
- `updatePhaseDatesFromStatus()` - sets actual dates on status change (correct)

### 2. WorkPackageHydrationService.js

**Remove:**
- `upsertPhaseTotalDuration()` call (line 80)
- Phase 1 `estimatedStartDate` mutation (lines 94-108)
- Any database mutations during hydration

**Keep:**
- Read-only date loading
- Calculated fields for UI (read-only, not stored)

### 3. Phase Update Route (`/api/workpackages/phases/[phaseId]/route.js`)

**Remove:**
- `recalculateAllPhaseDates()` calls
- Hours-based calculations

**Add:**
- Delta calculation when dates/duration change
- Call `shiftSubsequentPhases()` instead of full recalculation
- Handle both editing paths (duration vs end date)

### 4. WorkPackage Effective Date Update

**When `effectiveStartDate` changes:**
- Update Phase 1 `estimatedStartDate = effectiveStartDate`
- Calculate delta from old Phase 1 start
- Shift subsequent phases by delta

---

## Implementation Checklist

- [ ] Refactor `PhaseDueDateService.js`
  - [ ] Remove `recalculateAllPhaseDates()`
  - [ ] Add `shiftSubsequentPhases()`
  - [ ] Add `updatePhaseDates()` with delta logic
  - [ ] Keep `updatePhaseDatesFromStatus()` as-is

- [ ] Refactor `WorkPackageHydrationService.js`
  - [ ] Remove all database mutations
  - [ ] Make 100% read-only

- [ ] Update Phase PATCH route
  - [ ] Handle duration editing path
  - [ ] Handle end date editing path
  - [ ] Handle start date editing path
  - [ ] Call `shiftSubsequentPhases()` instead of full recalculation

- [ ] Update WorkPackage PATCH route
  - [ ] When `effectiveStartDate` changes, update Phase 1 and shift subsequent

- [ ] Remove `PhaseDurationService` usage from hydration
  - [ ] Keep service for item updates only (not hydration)

- [ ] Test all editing paths
  - [ ] Edit duration → shifts subsequent phases
  - [ ] Edit end date → recalculates duration, shifts subsequent
  - [ ] Edit start date → shifts subsequent phases
  - [ ] Edit status → sets actual dates, no phase shifting

---

**Status**: Planning Complete, Ready for Implementation

