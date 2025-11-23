# Project Status and Updates - Client Portal Hydration Investigation

## Overview

This document investigates the key pieces that hydrate the client portal, focusing on:
1. Priority Logic (prioritySummary)
2. WorkPackage/Item Status Update Engine
3. Effective Start Date + Estimated Due Date Logic
4. Final Consistency Check

---

## 1. PRIORITY LOGIC (workPackage.prioritySummary)

### ✅ Current Status: **IMPLEMENTED**

### Where prioritySummary comes from:
- **Database Field:** `WorkPackage.prioritySummary` (String, nullable)
- **Schema Location:** `prisma/schema.prisma` (IgniteBd-Next-combine)

### Where it's set:
- **Owner App UI:** `/src/app/(authenticated)/execution/page.jsx`
  - Textarea with `onBlur` handler
  - Calls `savePriority()` function
  - Line 187-202: Save function implementation

### Update Route:
- **✅ EXISTS:** `PATCH /api/workpackages/[id]`
  - **Location:** `src/app/api/workpackages/[id]/route.js`
  - **Line 140:** Accepts `prioritySummary` in request body
  - **Line 149:** Updates `prioritySummary` field
  - **Status:** ✅ Working

### Client Portal Receives prioritySummary:

#### ✅ `/api/client/allitems`
- **Location:** `ignitebd-clientportal/app/api/client/allitems/route.js`
- **Line 71:** Selects `prioritySummary` from WorkPackage
- **Line 217:** Returns in response: `prioritySummary: workPackage.prioritySummary || null`
- **Status:** ✅ Included

#### ✅ `/api/client/workpackage`
- **Location:** `ignitebd-clientportal/app/api/client/workpackage/route.js`
- **Line 67:** Selects `prioritySummary` from WorkPackage
- **Line 101:** Returns in response: `prioritySummary: true` (included in select)
- **Status:** ✅ Included

### Summary:
- ✅ Owner app UI includes prioritySummary editor
- ✅ Backend route exists and accepts updates
- ✅ Client portal receives prioritySummary in both routes
- **No patches needed** - fully implemented

---

## 2. WORKPACKAGE / ITEM STATUS UPDATE ENGINE

### Current Status: **PARTIALLY IMPLEMENTED**

### Owner-Side Update Routes:

#### ✅ WorkPackageItem Status Update:
- **Route:** `PATCH /api/workpackages/items/[itemId]`
  - **Location:** `src/app/api/workpackages/items/[itemId]/route.js`
  - **Line 126:** Accepts `status` in request body
  - **Line 154:** Updates item status
  - **Status:** ✅ Exists

- **Route:** `PATCH /api/workpackages/items/:id` (alternative)
  - **Location:** `src/app/api/workpackages/items/route.js`
  - **Line 126:** Accepts `status` in request body
  - **Line 154:** Updates item status
  - **Status:** ✅ Exists

#### ⚠️ Missing: Owner-Specific Routes
- **Expected:** `/api/owner/workpackages/*` - **NOT FOUND**
- **Expected:** `/api/owner/items/*` - **NOT FOUND**
- **Note:** Owner routes may use `/api/workpackages/*` directly (no `/owner` prefix)

### StatusMapperService Logic:

#### ✅ StatusMapperService Exists:
- **Location:** `ignitebd-clientportal/lib/services/StatusMapperService.js`
- **Function:** `mapItemStatus(item, workCollateral)`

#### Current Mapping Logic:
```javascript
export function mapItemStatus(item, workCollateral = []) {
  // If no collateral, use item.status
  if (!workCollateral.length) {
    return item.status?.toUpperCase() || "NOT_STARTED";
  }

  const statuses = workCollateral.map(
    c => (c.status || "NOT_STARTED").toUpperCase()
  );

  if (statuses.includes("NEEDS_REVIEW")) return "NEEDS_REVIEW";
  if (statuses.includes("IN_PROGRESS")) return "IN_PROGRESS";
  if (statuses.every(s => s === "COMPLETED")) return "COMPLETED";

  return "NOT_STARTED";
}
```

#### ⚠️ Issues Identified:

1. **StatusMapperService checks for "NEEDS_REVIEW" but:**
   - WorkCollateral schema shows: `status String // DRAFT | IN_REVIEW | APPROVED | COMPLETED`
   - **Missing:** `REVIEW_REQUESTED` status mapping
   - **Current:** Checks for "NEEDS_REVIEW" but WorkCollateral uses "IN_REVIEW"

2. **Status Mapping Mismatch:**
   - Expected: `if any workCollateral.status = REVIEW_REQUESTED → NEEDS_REVIEW`
   - Actual: Checks for "NEEDS_REVIEW" (doesn't exist in schema)
   - **Should check:** `IN_REVIEW` → `NEEDS_REVIEW`

3. **Missing Automatic Status Updates:**
   - No automatic status update when collateral is uploaded
   - No automatic status update when review is requested
   - No automatic status update when client approves

### Required Status Update Logic:

#### Expected Flow:
1. **Owner uploads draft** → `workCollateral.status = "DRAFT"` → `item.status = "IN_PROGRESS"`
2. **Owner requests client review** → `workCollateral.status = "IN_REVIEW"` → `item.status = "NEEDS_REVIEW"`
3. **Client approves** → `workCollateral.status = "APPROVED"` → `item.status = "COMPLETED"`

#### Current Status:
- ✅ StatusMapperService exists
- ⚠️ Status mapping needs correction (IN_REVIEW → NEEDS_REVIEW)
- ❌ No automatic status updates on collateral upload/review
- ❌ No automatic item.status update when workCollateral.status changes

### Patches Needed:

#### Patch 1: Fix StatusMapperService
```javascript
// ignitebd-clientportal/lib/services/StatusMapperService.js
export function mapItemStatus(item, workCollateral = []) {
  if (!workCollateral.length) {
    return item.status?.toUpperCase() || "NOT_STARTED";
  }

  const statuses = workCollateral.map(
    c => (c.status || "NOT_STARTED").toUpperCase()
  );

  // Fix: Check for IN_REVIEW (actual schema value) → NEEDS_REVIEW (client portal status)
  if (statuses.includes("IN_REVIEW")) return "NEEDS_REVIEW";
  if (statuses.includes("IN_PROGRESS")) return "IN_PROGRESS";
  if (statuses.every(s => s === "COMPLETED" || s === "APPROVED")) return "COMPLETED";

  return "NOT_STARTED";
}
```

#### Patch 2: Add Automatic Status Updates
**Location:** `src/app/api/workpackages/items/[itemId]/collateral/route.js` (or similar)

```javascript
// After creating/updating workCollateral, update item status
if (workCollateral.status === "DRAFT") {
  await prisma.workPackageItem.update({
    where: { id: itemId },
    data: { status: "in_progress" },
  });
}

if (workCollateral.status === "IN_REVIEW") {
  await prisma.workPackageItem.update({
    where: { id: itemId },
    data: { status: "needs_review" }, // Or keep as "in_progress" and let StatusMapper handle it
  });
}

if (workCollateral.status === "APPROVED" || workCollateral.status === "COMPLETED") {
  // Check if all collateral is approved
  const allCollateral = await prisma.workCollateral.findMany({
    where: { workPackageItemId: itemId },
  });
  
  if (allCollateral.every(c => c.status === "APPROVED" || c.status === "COMPLETED")) {
    await prisma.workPackageItem.update({
      where: { id: itemId },
      data: { status: "completed" },
    });
  }
}
```

---

## 3. EFFECTIVE START DATE + ESTIMATED DUE DATE LOGIC

### Current Status: **IMPLEMENTED** (with new enhancements)

### Fields Confirmed:

#### ✅ WorkPackage.effectiveStartDate
- **Location:** `prisma/schema.prisma`
- **Type:** `DateTime?` (nullable)
- **Status:** ✅ Exists

#### ✅ WorkPackagePhase.phaseTotalDuration
- **Location:** `prisma/schema.prisma`
- **Type:** `Int?` (nullable, business days)
- **Calculation:** `totalEstimatedHours / 8` (8 hours = 1 workday)
- **Status:** ✅ Exists

#### ✅ New Fields (Just Added):
- `WorkPackagePhase.estimatedStartDate` - Calculated from WorkPackage start + previous phases
- `WorkPackagePhase.estimatedEndDate` - Calculated: estimatedStartDate + phaseTotalDuration
- `WorkPackagePhase.actualStartDate` - Set when phase status → "in_progress"
- `WorkPackagePhase.actualEndDate` - Set when phase status → "completed"

### Service Implementation:

#### ✅ PhaseDueDateService
- **Location:** `src/lib/services/PhaseDueDateService.js`
- **Functions:**
  - `calculatePhaseEffectiveDate()` - Calculates phase start from WorkPackage start + previous phases
  - `calculatePhaseDueDate()` - Calculates phase end date
  - `recalculateAllPhaseDates()` - Recalculates all phases
  - `upsertWorkPackageEffectiveDate()` - Sets WorkPackage start date

#### ✅ WorkPackageHydrationService
- **Location:** `src/lib/services/WorkPackageHydrationService.js`
- **Uses actual dates when available** for progressive calculation
- **Line 145-187:** Progressive date calculation logic

### Client Portal Routes:

#### ⚠️ `/api/client/allitems` - **MISSING DATE FIELDS**
- **Current:** Returns `workPackage` with `prioritySummary` only
- **Missing:** `effectiveStartDate`, phase dates, expected due dates
- **Status:** ⚠️ Needs enhancement

#### ⚠️ `/api/client/workpackage` - **PARTIALLY IMPLEMENTED**
- **Line 103:** Selects `effectiveStartDate` ✅
- **Line 118-127:** Includes phases with items ✅
- **Missing:** Phase `estimatedStartDate`, `estimatedEndDate`, `actualStartDate`, `actualEndDate`
- **Missing:** Computed expected due dates for display
- **Status:** ⚠️ Needs enhancement

### Required Enhancements:

#### Patch 1: Add Date Fields to `/api/client/allitems`
```javascript
// ignitebd-clientportal/app/api/client/allitems/route.js
// In workPackage select (around line 65-75):
select: {
  id: true,
  title: true,
  description: true,
  prioritySummary: true,
  effectiveStartDate: true, // ADD THIS
  companyId: true,
  contactId: true,
},

// In allPhases select (around line 138-147):
select: {
  id: true,
  name: true,
  description: true,
  position: true,
  estimatedStartDate: true, // ADD THIS
  estimatedEndDate: true,   // ADD THIS
  actualStartDate: true,    // ADD THIS
  actualEndDate: true,      // ADD THIS
  phaseTotalDuration: true, // ADD THIS
},
```

#### Patch 2: Add Date Fields to `/api/client/workpackage`
```javascript
// ignitebd-clientportal/app/api/client/workpackage/route.js
// In phases include (around line 118-127):
phases: {
  include: {
    items: {
      include: {
        workCollateral: true,
      },
    },
  },
  select: {
    id: true,
    name: true,
    position: true,
    description: true,
    estimatedStartDate: true, // ADD THIS
    estimatedEndDate: true,   // ADD THIS
    actualStartDate: true,    // ADD THIS
    actualEndDate: true,      // ADD THIS
    phaseTotalDuration: true, // ADD THIS
  },
  orderBy: { position: 'asc' },
},
```

#### Patch 3: Add Computed Expected Due Date Service
**Location:** `ignitebd-clientportal/lib/services/PhaseDateService.js` (new file)

```javascript
/**
 * Calculate expected due date for a phase
 * Uses actualEndDate if available, otherwise estimatedEndDate
 */
export function getPhaseExpectedDueDate(phase) {
  if (phase.actualEndDate) {
    return new Date(phase.actualEndDate);
  }
  
  if (phase.estimatedEndDate) {
    return new Date(phase.estimatedEndDate);
  }
  
  // Calculate from effectiveStartDate + phaseTotalDuration
  if (phase.estimatedStartDate && phase.phaseTotalDuration) {
    const startDate = new Date(phase.estimatedStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + phase.phaseTotalDuration);
    return endDate;
  }
  
  return null;
}

/**
 * Format date for display with fallback messages
 */
export function formatPhaseDueDate(phase) {
  const dueDate = getPhaseExpectedDueDate(phase);
  
  if (!dueDate) {
    if (!phase.estimatedStartDate) {
      return "Start date not yet set";
    }
    if (!phase.phaseTotalDuration) {
      return "Duration pending";
    }
    return "Date calculation pending";
  }
  
  return dueDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
```

---

## 4. FINAL CONSISTENCY CHECK

### Dashboard Requirements:

#### ✅ Priority Summary
- **Status:** ✅ Implemented
- **Route:** `/api/client/allitems`
- **Field:** `workPackage.prioritySummary`
- **Display:** Should show in dashboard UI

#### ✅ "Needs Review" Items
- **Status:** ✅ Implemented
- **Route:** `/api/client/allitems`
- **Field:** `needsReviewItems` (array)
- **Logic:** Uses `StatusMapperService.mapItemStatus()`
- **Display:** Should show in dashboard UI

#### ⚠️ Current Phase → name + expected date + item list
- **Status:** ⚠️ Partially implemented
- **Route:** `/api/client/allitems`
- **Field:** `currentPhase` (object)
- **Includes:** `name`, `items` ✅
- **Missing:** `expectedDate` (estimatedEndDate or actualEndDate)
- **Fix:** Add date fields to phase select (see Patch 1 above)

### WorkPackage Detail Requirements:

#### ✅ Full Hydration
- **Status:** ✅ Implemented
- **Route:** `/api/client/workpackage`
- **Includes:** Full WorkPackage with phases, items, workCollateral

#### ✅ Accurate Status from StatusMapper
- **Status:** ⚠️ Needs fix
- **Issue:** StatusMapper checks for "NEEDS_REVIEW" but WorkCollateral uses "IN_REVIEW"
- **Fix:** Update StatusMapperService (see Patch 1 in Section 2)

#### ⚠️ Computed Due Date
- **Status:** ⚠️ Partially implemented
- **Missing:** Phase date fields in response
- **Missing:** Computed expected due date service
- **Fix:** Add date fields and service (see Patches 2-3 in Section 3)

---

## Summary of Required Changes

### High Priority:

1. **Fix StatusMapperService** (Section 2, Patch 1)
   - Change "NEEDS_REVIEW" check to "IN_REVIEW"
   - Update completed check to include "APPROVED"

2. **Add Date Fields to Client Portal Routes** (Section 3, Patches 1-2)
   - Add `effectiveStartDate` to `/api/client/allitems`
   - Add phase date fields to both routes
   - Add `phaseTotalDuration` to phase selects

3. **Add Computed Due Date Service** (Section 3, Patch 3)
   - Create `PhaseDateService.js` in client portal
   - Implement `getPhaseExpectedDueDate()` and `formatPhaseDueDate()`

### Medium Priority:

4. **Add Automatic Status Updates** (Section 2, Patch 2)
   - Update item status when collateral is uploaded
   - Update item status when review is requested
   - Update item status when client approves

### Low Priority:

5. **Enhance Current Phase Display**
   - Add expected date to current phase in dashboard
   - Format dates consistently across UI

---

## Code Changes Summary

### Files to Modify:

1. **ignitebd-clientportal/lib/services/StatusMapperService.js**
   - Fix status mapping logic

2. **ignitebd-clientportal/app/api/client/allitems/route.js**
   - Add date fields to WorkPackage and Phase selects

3. **ignitebd-clientportal/app/api/client/workpackage/route.js**
   - Add date fields to Phase select

4. **ignitebd-clientportal/lib/services/PhaseDateService.js** (NEW)
   - Create service for computing and formatting phase dates

5. **src/app/api/workpackages/items/[itemId]/collateral/route.js** (or similar)
   - Add automatic status updates when collateral is created/updated

### Verification Checklist:

- [ ] Priority Summary displays in dashboard
- [ ] "Needs Review" items show correctly
- [ ] Current Phase shows name, expected date, and items
- [ ] WorkPackage detail shows full hydration
- [ ] Status mapping works correctly (IN_REVIEW → NEEDS_REVIEW)
- [ ] Phase dates display correctly with fallback messages
- [ ] Automatic status updates work when collateral changes

---

## End-to-End Hydration Flow Verification

### Owner App → Client Portal Flow:

1. **Owner sets prioritySummary**
   - ✅ Owner UI: `/execution` page
   - ✅ API: `PATCH /api/workpackages/[id]`
   - ✅ Client receives: `/api/client/allitems` and `/api/client/workpackage`

2. **Owner updates item status**
   - ✅ Owner API: `PATCH /api/workpackages/items/[itemId]`
   - ⚠️ Client receives: Status via StatusMapperService (needs fix)

3. **Owner uploads collateral**
   - ⚠️ Missing: Automatic status update
   - ✅ Client receives: Status via StatusMapperService (needs fix)

4. **Owner sets effectiveStartDate**
   - ✅ Owner API: `PATCH /api/workpackages/[id]` with `effectiveStartDate`
   - ✅ Service: `PhaseDueDateService` calculates phase dates
   - ⚠️ Client receives: Dates not included in client routes (needs fix)

5. **Client views dashboard**
   - ✅ Receives: `prioritySummary`, `needsReviewItems`, `currentPhase`
   - ⚠️ Missing: Phase expected dates

6. **Client views work package detail**
   - ✅ Receives: Full WorkPackage with phases, items, workCollateral
   - ⚠️ Missing: Phase date fields

---

## Next Steps

1. **Immediate:** Apply high-priority patches (StatusMapper fix, date fields)
2. **Short-term:** Add computed due date service
3. **Medium-term:** Implement automatic status updates
4. **Long-term:** Enhance UI to display all date information

---

## Notes

- The owner app uses `/api/workpackages/*` routes directly (no `/owner` prefix)
- Client portal uses `/api/client/*` routes
- StatusMapperService is the single source of truth for status mapping
- Phase dates are now stored in database (estimatedStartDate, estimatedEndDate, actualStartDate, actualEndDate)
- Progressive calculation uses actual dates when available

