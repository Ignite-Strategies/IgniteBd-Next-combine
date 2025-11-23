# Phase Completion System

## Overview
This document outlines the phase completion workflow and how the "current phase" is determined when hydrating work packages.

## Current Phase Logic

### Definition
The **current phase** is the first phase in the queue that is:
- `not_started` OR
- `in_progress`

If all phases are `completed`, there is no current phase.

### Hydration Behavior
When hydrating a work package:
1. Phases are sorted by `position` (ascending)
2. The first phase with status `not_started` or `in_progress` is marked as the current phase
3. This current phase is used for:
   - Client portal display ("Current Phase" section)
   - Owner app execution view
   - Progress tracking

### Implementation Location
- **Hydration Service**: `src/lib/services/WorkPackageHydrationService.js`
- **Client Portal**: `ignitebd-clientportal/app/dashboard/page.jsx`
- **Owner App**: `src/app/(authenticated)/client-operations/execution/page.jsx`

## Phase Completion Workflow

### Current State
- Phases have status: `not_started`, `in_progress`, `completed`
- When a phase is marked `completed`, `actualEndDate` is automatically set (if empty)
- No automatic progression to next phase

### Proposed: Phase Completion Bin/Archive

#### Option 1: Status-Based (Recommended)
- Keep completed phases in the same structure
- Mark as `completed` status
- Filter out from "active" views
- Keep in full work package view for history

**Pros:**
- Simple implementation
- No schema changes needed
- Easy to query (WHERE status != 'completed')
- Historical data preserved

**Cons:**
- All phases remain in main query results
- Need filtering logic in multiple places

#### Option 2: Archive Table
- Create `WorkPackagePhaseArchive` table
- Move completed phases to archive on completion
- Keep only active phases in main `WorkPackagePhase` table

**Pros:**
- Clean separation of active vs completed
- Smaller active phase queries
- Clear data model

**Cons:**
- Schema migration required
- More complex queries (need UNION for full history)
- Harder to restore if needed

#### Option 3: Soft Delete with Archive Flag
- Add `archivedAt` DateTime field to `WorkPackagePhase`
- Set `archivedAt = NOW()` when phase completes
- Filter by `archivedAt IS NULL` for active phases

**Pros:**
- No separate table needed
- Easy to query active vs archived
- Can restore by setting `archivedAt = NULL`
- Historical data preserved

**Cons:**
- Need to update all queries to filter archived
- Schema change required (but minimal)

### Recommended Approach: Option 3 (Soft Delete)

```prisma
model WorkPackagePhase {
  // ... existing fields
  archivedAt DateTime? // Set when phase is completed
}
```

**Query Pattern:**
```javascript
// Get active phases
phases: {
  where: { archivedAt: null },
  orderBy: { position: 'asc' }
}

// Get all phases (including archived)
phases: {
  orderBy: { position: 'asc' }
}
```

## Implementation Plan

### Step 1: Update Current Phase Logic
- [ ] Modify `WorkPackageHydrationService.js` to identify first `not_started` or `in_progress` phase
- [ ] Add `currentPhase` field to hydrated work package response
- [ ] Update client portal to use `currentPhase` from hydration

### Step 2: Phase Completion Flow
- [ ] Add "Complete Phase" button/action in PhaseCard
- [ ] When phase status changes to `completed`:
  - Set `actualEndDate = TODAY` (if empty)
  - Set `archivedAt = NOW()` (if using Option 3)
  - Trigger recalculation of subsequent phases (if needed)
- [ ] Auto-advance to next phase (optional):
  - If next phase exists and is `not_started`, optionally set to `in_progress`

### Step 3: Archive/Filter Logic
- [ ] Update all phase queries to filter archived phases for active views
- [ ] Keep full phase list in work package detail view
- [ ] Add "View Completed Phases" toggle in execution view

### Step 4: API Updates
- [ ] Update `PATCH /api/workpackages/phases/[phaseId]` to handle completion
- [ ] Add `archivedAt` to phase update logic
- [ ] Ensure hydration includes both active and archived phases (with flag)

## Questions to Resolve

1. **Auto-advance**: Should completing a phase automatically start the next phase?
   - Yes: Set next phase to `in_progress` and `actualStartDate = TODAY`
   - No: Next phase remains `not_started` until manually started

2. **Archive Timing**: When should a phase be archived?
   - Immediately on `completed` status
   - After a grace period (e.g., 7 days)
   - Never (keep all phases active, just filter by status)

3. **Item Completion**: Should phase completion require all items to be completed?
   - Yes: Block phase completion if items are incomplete
   - No: Allow phase completion regardless of item status

4. **Phase Restoration**: Can completed/archived phases be restored?
   - Yes: Allow un-archiving and status change back to `in_progress`
   - No: Completed phases are final

## Related Files

- `src/lib/services/WorkPackageHydrationService.js` - Phase hydration logic
- `src/components/execution/PhaseCard.jsx` - Phase UI component
- `src/app/api/workpackages/phases/[phaseId]/route.js` - Phase update API
- `ignitebd-clientportal/app/dashboard/page.jsx` - Client portal current phase display
- `prisma/schema.prisma` - Database schema

