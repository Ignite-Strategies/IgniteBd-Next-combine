# Date Logic in WorkPackage

## Overview

This document explains how dates flow through the WorkPackage system, from the WorkPackage effective start date down to individual phase due dates and timeline status calculations.

---

## 1. Setting Effective Date

### WorkPackage Level

**Field:** `WorkPackage.effectiveStartDate`

**Purpose:** The starting date for the entire work package. This is the anchor point for all phase date calculations.

**How to Set:**
```javascript
// Using the service
import { upsertWorkPackageEffectiveDate } from '@/lib/services/PhaseDueDateService';

await upsertWorkPackageEffectiveDate(workPackageId, '2024-11-10');
```

**Current Action Required:**
- ✅ Need to upsert `effectiveStartDate` to **November 10, 2024** for current work packages
- This can be done via API: `PATCH /api/workpackages/{id}` with `{ effectiveStartDate: "2024-11-10" }`

**Service:** `PhaseDueDateService.upsertWorkPackageEffectiveDate()`
- Updates the WorkPackage effectiveStartDate
- Automatically triggers recalculation of all phase dates

---

## 2. How Effective Date Flows to Phases

### Phase Effective Date Calculation (Progressive with Actual Dates)

**Formula:**
```
Phase Effective Date = 
  - If phase has actualStartDate: use actualStartDate
  - Otherwise: WorkPackage effectiveStartDate + cumulative days from previous phases
  - Previous phases use actualEndDate if available, otherwise estimatedEndDate
```

**Progressive Logic (Uses Actual Dates When Available):**
1. **Phase 1** starts on `WorkPackage.effectiveStartDate` (or `actualStartDate` if set)
2. **Phase 2** starts the day after Phase 1's **actualEndDate** (if completed) or **estimatedEndDate** (if not)
3. **Phase 3** starts the day after Phase 2's **actualEndDate** (if completed) or **estimatedEndDate** (if not)
4. And so on...

**Key Principle:** **Actual dates take precedence for progressive calculation**
- If a phase actually started later → subsequent phases adjust accordingly
- If a phase finished early/late → subsequent phases start from actual end date

**Calculation:**
```javascript
function calculatePhaseEffectiveDate(workPackageStartDate, allPhases, currentPhasePosition) {
  let currentDate = new Date(workPackageStartDate);
  
  // Find all phases before current phase
  const previousPhases = allPhases.filter(p => p.position < currentPhasePosition);
  
  // Add cumulative days from previous phases
  // Use actual dates when available for progressive calculation
  previousPhases.forEach(phase => {
    // If phase has actualEndDate (completed), use it
    if (phase.actualEndDate) {
      currentDate = new Date(phase.actualEndDate);
      currentDate.setDate(currentDate.getDate() + 1);
    } 
    // Otherwise, use estimated duration
    else {
      const days = phase.phaseTotalDuration || Math.ceil(phase.totalEstimatedHours / 8);
      currentDate.setDate(currentDate.getDate() + days);
    }
  });
  
  return currentDate;
}
```

**Example with Actual Dates:**
- WorkPackage effectiveStartDate: **Nov 10, 2024**
- Phase 1: 16 hours = 2 days
  - Estimated end: **Nov 12, 2024**
  - **Actual end: Nov 14, 2024** (2 days late)
- Phase 2: starts **Nov 15, 2024** (day after Phase 1's **actual** end, not estimated)
- Phase 2: 24 hours = 3 days
  - Estimated end: **Nov 18, 2024** (based on actual start)
  - **Actual end: Nov 17, 2024** (1 day early)
- Phase 3: starts **Nov 18, 2024** (day after Phase 2's **actual** end)

---

## 3. Phase Due Date (Expected End Date)

### Calculation

**Formula:**
```
Phase Expected End Date = Phase Effective Date + (totalEstimatedHours / 8 days)
```

**Logic:**
- `totalEstimatedHours` = sum of `(estimatedHoursEach * quantity)` for all items in phase
- Convert hours to business days: `days = Math.ceil(totalEstimatedHours / 8)`
- Add days to phase effective date

**Service:** `PhaseDueDateService.calculatePhaseDueDate()`

**Example:**
- Phase effective date: **Nov 13, 2024**
- Phase totalEstimatedHours: **24 hours**
- Days: `24 / 8 = 3 days`
- Expected end date: **Nov 16, 2024**

---

## 4. Timeline Status: "On Track" vs "Not On Track"

### Status Calculation

**Service:** `workPackageTimeline.computePhaseTimelineStatus()`

**Status Values:**
- `"complete"` - Phase is completed
- `"overdue"` - Today > expectedEndDate (past due)
- `"warning"` - Within 3 days of expectedEndDate (approaching deadline)
- `"on_track"` - More than 3 days until expectedEndDate (on schedule)

**Logic:**
```javascript
function computePhaseTimelineStatus(phaseStatus, expectedEndDate) {
  // If phase is completed, always "complete"
  if (phaseStatus === 'completed') return 'complete';
  
  // If no expected end date, can't determine status
  if (!expectedEndDate) return 'on_track';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endDate = new Date(expectedEndDate);
  endDate.setHours(0, 0, 0, 0);
  
  const daysDiff = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));
  
  if (daysDiff < 0) return 'overdue';      // Past due
  if (daysDiff <= 3) return 'warning';     // Within 3 days
  return 'on_track';                        // More than 3 days away
}
```

**Visual Indicators:**
- 🟢 **On Track** (green) - `bg-green-100 text-green-800`
- 🟡 **Warning** (yellow) - `bg-yellow-100 text-yellow-800`
- 🔴 **Overdue** (red) - `bg-red-100 text-red-800`
- ⚪ **Complete** (gray) - `bg-gray-100 text-gray-800`

---

## 5. Data Flow Diagram

```
WorkPackage.effectiveStartDate (Nov 10, 2024)
    ↓
Phase 1:
  - effectiveDate = Nov 10, 2024
  - totalEstimatedHours = 16 hours
  - phaseTotalDuration = 2 days (16 / 8)
  - expectedEndDate = Nov 12, 2024
  - timelineStatus = compare(today, Nov 12, 2024)
    ↓
Phase 2:
  - effectiveDate = Nov 13, 2024 (day after Phase 1 ends)
  - totalEstimatedHours = 24 hours
  - phaseTotalDuration = 3 days (24 / 8)
  - expectedEndDate = Nov 16, 2024
  - timelineStatus = compare(today, Nov 16, 2024)
    ↓
Phase 3:
  - effectiveDate = Nov 17, 2024 (day after Phase 2 ends)
  - ...
```

---

## 6. Services & Functions

### PhaseDueDateService

**Location:** `src/lib/services/PhaseDueDateService.js`

**Functions:**
1. `calculatePhaseEffectiveDate()` - Calculates phase start date from WorkPackage start + previous phases
2. `calculatePhaseDueDate()` - Calculates phase end date from effective date + hours
3. `recalculateAllPhaseDates()` - Recalculates all phases when WorkPackage start date changes
4. `upsertWorkPackageEffectiveDate()` - Sets WorkPackage start date and triggers recalculation

### WorkPackageTimeline Utils

**Location:** `src/lib/utils/workPackageTimeline.js`

**Functions:**
1. `convertHoursToDays()` - Converts hours to business days (hours / 8)
2. `computeExpectedEndDate()` - Calculates expected end date
3. `computePhaseTimelineStatus()` - Determines on_track/overdue/warning status
4. `getTimelineStatusColor()` - Returns Tailwind classes for UI

---

## 7. When Dates Are Recalculated

### Automatic Recalculation

Dates are automatically recalculated when:

1. **WorkPackage hydration** (`WorkPackageHydrationService.hydrateWorkPackage()`)
   - Calculates phase effective dates
   - Calculates expected end dates
   - Calculates timeline status

2. **WorkPackage effectiveStartDate changes**
   - Via `PhaseDueDateService.upsertWorkPackageEffectiveDate()`
   - Triggers `recalculateAllPhaseDates()`

3. **Phase totalEstimatedHours changes**
   - When items are added/updated/removed
   - Via `PhaseDurationService.upsertPhaseTotalDuration()`
   - Recalculates phaseTotalDuration and expectedEndDate

### Manual Recalculation

```javascript
import { recalculateAllPhaseDates } from '@/lib/services/PhaseDueDateService';

// Recalculate all phases for a work package
await recalculateAllPhaseDates(workPackageId);
```

---

## 8. Current Implementation Status

### ✅ Implemented

- Phase effective date calculation (cumulative from previous phases)
- Phase expected end date calculation (effectiveDate + hours/8)
- Timeline status calculation (on_track/overdue/warning/complete)
- PhaseTotalDuration calculation (hours / 8)
- Automatic recalculation during hydration

### 🔧 Needs Action

1. **Upsert effectiveStartDate to Nov 10, 2024**
   ```javascript
   // For all current work packages
   await upsertWorkPackageEffectiveDate(workPackageId, '2024-11-10');
   ```

2. **Ensure phaseTotalDuration is stored in database**
   - Already handled by `PhaseDurationService`
   - Runs automatically during hydration

3. **Display timeline status in UI**
   - Status is calculated in hydration
   - Need to display in execution dashboard

---

## 9. API Endpoints

### Update WorkPackage Effective Start Date

```http
PATCH /api/workpackages/{id}
Content-Type: application/json

{
  "effectiveStartDate": "2024-11-10"
}
```

### Get WorkPackage with Timeline

```http
GET /api/workpackages/{id}/hydrate
```

**Response includes:**
```json
{
  "workPackage": {
    "effectiveStartDate": "2024-11-10T00:00:00.000Z",
    "phases": [
      {
        "id": "...",
        "name": "Phase 1",
        "position": 1,
        "totalEstimatedHours": 16,
        "phaseTotalDuration": 2,
        "effectiveDate": "2024-11-10T00:00:00.000Z",
        "expectedEndDate": "2024-11-12T00:00:00.000Z",
        "timelineStatus": "on_track"
      }
    ]
  }
}
```

---

## 10. Example: Complete Flow

### Scenario
- WorkPackage effectiveStartDate: **Nov 10, 2024**
- Phase 1: 16 hours (2 days)
- Phase 2: 24 hours (3 days)
- Phase 3: 8 hours (1 day)

### Calculation

**Phase 1:**
- effectiveDate: Nov 10, 2024
- phaseTotalDuration: 2 days
- expectedEndDate: Nov 12, 2024
- If today is Nov 11: `timelineStatus = "on_track"` (1 day remaining)
- If today is Nov 13: `timelineStatus = "overdue"` (1 day past)

**Phase 2:**
- effectiveDate: Nov 13, 2024 (day after Phase 1 ends)
- phaseTotalDuration: 3 days
- expectedEndDate: Nov 16, 2024
- If today is Nov 14: `timelineStatus = "on_track"` (2 days remaining)
- If today is Nov 15: `timelineStatus = "warning"` (1 day remaining, within 3 days)

**Phase 3:**
- effectiveDate: Nov 17, 2024 (day after Phase 2 ends)
- phaseTotalDuration: 1 day
- expectedEndDate: Nov 18, 2024
- If today is Nov 17: `timelineStatus = "warning"` (1 day remaining, within 3 days)

---

## 11. Modifying Timeline Status Logic

### Current Thresholds

- **Overdue:** `daysDiff < 0` (past due)
- **Warning:** `daysDiff <= 3` (within 3 days)
- **On Track:** `daysDiff > 3` (more than 3 days)

### To Modify

Edit `src/lib/utils/workPackageTimeline.js`:

```javascript
export function computePhaseTimelineStatus(phaseStatus, expectedEndDate) {
  if (phaseStatus === 'completed') return 'complete';
  if (!expectedEndDate) return 'on_track';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(expectedEndDate);
  endDate.setHours(0, 0, 0, 0);
  const daysDiff = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));

  // Modify these thresholds as needed
  const WARNING_THRESHOLD = 3; // days
  const OVERDUE_THRESHOLD = 0;

  if (daysDiff < OVERDUE_THRESHOLD) return 'overdue';
  if (daysDiff <= WARNING_THRESHOLD) return 'warning';
  return 'on_track';
}
```

### Suggested Modifications

1. **Increase warning threshold to 7 days:**
   ```javascript
   if (daysDiff <= 7) return 'warning';
   ```

2. **Add "critical" status for 1 day or less:**
   ```javascript
   if (daysDiff <= 1) return 'critical';
   if (daysDiff <= 3) return 'warning';
   ```

3. **Add percentage-based thresholds:**
   ```javascript
   // Warning if within 20% of total duration
   const totalDuration = phaseTotalDuration;
   const percentRemaining = (daysDiff / totalDuration) * 100;
   if (percentRemaining <= 20) return 'warning';
   ```

---

## 12. Database Schema

### Current Schema

#### WorkPackage
```prisma
model WorkPackage {
  id                String   @id @default(cuid())
  contactId         String
  effectiveStartDate DateTime? // Anchor date for all phases
  // ...
}
```

#### WorkPackagePhase (Current)
```prisma
model WorkPackagePhase {
  id                  String      @id @default(cuid())
  workPackageId       String
  name                String
  position            Int
  description         String?
  phaseTotalDuration  Int?        // Calculated: totalEstimatedHours / 8
  totalEstimatedHours Int?         // Sum of item hours
  createdAt           DateTime @default(now())
  // ...
}
```

**Current State:** `effectiveDate`, `expectedEndDate`, and `timelineStatus` are **calculated fields**, not stored in the database. They are computed during hydration.

---

### Proposed Enhanced Schema (Estimated vs Actual)

To track both estimated and actual dates, we should add these fields to `WorkPackagePhase`:

```prisma
model WorkPackagePhase {
  id                  String      @id @default(cuid())
  workPackageId       String
  name                String
  position            Int
  description         String?
  
  // Duration fields
  phaseTotalDuration  Int?        // Calculated: totalEstimatedHours / 8 (business days)
  totalEstimatedHours Int?         // Sum of item hours
  
  // Estimated dates (calculated from WorkPackage effectiveStartDate)
  estimatedStartDate  DateTime?   // Calculated: WorkPackage start + previous phases
  estimatedEndDate    DateTime?   // Calculated: estimatedStartDate + phaseTotalDuration
  
  // Actual dates (set when work begins/completes)
  actualStartDate     DateTime?   // Set when phase status changes to "in_progress"
  actualEndDate       DateTime?   // Set when phase status changes to "completed"
  
  // Status tracking
  status              String?     // not_started | in_progress | completed
  
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  items               WorkPackageItem[]
  
  @@unique([workPackageId, name, position])
  @@index([workPackageId])
  @@index([position])
  @@map("work_package_phases")
}
```

### Benefits of Storing Estimated vs Actual Dates

1. **Historical Tracking:** Can see when phases actually started vs when they were estimated to start
2. **Variance Analysis:** Calculate delays: `actualStartDate - estimatedStartDate`
3. **Performance Metrics:** Track if phases finish early/late: `actualEndDate - estimatedEndDate`
4. **Timeline Adjustments:** When actual dates differ, can adjust subsequent phase estimates
5. **Reporting:** Generate reports showing estimated vs actual timelines

### Implementation Strategy

**Phase 1: Add Estimated Dates (Calculated & Stored)**
- Calculate `estimatedStartDate` and `estimatedEndDate` during hydration
- Store them in the database for historical reference
- Update when WorkPackage `effectiveStartDate` changes

**Phase 2: Add Actual Dates (User-Set)**
- `actualStartDate`: Set automatically when phase status → "in_progress"
- `actualEndDate`: Set automatically when phase status → "completed"
- Allow manual override if needed

**Phase 3: Timeline Status Enhancement**
- Compare `actualEndDate` vs `estimatedEndDate` for variance
- Show "ahead of schedule" if `actualEndDate < estimatedEndDate`
- Show "behind schedule" if `actualEndDate > estimatedEndDate` (and not completed)

### Migration Path

```sql
-- Add new date fields to work_package_phases table
ALTER TABLE work_package_phases 
  ADD COLUMN estimated_start_date TIMESTAMP,
  ADD COLUMN estimated_end_date TIMESTAMP,
  ADD COLUMN actual_start_date TIMESTAMP,
  ADD COLUMN actual_end_date TIMESTAMP,
  ADD COLUMN status VARCHAR(50);

-- Backfill estimated dates for existing phases
-- (Run via service that calculates from WorkPackage effectiveStartDate)
```

### Service Updates Needed

1. **PhaseDueDateService** - Calculate and store `estimatedStartDate` and `estimatedEndDate`
2. **PhaseStatusService** - Set `actualStartDate`/`actualEndDate` when status changes
3. **WorkPackageHydrationService** - Include actual dates in hydration response
4. **TimelineStatusService** - Compare actual vs estimated for variance reporting

---

## Summary

1. **Set effectiveStartDate** on WorkPackage (upsert to Nov 10, 2024)
2. **Phase effectiveDate** = WorkPackage start + cumulative previous phase days
   - **Uses actual dates when available** for progressive calculation
   - If previous phase has `actualEndDate`, use it; otherwise use `estimatedEndDate`
3. **Phase expectedEndDate** = effectiveDate + (totalEstimatedHours / 8 days)
   - **Uses actualEndDate** if phase is completed
4. **Timeline status** = compare today vs expectedEndDate (on_track/overdue/warning/complete)
5. **Automatic recalculation** happens during hydration
6. **Dates are stored** in database (estimatedStartDate, estimatedEndDate, actualStartDate, actualEndDate)
7. **Progressive calculation** automatically adjusts based on actual progress
8. **Modify thresholds** in `workPackageTimeline.js` to change status logic

## Key Benefits of Storing Dates

✅ **Solves hydration issues** - Dates are stored, not recalculated every time
✅ **Progressive calculation** - Uses actual dates when available for accurate timeline
✅ **Historical tracking** - Can see when phases actually started vs estimated
✅ **Variance analysis** - Calculate delays and early completions
✅ **Overwrite capability** - Manual date adjustments when needed

