# Phase Duration Calculation Guide

**Date**: December 2024  
**Purpose**: When and how to calculate `phaseTotalDuration`

---

## Overview

`phaseTotalDuration` is a helper field that stores the duration in days. It can be:
- **Auto-calculated** from `totalEstimatedHours` (initially)
- **User-overridden** (once set, never auto-restored from hours)

---

## When to Calculate `phaseTotalDuration`

### ✅ Calculate When:

1. **One-Time Migration** (for existing phases)
   - Run `scripts/calculate-phase-durations.js` once
   - Calculates from `totalEstimatedHours` for all existing phases

2. **When Items Are Added/Updated/Deleted**
   - `totalEstimatedHours` changes → recalculate `phaseTotalDuration`
   - **Location**: Item API routes (`/api/workpackages/items/*`)
   - **Service**: `PhaseDurationService.upsertPhaseTotalDuration()`

3. **When Phase Has No Duration But Has Hours**
   - If `phaseTotalDuration` is null but `totalEstimatedHours` exists
   - Calculate: `phaseTotalDuration = Math.ceil(totalEstimatedHours / 8)`

### ❌ Do NOT Calculate When:

1. **During Hydration** ❌
   - Hydration is read-only
   - Do not mutate database during hydration

2. **When User Edits Duration** ❌
   - If user manually sets `phaseTotalDuration`, never override it
   - User override takes precedence

3. **When Dates Change** ❌
   - Date changes don't affect duration calculation
   - Duration is independent of dates

---

## Calculation Formula

```javascript
phaseTotalDuration = Math.ceil(totalEstimatedHours / 8)
```

- **8 hours = 1 business day**
- Always rounds up (Math.ceil)
- Example: 9 hours = 2 days, 16 hours = 2 days

---

## One-Time Migration

### Run the Script

```bash
# Option 1: With DATABASE_URL in command
DATABASE_URL="your-database-url" node scripts/calculate-phase-durations.js

# Option 2: With .env.local
# (Make sure DATABASE_URL is in .env.local)
node scripts/calculate-phase-durations.js
```

### What It Does

1. Gets all phases with their items
2. Calculates `totalEstimatedHours` from items
3. Calculates `phaseTotalDuration = Math.ceil(totalEstimatedHours / 8)`
4. Updates phases where:
   - `totalEstimatedHours` has changed, OR
   - `phaseTotalDuration` is null and we have hours

### Output

```
🚀 Starting phaseTotalDuration calculation...

Found 15 phases to process

✅ Phase abc123 (Phase 1): hours=16, duration=2 days
✅ Phase def456 (Phase 2): hours=24, duration=3 days
⏭️  Phase ghi789 (Phase 3): Skipped (hours=0, duration=null)

📊 Summary:
   ✅ Updated: 12
   ⏭️  Skipped: 3
   ❌ Errors: 0
   📦 Total: 15

✅ Migration complete!
```

---

## Ongoing Updates (Item Changes)

### When Items Are Created/Updated/Deleted

**Location**: `src/app/api/workpackages/items/route.js`, `src/app/api/workpackages/items/[itemId]/route.js`

**Current Logic** (keep this):
```javascript
// After item create/update/delete
const allItems = await getPhaseItems(phaseId);
const totalEstimatedHours = calculateTotalHours(allItems);
const phaseTotalDuration = Math.ceil(totalEstimatedHours / 8);

await prisma.workPackagePhase.update({
  where: { id: phaseId },
  data: {
    totalEstimatedHours,
    phaseTotalDuration, // Update duration when hours change
  },
});
```

**This is correct** - items changing should update duration.

---

## User Override Behavior

### Once User Sets Duration

If user manually edits `phaseTotalDuration`:
- **Never auto-restore** from hours
- User value takes precedence
- Only recalculate if user explicitly requests it

### Implementation

In `updatePhaseDates()`:
```javascript
// If user provides phaseTotalDuration, use it directly
if (updates.phaseTotalDuration !== undefined) {
  updateData.phaseTotalDuration = updates.phaseTotalDuration;
  // Do NOT recalculate from hours
}
```

---

## Summary

| Scenario | Calculate Duration? | Method |
|----------|---------------------|--------|
| One-time migration | ✅ Yes | Run `scripts/calculate-phase-durations.js` |
| Item added/updated/deleted | ✅ Yes | `PhaseDurationService.upsertPhaseTotalDuration()` |
| User edits duration | ❌ No | Use user value, never override |
| During hydration | ❌ No | Read-only, no mutations |
| Date changes | ❌ No | Duration independent of dates |

---

## Checklist

- [ ] Run one-time migration script for existing phases
- [ ] Verify item routes update duration when items change
- [ ] Ensure hydration does NOT update duration
- [ ] Test user override (duration should not be auto-restored)

---

**Last Updated**: December 2024  
**Status**: Ready for one-time migration

